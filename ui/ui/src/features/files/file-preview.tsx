import { lazy, Suspense, useEffect, useState } from "react";
import { LoadingState } from "../../components/loading-state";
import { downloadUrl, previewUrl, request } from "../../lib/api";
import { CodePreview } from "./code-preview";
import { previewKind, type PreviewKind } from "./file-types";
import { baseName } from "./path";
import { readPreviewText } from "./preview-text";

const DocumentPreview = lazy(() =>
	import("./document-preview").then((module) => ({
		default: module.DocumentPreview,
	})),
);
const isMedia = (kind: PreviewKind) =>
	["image", "video", "audio", "pdf"].includes(kind);

export function FilePreview({ path }: { path: string }) {
	const [content, setContent] = useState<string | null>(null);
	const [kind, setKind] = useState(() => previewKind(path));
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [truncated, setTruncated] = useState(false);
	const [source, setSource] = useState(false);
	const [wrap, setWrap] = useState(false);
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
		void request(previewUrl(path), { signal: controller.signal })
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
				const result = await readPreviewText(response);
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
	return (
		<div className="file-preview">
			<div className="preview-toolbar">
				{richDocument && !truncated && (
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
				)}
				{content !== null && showSource && (
					<button
						className="btn btn-ghost"
						aria-pressed={wrap}
						onClick={() => setWrap(!wrap)}
					>
						Wrap lines
					</button>
				)}
				<div className="preview-toolbar-actions">
					{content !== null && (
						<button
							className="btn btn-ghost"
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
					)}
					<a className="btn btn-ghost" href={downloadUrl(path)}>
						Download
					</a>
				</div>
			</div>
			{truncated && (
				<div className="preview-notice" role="status">
					Showing the first 1 MB as text. Download the file to read it in full.
				</div>
			)}
			{richDocument && !showSource && kind === "html" && (
				<div className="preview-notice">
					HTML preview · scripts are disabled
				</div>
			)}
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
								wrap={wrap}
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
						<div className="datatable-state">
							Preview is unavailable for this file. Use Download to open it
							locally.
						</div>
					)}
				</>
			)}
		</div>
	);
}
