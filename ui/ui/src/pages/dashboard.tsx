import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Button } from "../components/button";
import { type DataTableColumn, DataTable } from "../components/data-table";
import { Input } from "../components/input";
import { Modal } from "../components/modal";
import { PageShell } from "../components/pageshell";

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

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let n = bytes / 1024;
	let i = 0;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i += 1;
	}
	return `${n.toFixed(1)} ${units[i]}`;
}

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

function readPathFromHash(): string {
	const raw = location.hash.slice(1);
	if (!raw) return "/";
	try {
		return decodeURIComponent(raw);
	} catch {
		return "/";
	}
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

		const url = `/api/fs/preview?path=${encodeURIComponent(path)}`;
		fetch(url)
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

	// Cleanup blob URL
	useEffect(() => {
		return () => {
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	}, [blobUrl]);

	if (loading) {
		return <div className="datatable-state">loading...</div>;
	}
	if (error) {
		return <div className="datatable-state text-danger">{error}</div>;
	}

	const cat = mimeCategory(contentType);

	if (cat === "text" && content !== null) {
		return (
			<div className="preview-text">
				<pre>
					<code>{content}</code>
				</pre>
			</div>
		);
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
				Cannot preview this file type ({contentType}).{" "}
				<a
					href={`/api/fs/download?path=${encodeURIComponent(path)}`}
					className="text-accent"
				>
					Download instead
				</a>
			</span>
		</div>
	);
}

// ── Dashboard ─────────────────────────────────────────────────

export function Dashboard() {
	const [path, setPath] = useState<string>(readPathFromHash);
	const [data, setData] = useState<ListResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [isFile, setIsFile] = useState(false);

	// Modals
	const [pathModalOpen, setPathModalOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [renameName, setRenameName] = useState("");
	const [renameError, setRenameError] = useState<string | null>(null);
	const [renameLoading, setRenameLoading] = useState(false);

	useEffect(() => {
		const onHash = () => setPath(readPathFromHash());
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		setIsFile(false);
		fetch(`/api/fs/list?path=${encodeURIComponent(path)}`)
			.then(async (r) => {
				if (!r.ok) {
					const body = await r.json();
					// "not a directory" means it's a file
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

	const navigate = (p: string) => {
		location.hash = encodeURIComponent(p);
	};

	const handleRename = async () => {
		setRenameError(null);
		setRenameLoading(true);
		try {
			const r = await fetch("/api/fs/rename", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path, new_name: renameName }),
			});
			const body = await r.json();
			if (!r.ok) throw new Error(body.error ?? "rename failed");
			setRenameOpen(false);
			// Navigate to the renamed path
			const parent = parentOf(path);
			navigate(joinPath(parent, renameName));
		} catch (e: unknown) {
			setRenameError(e instanceof Error ? e.message : String(e));
		} finally {
			setRenameLoading(false);
		}
	};

	// ── File view ──
	if (isFile) {
		return (
			<PageShell
				title="File Browser"
				description="Manage and navigate your remote files."
			>
				<div className="h-full flex flex-col gap-4">
					<div className="flex items-center justify-between gap-4">
						<BreadcrumbButton
							path={path}
							onNavigate={navigate}
							pathModalOpen={pathModalOpen}
							setPathModalOpen={setPathModalOpen}
						/>
						<div className="flex items-center gap-2">
							<a
								href={`/api/fs/download?path=${encodeURIComponent(path)}`}
								target="_blank"
								rel="noreferrer"
							>
								<Button variant="ghost">
									<Icon icon="solar:download-square-linear" width={16} />
									Download
								</Button>
							</a>
							<Button variant="ghost" onClick={() => navigate(parentOf(path))}>
								<Icon icon="solar:arrow-left-linear" width={16} />
								Back
							</Button>
						</div>
					</div>

					{error && <div className="error-box">Error: {error}</div>}

					<div className="flex-1" style={{ minHeight: 0 }}>
						<div className="datatable-wrapper">
							<div className="datatable-header-bar">
								<span className="text-sm text-muted">{baseName(path)}</span>
							</div>
							<div className="datatable-scroll">
								<FilePreview path={path} />
							</div>
						</div>
					</div>
				</div>
			</PageShell>
		);
	}

	// ── Directory view ──
	type Row = Entry & { _isParent?: boolean };

	const rows: Row[] = [];
	if (path !== "/") {
		rows.push({
			name: "..",
			is_dir: true,
			size: 0,
			mod_time: "",
			_isParent: true,
		});
	}
	if (data) {
		const sorted = data.entries.sort((a, b) => {
			if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
		rows.push(...sorted);
	}

	const columns: DataTableColumn<Row>[] = [
		{
			key: "icon",
			label: "",
			width: "2rem",
			render: (row) => (
				<Icon
					icon={
						row._isParent
							? "solar:arrow-left-linear"
							: row.is_dir
								? "solar:folder-bold-duotone"
								: "solar:document-text-linear"
					}
					width={16}
					className={row.is_dir ? "text-accent" : "text-muted"}
				/>
			),
		},
		{
			key: "name",
			label: "Name",
			render: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "size",
			label: "Size",
			render: (row) => (
				<span className="text-muted">
					{row._isParent || row.is_dir ? "—" : formatSize(row.size)}
				</span>
			),
		},
		{
			key: "mod_time",
			label: "Modified",
			render: (row) => (
				<span className="text-muted">
					{row._isParent ? "—" : formatTime(row.mod_time)}
				</span>
			),
		},
	];

	const handleRowClick = (row: Row) => {
		if (row._isParent) {
			navigate(parentOf(path));
		} else {
			navigate(joinPath(path, row.name));
		}
	};

	return (
		<PageShell
			title="File Browser"
			description="Manage and navigate your remote files."
		>
			<div className="h-full flex flex-col gap-4">
				<div className="flex items-center justify-between gap-4">
					<BreadcrumbButton
						path={path}
						onNavigate={navigate}
						pathModalOpen={pathModalOpen}
						setPathModalOpen={setPathModalOpen}
					/>
					{path !== "/" && (
						<div className="flex items-center gap-2">
							<a
								href={`/api/fs/download?path=${encodeURIComponent(path)}`}
								target="_blank"
								rel="noreferrer"
							>
								<Button variant="ghost">
									<Icon icon="solar:download-square-linear" width={16} />
									Download
								</Button>
							</a>
							<Button
								variant="ghost"
								onClick={() => {
									setRenameName(baseName(path));
									setRenameError(null);
									setRenameOpen(true);
								}}
							>
								<Icon icon="solar:pen-linear" width={16} />
								Rename
							</Button>
						</div>
					)}
				</div>

				{error && <div className="error-box">Error: {error}</div>}

				<div className="flex-1" style={{ minHeight: 0 }}>
					<DataTable<Row>
						columns={columns}
						data={rows}
						keyExtractor={(row) => (row._isParent ? "__parent__" : row.name)}
						isLoading={loading && !data}
						emptyMessage="Empty directory."
						onRowClick={handleRowClick}
					/>
				</div>
			</div>

			<Modal open={renameOpen} onClose={() => setRenameOpen(false)}>
				<Modal.Header>Rename</Modal.Header>
				<Modal.Body>
					<form
						className="flex flex-col gap-4"
						onSubmit={(e) => {
							e.preventDefault();
							handleRename();
						}}
					>
						<Input
							value={renameName}
							onChange={(e) => setRenameName(e.target.value)}
							autoFocus
						/>
						{renameError && <div className="error-box">{renameError}</div>}
						<div className="flex items-center justify-between">
							<Button
								variant="ghost"
								type="button"
								onClick={() => setRenameOpen(false)}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								type="submit"
								disabled={renameLoading || !renameName.trim()}
							>
								{renameLoading ? "Renaming..." : "Rename"}
							</Button>
						</div>
					</form>
				</Modal.Body>
			</Modal>
		</PageShell>
	);
}

// ── Breadcrumb ────────────────────────────────────────────────

function BreadcrumbButton({
	path,
	onNavigate,
	pathModalOpen,
	setPathModalOpen,
}: {
	path: string;
	onNavigate: (p: string) => void;
	pathModalOpen: boolean;
	setPathModalOpen: (v: boolean) => void;
}) {
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
	const label = path === "/" ? "/" : `/ ${parts.join(" / ")}`;

	return (
		<>
			<button
				type="button"
				className="breadcrumb-btn"
				onClick={() => setPathModalOpen(true)}
			>
				<Icon
					icon="solar:folder-path-connect-linear"
					width={14}
					className="text-muted"
					style={{ flexShrink: 0 }}
				/>
				<span className="breadcrumb-label">{label}</span>
			</button>

			<Modal open={pathModalOpen} onClose={() => setPathModalOpen(false)}>
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
									setPathModalOpen(false);
								}}
							>
								<span
									className="text-muted"
									style={{ minWidth: `${i}rem`, display: "inline-block" }}
								/>
								<Icon
									icon={i === 0 ? "solar:home-linear" : "solar:folder-linear"}
									width={14}
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
