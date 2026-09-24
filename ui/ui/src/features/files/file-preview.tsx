import {
	lazy,
	Suspense,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { Icon } from "../../components/icon";
import { LoadingState } from "../../components/loading-state";
import { downloadUrl, previewUrl, request } from "../../lib/api";
import { usePreference } from "./use-browser-preferences";
import { MAX_NUMBERED_LINES } from "./highlight-lines";
import { CodePreview } from "./code-preview";
import { previewKind, isTextFilename, type PreviewKind } from "./file-types";
import { baseName } from "./path";
import { readPreviewText } from "./preview-text";

const DocumentPreview = lazy(() =>
	import("./document-preview").then((module) => ({
		default: module.DocumentPreview,
	})),
);
const isMedia = (kind: PreviewKind) =>
	["image", "video", "audio", "pdf"].includes(kind);

export function FilePreview({
	path,
	onBack,
	renderMenu,
}: {
	path: string;
	onBack: () => void;
	renderMenu: (options: ReactNode) => ReactNode;
}) {
	const [content, setContent] = useState<string | null>(null);
	const [kind, setKind] = useState(() => previewKind(path));
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [truncated, setTruncated] = useState(false);
	const [source, setSource] = useState(false);
	const [wrap, setWrap] = usePreference(
		"webdrive.preview.wrap",
		["on", "off"],
		"off",
	);
	const [lineNumbers, setLineNumbers] = usePreference(
		"webdrive.preview.lines",
		["on", "off"],
		"on",
	);
	const [copyStatus, setCopyStatus] = useState("Copy");
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setContent(null);
		setTruncated(false);
		const initialKind = previewKind(path);
		setKind(initialKind);
		// Native media elements stream and seek directly without buffering a full blob.
		if (isMedia(initialKind)) return () => controller.abort();
		if (initialKind === "binary") {
			setLoading(false);
			return () => controller.abort();
		}
		const inspectFirst = initialKind === "text" && !isTextFilename(path);
		void request(previewUrl(path), {
			signal: controller.signal,
			method: inspectFirst ? "HEAD" : "GET",
		})
			.then(async (response) => {
				const detected = previewKind(
					path,
					response.headers.get("Content-Type") ?? "application/octet-stream",
				);
				if (controller.signal.aborted) {
					await response.body?.cancel();
					return;
				}
				setKind(detected);
				if (isMedia(detected) || detected === "binary") {
					await response.body?.cancel();
					if (detected === "binary") setLoading(false);
					return;
				}
				const textResponse = inspectFirst
					? await request(previewUrl(path), { signal: controller.signal })
					: response;
				const result = await readPreviewText(textResponse);
				if (!controller.signal.aborted) {
					setContent(result.text);
					setTruncated(result.truncated);
					setLoading(false);
				}
			})
			.catch((error: unknown) => {
				if (!controller.signal.aborted) {
					setError(error instanceof Error ? error.message : String(error));
					setLoading(false);
				}
			});
		return () => controller.abort();
	}, [path, attempt]);

	const richDocument = kind === "html" || kind === "markdown";
	const showSource = !richDocument || source || truncated;
	const mediaReady = () => setLoading(false);
	const mediaError = () => {
		setLoading(false);
		setError("This media could not be loaded. Try again or download the file.");
	};
	const lineCount = useMemo(
		() => (content === null ? 0 : content.split("\n").length),
		[content],
	);
	const canNumber = content !== null && lineCount <= MAX_NUMBERED_LINES;
	const options =
		content !== null ? (
			<>
				<div className="popup-label">Text options</div>
				<button
					className="popup-item"
					aria-pressed={lineNumbers === "on" && canNumber}
					disabled={!canNumber}
					title={
						!canNumber
							? "Line numbers are unavailable for files over 10,000 lines"
							: undefined
					}
					onClick={() => setLineNumbers(lineNumbers === "on" ? "off" : "on")}
				>
					<span className="popup-check">
						{lineNumbers === "on" && canNumber && (
							<Icon icon="solar:check-circle-bold" width={14} />
						)}
					</span>
					Show line numbers
				</button>
				<button
					className="popup-item"
					aria-pressed={wrap === "on"}
					onClick={() => setWrap(wrap === "on" ? "off" : "on")}
				>
					<span className="popup-check">
						{wrap === "on" && (
							<Icon icon="solar:check-circle-bold" width={14} />
						)}
					</span>
					Wrap lines
				</button>
				<button
					className="popup-item"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(content);
							setCopyStatus("Copied");
						} catch {
							setCopyStatus("Copy unavailable");
						}
					}}
				>
					{copyStatus}
				</button>
			</>
		) : null;
	return (
		<div className="file-preview">
			<div className="file-list-header preview-toolbar">
				<div className="toolbar-group">
					<button
						className="btn btn-ghost"
						aria-label="Parent folder"
						title="Back to folder"
						onClick={onBack}
					>
						<Icon icon="solar:arrow-left-linear" width={17} />
					</button>
					{richDocument && !truncated ? (
						<div className="preview-tabs" aria-label="Document view">
							<button
								className="btn btn-ghost"
								aria-pressed={!source}
								onClick={() => setSource(false)}
							>
								Preview
							</button>
							<button
								className="btn btn-ghost"
								aria-pressed={source}
								onClick={() => setSource(true)}
							>
								Source
							</button>
						</div>
					) : (
						<span className="toolbar-caption">
							{kind === "binary"
								? "Download"
								: kind === "text"
									? "Source"
									: "Preview"}
						</span>
					)}
				</div>
				<div className="preview-toolbar-actions">{renderMenu(options)}</div>
			</div>
			<div className="preview-status" role="status">
				{truncated
					? "Showing the first 1 MB as text. Download to read the full file."
					: kind === "html"
						? "HTML preview · scripts are disabled"
						: content !== null
							? `${lineCount.toLocaleString()} lines`
							: kind === "binary"
								? "Download to open on your device"
								: loading
									? "Loading preview…"
									: baseName(path)}
			</div>

			{error ? (
				<div className="datatable-state text-danger" role="alert">
					{error}{" "}
					<button
						className="btn btn-ghost"
						onClick={() => setAttempt(attempt + 1)}
					>
						Try again
					</button>
				</div>
			) : (
				<>
					{loading && <LoadingState label="Loading preview…" />}
					{content === "" && (
						<div className="datatable-state">This file is empty.</div>
					)}
					{content !== null &&
						content !== "" &&
						(showSource ? (
							<CodePreview
								content={content}
								filename={baseName(path)}
								wrap={wrap === "on"}
								lineNumbers={lineNumbers === "on" && canNumber}
							/>
						) : (
							<Suspense fallback={<LoadingState label="Rendering document…" />}>
								<DocumentPreview
									content={content}
									path={path}
									kind={kind as "html" | "markdown"}
								/>
							</Suspense>
						))}
					{isMedia(kind) && (
						<div className="preview-media" key={attempt}>
							{kind === "image" && (
								<img
									src={previewUrl(path)}
									alt={baseName(path)}
									onLoad={mediaReady}
									onError={mediaError}
								/>
							)}
							{kind === "video" && (
								<video
									src={previewUrl(path)}
									controls
									preload="metadata"
									onLoadedMetadata={mediaReady}
									onError={mediaError}
								/>
							)}
							{kind === "audio" && (
								<audio
									src={previewUrl(path)}
									controls
									preload="metadata"
									onLoadedMetadata={mediaReady}
									onError={mediaError}
								/>
							)}
							{kind === "pdf" && (
								<iframe
									src={previewUrl(path)}
									title={baseName(path)}
									onLoad={mediaReady}
								/>
							)}
						</div>
					)}
					{kind === "binary" && !loading && (
						<div className="empty-state download-state">
							<div className="empty-state-icon">
								<Icon icon="solar:archive-linear" width={36} />
							</div>
							<span className="download-file-type">
								{baseName(path).includes(".")
									? baseName(path).match(
											/(?:tar\.)?(?:gz|bz2|xz|zst)$|[^.]+$/i,
										)?.[0]
									: "Binary file"}
							</span>
							<h2>Ready to download</h2>
							<p>
								This file can’t be previewed here. Download it to open with an
								app on your device.
							</p>
							<a className="btn btn-primary" href={downloadUrl(path)}>
								<Icon icon="solar:download-square-linear" width={18} />
								Download file
							</a>
						</div>
					)}
				</>
			)}
		</div>
	);
}
