import { useEffect, useState } from "react";

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
	return d.toLocaleString();
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

export function FileBrowser() {
	const [path, setPath] = useState<string>(readPathFromHash);
	const [data, setData] = useState<ListResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

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
	};

	const crumbs: { name: string; path: string }[] = [{ name: "/", path: "/" }];
	const parts = path.split("/").filter(Boolean);
	let acc = "";
	for (const p of parts) {
		acc += "/" + p;
		crumbs.push({ name: p, path: acc });
	}

	const sortedEntries = data
		? [...data.entries].sort((a, b) => {
				if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
				return a.name.localeCompare(b.name);
			})
		: [];

	return (
		<div className="browser">
			<nav className="crumbs" aria-label="breadcrumbs">
				{crumbs.map((c, i) => (
					<span key={i} className="crumb">
						{i > 0 && <span className="sep">/</span>}
						<button type="button" onClick={() => navigate(c.path)}>
							{c.name}
						</button>
					</span>
				))}
			</nav>

			{loading && <div className="status">Loading…</div>}
			{error && <div className="status error">{error}</div>}

			{data && (
				<ul className="entries">
					{path !== "/" && (
						<li className="entry dir">
							<button type="button" onClick={() => navigate(parentOf(path))}>
								<span className="icon" aria-hidden>
									↩
								</span>
								<span className="name">..</span>
							</button>
						</li>
					)}
					{sortedEntries.map((e) => {
						const child = joinPath(path, e.name);
						if (e.is_dir) {
							return (
								<li key={e.name} className="entry dir">
									<button type="button" onClick={() => navigate(child)}>
										<span className="icon" aria-hidden>
											📁
										</span>
										<span className="name">{e.name}</span>
										<span className="meta">{formatTime(e.mod_time)}</span>
									</button>
								</li>
							);
						}
						return (
							<li key={e.name} className="entry file">
								<a href={`/api/download?path=${encodeURIComponent(child)}`}>
									<span className="icon" aria-hidden>
										📄
									</span>
									<span className="name">{e.name}</span>
									<span className="size">{formatSize(e.size)}</span>
									<span className="meta">{formatTime(e.mod_time)}</span>
								</a>
							</li>
						);
					})}
					{sortedEntries.length === 0 && (
						<li className="empty">empty directory</li>
					)}
				</ul>
			)}
		</div>
	);
}
