import { Icon } from "@iconify/react";
import hljs from "highlight.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/button";
import { previewUrl, downloadUrl } from "../lib/api";
import { formatBytes } from "../lib/format";
import { Modal } from "../components/modal";
import { RenameModal } from "../components/rename-modal";
import "./file-browser.css";

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
		hour12: false,
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
const TILE_MIN_PX = 180;

// ── Carousel Lightbox ─────────────────────────────────────────

function Carousel({
	items,
	startIndex,
	onClose,
	onOpen,
}: {
	items: { name: string; path: string; type: "image" | "video" }[];
	startIndex: number;
	onClose: () => void;
	onOpen: (path: string) => void;
}) {
	const [index, setIndex] = useState(startIndex);
	const touchStartX = useRef(0);

	const item = items[index];
	const hasPrev = index > 0;
	const hasNext = index < items.length - 1;

	const prev = () => setIndex((i) => Math.max(0, i - 1));
	const next = () => setIndex((i) => Math.min(items.length - 1, i + 1));

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowLeft") prev();
			if (e.key === "ArrowRight") next();
			if (e.key === "Enter") onOpen(items[index].path);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [index]);

	const onTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX;
	};
	const onTouchEnd = (e: React.TouchEvent) => {
		const dx = e.changedTouches[0].clientX - touchStartX.current;
		if (dx > 60) prev();
		else if (dx < -60) next();
	};

	return (
		<div
			className="carousel-overlay"
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
		>
			<div className="carousel-backdrop" onClick={onClose} />

			{/* Top bar */}
			<div className="carousel-topbar">
				<span className="carousel-filename">{item.name}</span>
				<span className="text-sm text-muted">
					{index + 1} / {items.length}
				</span>
				<div className="toolbar-group">
					<button
						type="button"
						className="carousel-btn"
						onClick={() => onOpen(item.path)}
					>
						<Icon icon="solar:maximize-linear" width={16} />
					</button>
					<a
						href={downloadUrl(item.path)}
						target="_blank"
						rel="noreferrer"
						className="carousel-btn"
					>
						<Icon icon="solar:download-square-linear" width={16} />
					</a>
					<button type="button" className="carousel-btn" onClick={onClose}>
						<Icon icon="solar:close-circle-linear" width={16} />
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="carousel-content">
				{item.type === "image" ? (
					<img key={item.path} src={previewUrl(item.path)} alt={item.name} />
				) : (
					<video
						key={item.path}
						src={previewUrl(item.path)}
						controls
						autoPlay
					/>
				)}
			</div>

			{/* Arrows */}
			{hasPrev && (
				<button
					type="button"
					className="carousel-arrow carousel-arrow-left"
					onClick={prev}
				>
					<Icon icon="solar:alt-arrow-left-linear" width={24} />
				</button>
			)}
			{hasNext && (
				<button
					type="button"
					className="carousel-arrow carousel-arrow-right"
					onClick={next}
				>
					<Icon icon="solar:alt-arrow-right-linear" width={24} />
				</button>
			)}
		</div>
	);
}

