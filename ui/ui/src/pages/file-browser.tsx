import { Icon } from "@iconify/react";
import hljs from "highlight.js";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/button";
import { formatBytes } from "../lib/format";
import { type DataTableColumn, DataTable } from "../components/data-table";
import { Modal } from "../components/modal";
import { RenameModal } from "../components/rename-modal";

type Entry = {
	name: string;
	is_dir: boolean;
	size: number;
	mod_time: string;
};

type ListResponse = {
	path: string;
	entries: Entry[];
};

function formatTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString(undefined, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function joinPath(dir: string, name: string): string {
	if (dir === "/" || dir === "") return `/${name}`;
	return `${dir.replace(/\/+$/, "")}/${name}`;
}

function parentOf(p: string): string {
	if (p === "/" || p === "") return "/";
	const idx = p.replace(/\/+$/, "").lastIndexOf("/");
	if (idx <= 0) return "/";
	return p.slice(0, idx);
}

function baseName(p: string): string {
	const parts = p.replace(/\/+$/, "").split("/");
	return parts[parts.length - 1] || "/";
}

function mimeCategory(
	ct: string,
): "text" | "image" | "video" | "audio" | "pdf" | "binary" {
	if (
		ct.startsWith("text/") ||
		ct === "application/json" ||
		ct === "application/xml" ||
		ct.includes("javascript") ||
		ct.includes("yaml") ||
		ct.includes("toml")
	)
		return "text";
	if (ct.startsWith("image/")) return "image";
	if (ct.startsWith("video/")) return "video";
	if (ct.startsWith("audio/")) return "audio";
	if (ct === "application/pdf") return "pdf";
	return "binary";
}

function mediaTypeFromName(name: string): "image" | "video" | "audio" | null {
	const ext = name.split(".").pop()?.toLowerCase();
	if (!ext) return null;
	const imageExts = new Set([
		"jpg",
		"jpeg",
		"png",
		"gif",
		"webp",
		"svg",
		"bmp",
		"ico",
		"avif",
		"heic",
	]);
	const videoExts = new Set(["mp4", "webm", "mov", "avi", "mkv", "m4v"]);
	const audioExts = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"]);
	if (imageExts.has(ext)) return "image";
	if (videoExts.has(ext)) return "video";
	if (audioExts.has(ext)) return "audio";
	return null;
}

function fileIcon(name: string, isDir: boolean): string {
	if (isDir) return "solar:folder-bold-duotone";
	const media = mediaTypeFromName(name);
	if (media === "image") return "solar:gallery-linear";
	if (media === "video") return "solar:videocamera-linear";
	if (media === "audio") return "solar:music-note-linear";
	return "solar:document-text-linear";
}

// ── Gallery View ──────────────────────────────────────────────

const ZOOM_MIN = 1;
const ZOOM_MAX = 12;

function GalleryView({
	entries,
	dirPath,
	onNavigate,
	cols,
	onColsChange,
}: {
	entries: Entry[];
	dirPath: string;
	onNavigate: (p: string) => void;
	cols: number;
	onColsChange: (c: number) => void;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const pinchRef = useRef<number | null>(null);
	const colsAtPinchStart = useRef(cols);

	useEffect(() => {
		const el = gridRef.current;
		if (!el) return;

		const onWheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			const next = cols + (e.deltaY > 0 ? 1 : -1);
			onColsChange(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
		};

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length === 2) {
				const dx = e.touches[0].clientX - e.touches[1].clientX;
				const dy = e.touches[0].clientY - e.touches[1].clientY;
				pinchRef.current = Math.hypot(dx, dy);
				colsAtPinchStart.current = cols;
			}
		};

		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 2 || pinchRef.current === null) return;
			e.preventDefault();
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.hypot(dx, dy);
			const scale = dist / pinchRef.current;
			// Pinch out (zoom in) = fewer cols, pinch in (zoom out) = more cols
			const newCols = Math.round(colsAtPinchStart.current / scale);
			onColsChange(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newCols)));
		};

		const onTouchEnd = () => {
			pinchRef.current = null;
		};

		el.addEventListener("wheel", onWheel, { passive: false });
		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", onTouchEnd);

		return () => {
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", onTouchEnd);
		};
	}, [cols]);

	return (
		<div
			ref={gridRef}
			className="gallery-grid"
			style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
		>
			{entries.map((entry) => {
				const fullPath = joinPath(dirPath, entry.name);
				const media = entry.is_dir ? null : mediaTypeFromName(entry.name);
				const isPreviewable = media === "image" || media === "video";

				return (
					<button
						key={entry.name}
						type="button"
						className={`gallery-item${isPreviewable ? " gallery-media" : ""}`}
						onClick={() => onNavigate(fullPath)}
						title={entry.name}
					>
						{isPreviewable ? (
							<>
								{media === "image" ? (
									<img
										src={`/api/fs/preview?path=${encodeURIComponent(fullPath)}`}
										alt={entry.name}
										loading="lazy"
									/>
								) : (
									<video
										src={`/api/fs/preview?path=${encodeURIComponent(fullPath)}`}
										muted
										preload="metadata"
									/>
								)}
								{media === "video" && (
									<div className="gallery-play">
										<Icon icon="solar:play-bold" width={20} />
									</div>
								)}
								<div className="gallery-hover-name">{entry.name}</div>
							</>
						) : (
							<>
								<Icon
									icon={fileIcon(entry.name, entry.is_dir)}
									width={24}
									className={entry.is_dir ? "text-accent" : "text-muted"}
								/>
								<span className="gallery-file-name">{entry.name}</span>
							</>
						)}
					</button>
				);
			})}
		</div>
	);
}

