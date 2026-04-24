import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Button } from "../components/button";
import { type DataTableColumn, DataTable } from "../components/data-table";
import { Input } from "../components/input";
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

export function Dashboard() {
	const [path, setPath] = useState<string>(readPathFromHash);
	const [data, setData] = useState<ListResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");

	useEffect(() => {
		const onHash = () => setPath(readPathFromHash());
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		fetch(`/api/list?path=${encodeURIComponent(path)}`)
			.then(async (r) => {
				if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
				return (await r.json()) as ListResponse;
			})
			.then((d) => { if (!cancelled) setData(d); })
			.catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [path]);

	const navigate = (p: string) => {
		location.hash = encodeURIComponent(p);
		setSearch("");
	};

	// Build row list: optional ".." entry + sorted filtered entries
	type Row = Entry & { _isParent?: boolean };

	const rows: Row[] = [];
	if (path !== "/" && !search) {
		rows.push({ name: "..", is_dir: true, size: 0, mod_time: "", _isParent: true });
	}
	if (data) {
		const filtered = data.entries
			.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
			.sort((a, b) => {
				if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
		rows.push(...filtered);
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
		} else if (row.is_dir) {
			navigate(joinPath(path, row.name));
		}
	};

	const Breadcrumbs = () => {
		const parts = path.split("/").filter(Boolean);
		let acc = "";
		const segments = parts.map((p) => {
			acc += `/${p}`;
			return { name: p, path: acc };
		});

		return (
			<div className="flex items-center gap-2 text-sm">
				<button
					type="button"
					onClick={() => navigate("/")}
					className="text-muted cursor-pointer"
					style={{ background: "transparent", border: "none" }}
				>
					/
				</button>
				{segments.map((c) => (
					<div key={c.path} className="flex items-center gap-2">
						<span className="text-muted">/</span>
						<button
							type="button"
							onClick={() => navigate(c.path)}
							className="text-muted cursor-pointer"
							style={{ background: "transparent", border: "none" }}
						>
							{c.name}
						</button>
					</div>
				))}
			</div>
		);
	};

	return (
		<PageShell title="File Browser" description="Manage and navigate your remote files.">
			<div className="h-full flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<Breadcrumbs />
					<div className="search-wrapper">
						<Input
							placeholder="Filter files..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
				</div>

				{error && <div className="error-box">Error: {error}</div>}

				<div className="flex-1" style={{ minHeight: 0 }}>
					<DataTable<Row>
						columns={columns}
						data={rows}
						keyExtractor={(row) => row._isParent ? "__parent__" : row.name}
						isLoading={loading && !data}
						emptyMessage="Empty directory."
						onRowClick={handleRowClick}
						actions={(row) =>
							!row._isParent && !row.is_dir ? (
								<a
									href={`/api/download?path=${encodeURIComponent(joinPath(path, row.name))}`}
									target="_blank"
									rel="noreferrer"
									onClick={(ev) => ev.stopPropagation()}
								>
									<Button variant="ghost">
										<Icon icon="solar:download-square-linear" width={16} />
										Download
									</Button>
								</a>
							) : null
						}
					/>
				</div>
			</div>
		</PageShell>
	);
}