function GalleryView({
	entries,
	dirPath,
	onNavigate,
	cols,
	onColsChange,
	onZoomMaxChange,
	selectMode,
	selected,
	onToggleSelect,
}: {
	entries: Entry[];
	dirPath: string;
	onNavigate: (p: string) => void;
	cols: number;
	onColsChange: (c: number) => void;
	onZoomMaxChange: (max: number) => void;
	selectMode?: boolean;
	selected?: Set<string>;
	onToggleSelect?: (name: string) => void;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const pinchRef = useRef<number | null>(null);
	const colsAtPinchStart = useRef(cols);
	const colsRef = useRef(cols);
	const onColsChangeRef = useRef(onColsChange);
	const onZoomMaxChangeRef = useRef(onZoomMaxChange);
	colsRef.current = cols;
	onColsChangeRef.current = onColsChange;
	onZoomMaxChangeRef.current = onZoomMaxChange;

	const maxRef = useRef(ZOOM_MIN);

	useEffect(() => {
		const el = gridRef.current;
		if (!el) return;

		const updateMax = () => {
			if (!el.clientWidth) return;
			const max = Math.max(ZOOM_MIN, Math.floor(el.clientWidth / TILE_MIN_PX));
			if (max === maxRef.current) return;
			maxRef.current = max;
			onZoomMaxChangeRef.current(max);
			if (colsRef.current > max) onColsChangeRef.current(max);
		};
		updateMax();
		const ro = new ResizeObserver(updateMax);
		ro.observe(el);

		const clamp = (n: number) =>
			Math.min(maxRef.current, Math.max(ZOOM_MIN, n));

		const onWheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			onColsChangeRef.current(clamp(colsRef.current + (e.deltaY > 0 ? 1 : -1)));
		};

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length === 2) {
				const dx = e.touches[0].clientX - e.touches[1].clientX;
				const dy = e.touches[0].clientY - e.touches[1].clientY;
				pinchRef.current = Math.hypot(dx, dy);
				colsAtPinchStart.current = colsRef.current;
			}
		};

		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 2 || pinchRef.current === null) return;
			e.preventDefault();
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.hypot(dx, dy);
			const scale = dist / pinchRef.current;
			const newCols = Math.round(colsAtPinchStart.current / scale);
			onColsChangeRef.current(clamp(newCols));
		};

		const onTouchEnd = () => {
			pinchRef.current = null;
		};

		el.addEventListener("wheel", onWheel, { passive: false });
		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", onTouchEnd);

		return () => {
			ro.disconnect();
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", onTouchEnd);
		};
	}, []);

	const [carouselIndex, setCarouselIndex] = useState<number | null>(null);

	const mediaItems = useMemo(
		() =>
			entries
				.filter((e) => !e.is_dir && mediaTypeFromName(e.name) !== null)
				.map((e) => ({
					name: e.name,
					path: joinPath(dirPath, e.name),
					type: mediaTypeFromName(e.name) as "image" | "video",
				})),
		[entries, dirPath],
	);

	const openCarousel = (entryName: string) => {
		const idx = mediaItems.findIndex((m) => m.name === entryName);
		if (idx >= 0) setCarouselIndex(idx);
	};

	return (
		<>
			<div
				ref={gridRef}
				className="gallery-grid"
				style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
			>
				{entries.map((entry) => {
					const fullPath = joinPath(dirPath, entry.name);
					const media = entry.is_dir ? null : mediaTypeFromName(entry.name);
					const isPreviewable = media === "image" || media === "video";
					const isSelected = selectMode && selected?.has(entry.name);

					return (
						<button
							key={entry.name}
							type="button"
							className={`gallery-item${isPreviewable ? " gallery-media" : ""}${isSelected ? " selected" : ""}`}
							onClick={() =>
								selectMode && onToggleSelect
									? onToggleSelect(entry.name)
									: isPreviewable
										? openCarousel(entry.name)
										: onNavigate(fullPath)
							}
							title={entry.name}
						>
							{selectMode && (
								<input
									type="checkbox"
									className="gallery-select-checkbox"
									checked={!!isSelected}
									readOnly
								/>
							)}
							{isPreviewable ? (
								<>
									{media === "image" ? (
										<img
											src={previewUrl(fullPath)}
											alt={entry.name}
											loading="lazy"
										/>
									) : (
										<video
											src={previewUrl(fullPath)}
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
			{carouselIndex !== null && (
				<Carousel
					items={mediaItems}
					startIndex={carouselIndex}
					onClose={() => setCarouselIndex(null)}
					onOpen={(p) => {
						setCarouselIndex(null);
						onNavigate(p);
					}}
				/>
			)}
		</>
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

		fetch(previewUrl(path))
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
				<a href={downloadUrl(path)} className="text-accent">
					Download
				</a>
			</span>
		</div>
	);
}

// ── Breadcrumb ────────────────────────────────────────────────

function Breadcrumb({
	path,
	onNavigate,
}: {
	path: string;
	onNavigate: (p: string) => void;
}) {
	const [modalOpen, setModalOpen] = useState(false);
	const parts = path.split("/").filter(Boolean);

	const allSegments = (() => {
		let acc = "";
		return [
			{ name: "/", path: "/" },
			...parts.map((p) => {
				acc += `/${p}`;
				return { name: p, path: acc };
			}),
		];
	})();

	const showEllipsis = parts.length > 2;
	const visible = showEllipsis ? parts.slice(-2) : parts;
	const offset = showEllipsis ? parts.length - 2 : 0;

	return (
		<>
			<nav className="breadcrumb">
				<button
					type="button"
					className={`breadcrumb-seg${path === "/" ? " current" : ""}`}
					onClick={path === "/" ? undefined : () => onNavigate("/")}
				>
					<Icon icon="solar:folder-path-connect-linear" width={13} />
				</button>

				{showEllipsis && (
					<>
						<span className="breadcrumb-sep">/</span>
						<button
							type="button"
							className="breadcrumb-seg"
							onClick={() => setModalOpen(true)}
						>
							&hellip;
						</button>
					</>
				)}

				{visible.flatMap((name, i) => {
					const segPath = "/" + parts.slice(0, offset + i + 1).join("/");
					const isCurrent = i === visible.length - 1;
					return [
						<span key={`sep-${segPath}`} className="breadcrumb-sep">
							/
						</span>,
						isCurrent ? (
							<span key={segPath} className="breadcrumb-seg current">
								{name}
							</span>
						) : (
							<button
								key={segPath}
								type="button"
								className="breadcrumb-seg"
								onClick={() => onNavigate(segPath)}
							>
								{name}
							</button>
						),
					];
				})}
			</nav>

			<Modal open={modalOpen} onClose={() => setModalOpen(false)}>
				<Modal.Header>Navigate to</Modal.Header>
				<Modal.Body>
					<div className="path-modal-list">
						{allSegments.map((s, i) => (
							<button
								key={s.path}
								type="button"
								className={`path-modal-item${s.path === path ? " active" : ""}`}
								onClick={() => {
									onNavigate(s.path);
									setModalOpen(false);
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

	const path = decodeURIComponent(location.pathname) || "/";

	const navigate = (p: string) => {
		if (p === "/") {
			routerNavigate("/");
			return;
		}
		const encoded = p
			.split("/")
			.map((seg) => encodeURIComponent(seg))
			.join("/");
		routerNavigate(encoded);
	};

	const [data, setData] = useState<ListResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [isFile, setIsFile] = useState(false);

	const [sortKey, setSortKey] = useState<"name" | "size" | "mod_time">("name");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

	const refreshListing = async () => {
		const r = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
		if (r.ok) setData(await r.json());
	};

	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
	const [galleryCols, setGalleryCols] = useState(5);
	const [zoomMax, setZoomMax] = useState(8);

	const [selectMode, setSelectMode] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
	const [batchDeleting, setBatchDeleting] = useState(false);

	const toggleSelect = (name: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (!data) return;
		if (selected.size === data.entries.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(data.entries.map((e) => e.name)));
		}
	};

	const exitSelectMode = () => {
		setSelectMode(false);
		setSelected(new Set());
	};

	const handleBatchDownload = () => {
		const params = new URLSearchParams();
		for (const name of selected) {
			params.append("path", joinPath(path, name));
		}
		window.open(`/api/fs/download?${params.toString()}`, "_blank");
	};

	const handleBatchDelete = async () => {
		setBatchDeleting(true);
		try {
			const paths = Array.from(selected).map((name) => joinPath(path, name));
			const r = await fetch("/api/fs/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ paths }),
			});
			const body = await r.json();
			if (!r.ok) {
				setError(body.errors?.join("; ") ?? "delete failed");
			}
			await refreshListing();
			exitSelectMode();
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBatchDeleting(false);
			setBatchDeleteOpen(false);
		}
	};

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		setIsFile(false);
		setData(null);
		setSelectMode(false);
		setSelected(new Set());
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

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploadState, setUploadState] = useState<{
		current: string;
		index: number;
		total: number;
		fileProgress: number;
	} | null>(null);

	const handleUpload = async (files: FileList) => {
		const fileList = Array.from(files);
		const total = fileList.length;
		const errors: string[] = [];

		for (let i = 0; i < total; i++) {
			const file = fileList[i];
			setUploadState({ current: file.name, index: i, total, fileProgress: 0 });

			await new Promise<void>((resolve) => {
				const form = new FormData();
				form.append("path", path);
				form.append("files", file);
				const xhr = new XMLHttpRequest();
				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						setUploadState((s) =>
							s ? { ...s, fileProgress: e.loaded / e.total } : s,
						);
					}
				};
				xhr.onload = () => {
					if (xhr.status >= 400) {
						try {
							const body = JSON.parse(xhr.responseText);
							errors.push(body.errors?.join("; ") ?? file.name);
						} catch {
							errors.push(file.name);
						}
					}
					resolve();
				};
				xhr.onerror = () => {
					errors.push(file.name);
					resolve();
				};
				xhr.open("POST", "/api/fs/upload");
				xhr.send(form);
			});
		}

		setUploadState(null);
		if (errors.length > 0) {
			setError(`Failed to upload: ${errors.join(", ")}`);
		}
		await refreshListing();
	};

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

	const handleDelete = async () => {
		setDeleting(true);
		try {
			const r = await fetch("/api/fs/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path }),
			});
			const body = await r.json();
			if (!r.ok) throw new Error(body.error ?? "delete failed");
			navigate(parentOf(path));
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setDeleting(false);
			setDeleteOpen(false);
		}
	};

	// Popup menu
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, [menuOpen]);

	const toggleSort = (key: "name" | "size" | "mod_time") => {
		if (sortKey === key) {
			setSortDir(sortDir === "asc" ? "desc" : "asc");
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	};

	const menuButton = (
		<div className="popup-anchor" ref={menuRef}>
			<Button variant="ghost" onClick={() => setMenuOpen(!menuOpen)}>
				<Icon icon="solar:menu-dots-bold" width={15} />
			</Button>
			{menuOpen && (
				<div className="popup-menu">
					{!isFile && (
						<>
							<button
								type="button"
								className="popup-item"
								onClick={() => {
									selectMode ? exitSelectMode() : setSelectMode(true);
									setMenuOpen(false);
								}}
							>
								<Icon icon="solar:check-square-linear" width={14} />
								{selectMode ? "Cancel Select" : "Select"}
							</button>
							<div className="popup-divider" />
							<button
								type="button"
								className="popup-item"
								onClick={() => {
									setViewMode("list");
									setMenuOpen(false);
								}}
							>
								<span className="popup-check">
									{viewMode === "list" && (
										<Icon icon="solar:check-circle-bold" width={14} />
									)}
								</span>
								<Icon icon="solar:list-linear" width={14} />
								List
							</button>
							<button
								type="button"
								className="popup-item"
								onClick={() => {
									setViewMode("gallery");
									setMenuOpen(false);
								}}
							>
								<span className="popup-check">
									{viewMode === "gallery" && (
										<Icon icon="solar:check-circle-bold" width={14} />
									)}
								</span>
								<Icon icon="solar:widget-linear" width={14} />
								Gallery
							</button>
							<div className="popup-divider" />
							{(
								[
									["name", "Name"],
									["mod_time", "Date"],
									["size", "Size"],
								] as const
							).map(([key, label]) => (
								<button
									key={key}
									type="button"
									className="popup-item"
									onClick={() => {
										toggleSort(key);
										setMenuOpen(false);
									}}
								>
									<span className="popup-check">
										{sortKey === key && (
											<Icon icon="solar:check-circle-bold" width={14} />
										)}
									</span>
									<span>
										{label}
										{sortKey === key && (
											<span className="text-muted">
												{" "}
												· {sortDir === "asc" ? "Asc" : "Desc"}
											</span>
										)}
									</span>
								</button>
							))}
							<div className="popup-divider" />
						</>
					)}
					{!isFile && !selectMode && (
						<button
							type="button"
							className="popup-item"
							onClick={() => {
								fileInputRef.current?.click();
								setMenuOpen(false);
							}}
						>
							<Icon icon="solar:upload-square-linear" width={14} />
							Upload
						</button>
					)}
					<a
						href={downloadUrl(path)}
						target="_blank"
						rel="noreferrer"
						className="popup-item"
						onClick={() => setMenuOpen(false)}
					>
						<Icon icon="solar:download-square-linear" width={14} />
						Download
					</a>
					{path !== "/" && !selectMode && (
						<button
							type="button"
							className="popup-item"
							onClick={() => {
								setRenameOpen(true);
								setMenuOpen(false);
							}}
						>
							<Icon icon="solar:pen-linear" width={14} />
							Rename
						</button>
					)}
					{path !== "/" && !selectMode && (
						<button
							type="button"
							className="popup-item text-danger"
							onClick={() => {
								setDeleteOpen(true);
								setMenuOpen(false);
							}}
						>
							<Icon icon="solar:trash-bin-2-linear" width={14} />
							Delete
						</button>
					)}
				</div>
			)}
		</div>
	);

	const sortedEntries = useMemo(
		() =>
			!isFile && data
				? [...data.entries].sort((a, b) => {
						if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
						const dir = sortDir === "asc" ? 1 : -1;
						if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
						if (sortKey === "size") return (a.size - b.size) * dir;
						return (
							(new Date(a.mod_time).getTime() -
								new Date(b.mod_time).getTime()) *
							dir
						);
					})
				: [],
		[data, isFile, sortKey, sortDir],
	);

	return (
		<div className="page-shell animate-fadeUp">
			<Breadcrumb path={path} onNavigate={navigate} />

			{error && <div className="error-box">Error: {error}</div>}

			<div className="flex-1">
				<div className="datatable-wrapper">
					<div className="file-list-header">
						<div className="toolbar-group">
							{selectMode ? (
								<>
									<input
										type="checkbox"
										className="select-checkbox"
										checked={
											!!data &&
											data.entries.length > 0 &&
											selected.size === data.entries.length
										}
										ref={(el) => {
											if (el)
												el.indeterminate =
													selected.size > 0 &&
													(!data || selected.size < data.entries.length);
										}}
										onChange={toggleSelectAll}
									/>
									<span className="select-action-count">
										{selected.size} selected
									</span>
									{selected.size > 0 && (
										<>
											<Button variant="ghost" onClick={handleBatchDownload}>
												<Icon icon="solar:download-square-linear" width={15} />
											</Button>
											<Button
												variant="danger"
												onClick={() => setBatchDeleteOpen(true)}
											>
												<Icon icon="solar:trash-bin-2-linear" width={15} />
											</Button>
										</>
									)}
								</>
							) : (
								path !== "/" && (
									<Button
										variant="ghost"
										onClick={() => navigate(parentOf(path))}
									>
										<Icon icon="solar:arrow-left-linear" width={15} />
									</Button>
								)
							)}
						</div>
						<div className="toolbar-group">
							{!isFile && viewMode === "gallery" && (
								<input
									type="range"
									className="zoom-slider"
									min={ZOOM_MIN}
									max={zoomMax}
									value={zoomMax + ZOOM_MIN - galleryCols}
									onChange={(e) =>
										setGalleryCols(zoomMax + ZOOM_MIN - Number(e.target.value))
									}
								/>
							)}
							{selectMode ? (
								<Button variant="ghost" onClick={exitSelectMode}>
									<Icon icon="solar:close-circle-linear" width={15} />
								</Button>
							) : (
								menuButton
							)}
						</div>
					</div>

					{uploadState && (() => {
						const pct = Math.round(((uploadState.index + uploadState.fileProgress) / uploadState.total) * 100);
						return (
							<div className="upload-status">
								<div className="upload-status-info">
									<span className="upload-status-name">{uploadState.current}</span>
									<span className="text-muted text-xs">
										{uploadState.index + 1}/{uploadState.total} · {pct}%
									</span>
								</div>
								<div className="upload-progress-bar">
									<div
										className="upload-progress-fill"
										style={{ width: `${pct}%` }}
									/>
								</div>
							</div>
						);
					})()}

					<div className="datatable-scroll">
						{isFile ? (
							<FilePreview path={path} />
						) : loading && !data ? (
							<div className="datatable-state">loading...</div>
						) : viewMode === "gallery" ? (
							sortedEntries.length === 0 ? (
								<div className="datatable-state">Empty directory.</div>
							) : (
								<GalleryView
									entries={sortedEntries}
									dirPath={path}
									onNavigate={navigate}
									cols={galleryCols}
									onColsChange={setGalleryCols}
									onZoomMaxChange={setZoomMax}
									selectMode={selectMode}
									selected={selected}
									onToggleSelect={toggleSelect}
								/>
							)
						) : sortedEntries.length === 0 ? (
							<div className="datatable-state">Empty directory.</div>
						) : (
							<div className="file-list">
								{sortedEntries.map((entry) => (
									<button
										key={entry.name}
										type="button"
										className={`file-list-item${selectMode && selected.has(entry.name) ? " selected" : ""}`}
										onClick={() =>
											selectMode
												? toggleSelect(entry.name)
												: navigate(joinPath(path, entry.name))
										}
									>
										{selectMode && (
											<input
												type="checkbox"
												className="select-checkbox"
												checked={selected.has(entry.name)}
												readOnly
											/>
										)}
										<Icon
											icon={
												entry.is_dir
													? "solar:folder-bold-duotone"
													: fileIcon(entry.name, false)
											}
											width={22}
											className={entry.is_dir ? "text-accent" : "text-muted"}
										/>
										<div className="file-list-info">
											<span className="file-list-name">{entry.name}</span>
											<span className="file-list-meta">
												{entry.mod_time && formatTime(entry.mod_time)}
												{!entry.is_dir && entry.mod_time && " · "}
												{!entry.is_dir && formatBytes(entry.size)}
											</span>
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			<input
				type="file"
				ref={fileInputRef}
				multiple
				style={{ display: "none" }}
				onChange={(e) => {
					if (e.target.files && e.target.files.length > 0) {
						handleUpload(e.target.files);
						e.target.value = "";
					}
				}}
			/>

			<RenameModal
				open={renameOpen}
				onClose={() => setRenameOpen(false)}
				initialName={baseName(path)}
				onRename={handleRename}
			/>

			<Modal open={deleteOpen} onClose={() => setDeleteOpen(false)}>
				<Modal.Header>Delete</Modal.Header>
				<Modal.Body>
					<p>
						Delete <strong>{baseName(path)}</strong>? This cannot be undone.
					</p>
					<div
						className="flex justify-end gap-2"
						style={{ marginTop: "0.75rem" }}
					>
						<Button variant="ghost" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDelete} disabled={deleting}>
							{deleting ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</Modal.Body>
			</Modal>

			<Modal open={batchDeleteOpen} onClose={() => setBatchDeleteOpen(false)}>
				<Modal.Header>Delete {selected.size} items</Modal.Header>
				<Modal.Body>
					<p>
						Delete <strong>{selected.size}</strong> selected item
						{selected.size > 1 ? "s" : ""}? This cannot be undone.
					</p>
					<div
						className="flex justify-end gap-2"
						style={{ marginTop: "0.75rem" }}
					>
						<Button variant="ghost" onClick={() => setBatchDeleteOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleBatchDelete}
							disabled={batchDeleting}
						>
							{batchDeleting ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</Modal.Body>
			</Modal>
		</div>
	);
}
