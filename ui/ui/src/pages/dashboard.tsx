import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Button } from "../components/button";
import {
	DataTable,
	DataTableBody,
	DataTableCell,
	DataTableHead,
	DataTableHeader,
	DataTableRow,
} from "../components/datatable";
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
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
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
	if (dir === "/" || dir === "") return "/" + name;
	return dir.replace(/\/+$/, "") + "/" + name;
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
			.then((d) => {
				if (!cancelled) setData(d);
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
		setSearch(""); // clear search on navigate
	};

	const sortedEntries = data
		? [...data.entries]
				.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
				.sort((a, b) => {
					if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
					return a.name.localeCompare(b.name);
				})
		: [];

	const Breadcrumbs = () => {
		const parts = path.split("/").filter(Boolean);
		let acc = "";
		const crumbs = [{ name: "/", path: "/" }];
		for (const p of parts) {
			acc += "/" + p;
			crumbs.push({ name: p, path: acc });
		}
		return (
			<div className="flex items-center gap-2 text-sm">
				{crumbs.map((c, i) => (
					<div key={i} className="flex items-center gap-2">
						{i > 0 && <span className="text-muted/50">/</span>}
						<button
							type="button"
							onClick={() => navigate(c.path)}
							className="text-muted hover:text-accent transition-colors cursor-pointer"
						>
							{c.name}
						</button>
					</div>
				))}
			</div>
		);
	};

	return (
		<PageShell 
			title="File Browser" 
			description="Manage and navigate your remote files."
		>
			<div className="h-full flex flex-col gap-4">
				<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
					<Breadcrumbs />
					<div className="w-full sm:w-64 shrink-0">
						<Input 
							placeholder="Filter files..." 
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
				</div>

				{error && (
					<div className="p-3 text-xs text-danger border border-danger/30 rounded-sm bg-danger/5">
						Error: {error}
					</div>
				)}

				<div className="flex-1 min-h-0">
					<DataTable>
						<DataTableHeader>
							<DataTableHead className="w-8"></DataTableHead>
							<DataTableHead>Name</DataTableHead>
							<DataTableHead>Size</DataTableHead>
							<DataTableHead>Modified</DataTableHead>
							<DataTableHead className="text-right">Actions</DataTableHead>
						</DataTableHeader>
						<DataTableBody isEmpty={sortedEntries.length === 0 && !loading && path === "/"}>
							{loading && !data && "Loading directory contents..."}
							{!loading && data && sortedEntries.length === 0 && "No files found."}

							{path !== "/" && !search && (
								<DataTableRow onClick={() => navigate(parentOf(path))}>
									<DataTableCell>
										<Icon icon="solar:menu-dots-square-linear" width={16} className="text-muted" />
									</DataTableCell>
									<DataTableCell className="font-medium">..</DataTableCell>
									<DataTableCell className="text-muted">-</DataTableCell>
									<DataTableCell className="text-muted">-</DataTableCell>
									<DataTableCell />
								</DataTableRow>
							)}

							{sortedEntries.map((e) => {
								const child = joinPath(path, e.name);
								const isDir = e.is_dir;
								return (
									<DataTableRow key={e.name} onClick={() => isDir ? navigate(child) : undefined}>
										<DataTableCell>
											<Icon 
												icon={isDir ? "solar:folder-bold-duotone" : "solar:document-text-linear"} 
												width={16} 
												className={isDir ? "text-accent" : "text-muted"} 
											/>
										</DataTableCell>
										<DataTableCell className="font-medium">{e.name}</DataTableCell>
										<DataTableCell className="text-muted">{isDir ? "-" : formatSize(e.size)}</DataTableCell>
										<DataTableCell className="text-muted">{formatTime(e.mod_time)}</DataTableCell>
										<DataTableCell className="text-right">
											{!isDir && (
												<a 
													href={`/api/download?path=${encodeURIComponent(child)}`}
													target="_blank" 
													rel="noreferrer"
													onClick={(ev) => ev.stopPropagation()}
												>
													<Button variant="ghost">
														<Icon icon="solar:download-square-linear" width={16} />
														Download
													</Button>
												</a>
											)}
										</DataTableCell>
									</DataTableRow>
								);
							})}
						</DataTableBody>
					</DataTable>
				</div>
			</div>
		</PageShell>
	);
}
