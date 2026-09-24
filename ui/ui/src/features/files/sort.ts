import type { Entry, SortDirection, SortKey } from "./types";

export function sortEntries(
	entries: readonly Entry[],
	key: SortKey,
	direction: SortDirection,
): Entry[] {
	const sign = direction === "asc" ? 1 : -1;
	return [...entries].sort((a, b) => {
		if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
		if (key === "name") return a.name.localeCompare(b.name) * sign;
		if (key === "size") return (a.size - b.size) * sign;
		return (
			(new Date(a.mod_time).getTime() - new Date(b.mod_time).getTime()) * sign
		);
	});
}