// ── Code Preview with syntax highlighting ─────────────────────

function langFromFilename(name: string): string | undefined {
	const ext = name.split(".").pop()?.toLowerCase();
	if (!ext) return undefined;
	const map: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		py: "python",
		rb: "ruby",
		rs: "rust",
		go: "go",
		java: "java",
		c: "c",
		h: "c",
		cpp: "cpp",
		hpp: "cpp",
		cs: "csharp",
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		fish: "bash",
		json: "json",
		yaml: "yaml",
		yml: "yaml",
		toml: "ini",
		xml: "xml",
		html: "xml",
		htm: "xml",
		svg: "xml",
		css: "css",
		scss: "scss",
		less: "less",
		sql: "sql",
		md: "markdown",
		dockerfile: "dockerfile",
		makefile: "makefile",
		lua: "lua",
		php: "php",
		swift: "swift",
		kt: "kotlin",
		r: "r",
		pl: "perl",
		ex: "elixir",
		erl: "erlang",
		hs: "haskell",
		ml: "ocaml",
		vim: "vim",
		tf: "hcl",
		proto: "protobuf",
		graphql: "graphql",
		gql: "graphql",
	};
	return map[ext];
}

function CodePreview({
	content,
	filename,
}: {
	content: string;
	filename: string;
}) {
	const codeRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (!codeRef.current) return;
		const lang = langFromFilename(filename);
		if (lang) {
			try {
				const result = hljs.highlight(content, { language: lang });
				codeRef.current.innerHTML = result.value;
			} catch {
				codeRef.current.textContent = content;
			}
		} else {
			const result = hljs.highlightAuto(content);
			codeRef.current.innerHTML = result.value;
		}
	}, [content, filename]);

	return (
		<div className="preview-text">
			<pre>
				<code ref={codeRef} className="hljs">
					{content}
				</code>
			</pre>
		</div>
	);
}

// ── File Preview ──────────────────────────────────────────────

