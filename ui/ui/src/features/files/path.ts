export function joinPath(dir: string, name: string): string {
	if (dir === "/" || dir === "") return `/${name}`;
	return `${dir.replace(/\/+$/, "")}/${name}`;
}

export function parentOf(p: string): string {
	if (p === "/" || p === "") return "/";
	const idx = p.replace(/\/+$/, "").lastIndexOf("/");
	if (idx <= 0) return "/";
	return p.slice(0, idx);
}

export function baseName(p: string): string {
	const parts = p.replace(/\/+$/, "").split("/");
	return parts[parts.length - 1] || "/";
}