function FilePreview({ path }: { path: string }) {
	const [content, setContent] = useState<string | null>(null);
	const [contentType, setContentType] = useState<string>("");
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		setContent(null);
		setBlobUrl(null);

		fetch(`/api/fs/preview?path=${encodeURIComponent(path)}`)
			.then(async (r) => {
				if (!r.ok) {
					const body = await r.json().catch(() => ({ error: r.statusText }));
					throw new Error(body.error ?? r.statusText);
				}
				const ct = r.headers.get("Content-Type") ?? "application/octet-stream";
				if (cancelled) return;
				setContentType(ct);

				const cat = mimeCategory(ct);
				if (cat === "text") {
					const text = await r.text();
					if (!cancelled) setContent(text);
				} else {
					const blob = await r.blob();
					if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
				}
			})
			.catch((e: unknown) => {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [path]);

	useEffect(() => {
		return () => {
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	}, [blobUrl]);

	if (loading) return <div className="datatable-state">loading...</div>;
	if (error) return <div className="datatable-state text-danger">{error}</div>;

	const cat = mimeCategory(contentType);

	if (cat === "text" && content !== null) {
		return <CodePreview content={content} filename={baseName(path)} />;
	}
	if (cat === "image" && blobUrl) {
		return (
			<div className="preview-media">
				<img src={blobUrl} alt={baseName(path)} />
			</div>
		);
	}
	if (cat === "video" && blobUrl) {
		return (
			<div className="preview-media">
				<video src={blobUrl} controls />
			</div>
		);
	}
	if (cat === "audio" && blobUrl) {
		return (
			<div className="preview-media">
				<audio src={blobUrl} controls />
			</div>
		);
	}
	if (cat === "pdf" && blobUrl) {
		return (
			<div className="preview-media">
				<iframe src={blobUrl} title={baseName(path)} />
			</div>
		);
	}

	return (
		<div className="datatable-state">
			<span className="text-muted">
				Cannot preview ({contentType}).{" "}
				<a
					href={`/api/fs/download?path=${encodeURIComponent(path)}`}
					className="text-accent"
				>
					Download
				</a>
			</span>
		</div>
	);
}

// ── Breadcrumb ────────────────────────────────────────────────

function BreadcrumbButton({
	path,
	onNavigate,
}: {
	path: string;
	onNavigate: (p: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const parts = path.split("/").filter(Boolean);
	const segments = (() => {
		let acc = "";
		return [
			{ name: "/", path: "/" },
			...parts.map((p) => {
				acc += `/${p}`;
				return { name: p, path: acc };
			}),
		];
	})();
	const label = path === "/" ? "/" : `\u200E/ ${parts.join(" / ")}`;

	return (
		<>
			<button
				type="button"
				className="breadcrumb-btn"
				onClick={() => setOpen(true)}
			>
				<Icon
					icon="solar:folder-path-connect-linear"
					width={13}
					className="text-muted shrink-0"
				/>
				<span className="breadcrumb-label">{label}</span>
			</button>

			<Modal open={open} onClose={() => setOpen(false)}>
				<Modal.Header>Navigate to</Modal.Header>
				<Modal.Body>
					<div className="path-modal-list">
						{segments.map((s, i) => (
							<button
								key={s.path}
								type="button"
								className={`path-modal-item${s.path === path ? " active" : ""}`}
								onClick={() => {
									onNavigate(s.path);
									setOpen(false);
								}}
							>
								<span
									className="text-muted"
									style={{ minWidth: `${i}rem`, display: "inline-block" }}
								/>
								<Icon
									icon={i === 0 ? "solar:home-linear" : "solar:folder-linear"}
									width={13}
									className="text-muted"
								/>
								<span>{s.name}</span>
							</button>
						))}
					</div>
				</Modal.Body>
			</Modal>
		</>
	);
}

// ── Dashboard ─────────────────────────────────────────────────

export function FileBrowser() {
	const location = useLocation();
	const routerNavigate = useNavigate();

	// Derive file path from URL: /files/some%20dir → /some dir
	const path =
		decodeURIComponent(location.pathname.replace(/^\/files/, "")) || "/";

	const navigate = (p: string) => {
		if (p === "/") {
			routerNavigate("/files");
			return;
		}
		// Encode each path segment to handle spaces and special chars
		const encoded = p
			.split("/")
			.map((seg) => encodeURIComponent(seg))
			.join("/");
		routerNavigate(`/files${encoded}`);
	};

	const [data, setData] = useState<ListResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [isFile, setIsFile] = useState(false);

	const [sortKey, setSortKey] = useState<"name" | "size" | "mod_time">("name");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

	const [renameOpen, setRenameOpen] = useState(false);
	const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
	const [galleryCols, setGalleryCols] = useState(5);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		setIsFile(false);
		fetch(`/api/fs/list?path=${encodeURIComponent(path)}`)
			.then(async (r) => {
				if (!r.ok) {
					const body = await r.json();
					if (body.error === "not a directory") {
						if (!cancelled) setIsFile(true);
						return null;
					}
					throw new Error(body.error ?? r.statusText);
				}
				return (await r.json()) as ListResponse;
			})
			.then((d) => {
				if (!cancelled && d) setData(d);
			})
			.catch((e: unknown) => {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [path]);

	const handleRename = async (newName: string) => {
		const r = await fetch("/api/fs/rename", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, new_name: newName }),
		});
		const body = await r.json();
		if (!r.ok) throw new Error(body.error ?? "rename failed");
		navigate(joinPath(parentOf(path), newName));
	};

	// Shared toolbar actions (right side)
	const actions = (
		<div className="toolbar-group">
			<a
				href={`/api/fs/download?path=${encodeURIComponent(path)}`}
				target="_blank"
				rel="noreferrer"
			>
				<Button variant="ghost">
					<Icon icon="solar:download-square-linear" width={15} />
					<span className="btn-label">Download</span>
				</Button>
			</a>
			<Button variant="ghost" onClick={() => setRenameOpen(true)}>
				<Icon icon="solar:pen-linear" width={15} />
				<span className="btn-label">Rename</span>
			</Button>
		</div>
	);

	// ── File view ──
	if (isFile) {
		return (
			<div className="page-shell animate-fadeUp">
				<div className="toolbar">
					<div className="toolbar-group">
						<Button variant="ghost" onClick={() => navigate(parentOf(path))}>
							<Icon icon="solar:arrow-left-linear" width={15} />
						</Button>
						<BreadcrumbButton path={path} onNavigate={navigate} />
					</div>
					{actions}
				</div>

				{error && <div className="error-box">Error: {error}</div>}

				<div className="flex-1">
					<div className="datatable-wrapper">
						<div className="datatable-header-bar">
							<span className="text-sm text-muted">{baseName(path)}</span>
						</div>
						<div className="datatable-scroll">
							<FilePreview path={path} />
						</div>
					</div>
				</div>

				<RenameModal
					open={renameOpen}
					onClose={() => setRenameOpen(false)}
					initialName={baseName(path)}
					onRename={handleRename}
				/>
			</div>
		);
	}

	// ── Directory view ──
	type Row = Entry & { _isParent?: boolean };

	const toggleSort = (key: "name" | "size" | "mod_time") => {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	};

	const parentRow: Row | null =
		path !== "/"
			? { name: "..", is_dir: true, size: 0, mod_time: "", _isParent: true }
			: null;

	const sortedEntries = data
		? [...data.entries].sort((a, b) => {
				if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
				const dir = sortDir === "asc" ? 1 : -1;
				if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
				if (sortKey === "size") return (a.size - b.size) * dir;
				return (
					(new Date(a.mod_time).getTime() - new Date(b.mod_time).getTime()) *
					dir
				);
			})
		: [];

	const rows: Row[] = [...(parentRow ? [parentRow] : []), ...sortedEntries];

	const columns: DataTableColumn<Row>[] = [
		{
			key: "icon",
			label: "",
			width: "2.5rem",
			render: (row) => (
				<Icon
					icon={
						row._isParent
							? "solar:arrow-left-linear"
							: row.is_dir
								? "solar:folder-bold-duotone"
								: "solar:document-text-linear"
					}
					width={15}
					className={row.is_dir ? "text-accent" : "text-muted"}
				/>
			),
		},
		{
			key: "name",
			label: "Name",
			onSort: () => toggleSort("name"),
			sortDir: sortKey === "name" ? sortDir : undefined,
			render: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "size",
			label: "Size",
			width: "7rem",
			onSort: () => toggleSort("size"),
			sortDir: sortKey === "size" ? sortDir : undefined,
			render: (row) => (
				<span className="text-muted">
					{row._isParent || row.is_dir ? "—" : formatBytes(row.size)}
				</span>
			),
		},
		{
			key: "mod_time",
			label: "Modified",
			width: "11rem",
			onSort: () => toggleSort("mod_time"),
			sortDir: sortKey === "mod_time" ? sortDir : undefined,
			render: (row) => (
				<span className="text-muted">
					{row._isParent ? "—" : formatTime(row.mod_time)}
				</span>
			),
		},
	];

	return (
		<div className="page-shell animate-fadeUp">
			<div className="toolbar">
				<div className="toolbar-group">
					{path !== "/" && (
						<Button variant="ghost" onClick={() => navigate(parentOf(path))}>
							<Icon icon="solar:arrow-left-linear" width={15} />
						</Button>
					)}
					<BreadcrumbButton path={path} onNavigate={navigate} />
				</div>
				<div className="toolbar-group">
					{path !== "/" && actions}
					{viewMode === "gallery" && (
						<input
							type="range"
							className="zoom-slider"
							min={ZOOM_MIN}
							max={ZOOM_MAX}
							value={ZOOM_MAX + ZOOM_MIN - galleryCols}
							onChange={(e) =>
								setGalleryCols(ZOOM_MAX + ZOOM_MIN - Number(e.target.value))
							}
						/>
					)}
					<Button
						variant={viewMode === "gallery" ? "primary" : "ghost"}
						onClick={() =>
							setViewMode(viewMode === "list" ? "gallery" : "list")
						}
					>
						<Icon
							icon={
								viewMode === "list"
									? "solar:gallery-linear"
									: "solar:list-linear"
							}
							width={15}
						/>
					</Button>
				</div>
			</div>

			{error && <div className="error-box">Error: {error}</div>}

			<div className="flex-1">
				{viewMode === "gallery" ? (
					<div className="datatable-wrapper">
						<div className="datatable-scroll">
							{loading && !data ? (
								<div className="datatable-state">loading...</div>
							) : sortedEntries.length === 0 ? (
								<div className="datatable-state">Empty directory.</div>
							) : (
								<GalleryView
									entries={sortedEntries}
									dirPath={path}
									onNavigate={navigate}
									cols={galleryCols}
									onColsChange={setGalleryCols}
								/>
							)}
						</div>
					</div>
				) : (
					<DataTable<Row>
						columns={columns}
						data={rows}
						keyExtractor={(row) => (row._isParent ? "__parent__" : row.name)}
						isLoading={loading && !data}
						emptyMessage="Empty directory."
						onRowClick={(row) => {
							if (row._isParent) navigate(parentOf(path));
							else navigate(joinPath(path, row.name));
						}}
					/>
				)}
			</div>

			<RenameModal
				open={renameOpen}
				onClose={() => setRenameOpen(false)}
				initialName={baseName(path)}
				onRename={handleRename}
			/>
		</div>
	);
}
