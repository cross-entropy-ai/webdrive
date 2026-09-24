import { useEffect, useState } from "react";
import type { SortDirection, SortKey, ViewMode } from "./types";

function usePreference<T extends string>(
	key: string,
	choices: readonly T[],
	fallback: T,
) {
	const [value, setValue] = useState<T>(() => {
		try {
			const stored = localStorage.getItem(key);
			return choices.includes(stored as T) ? (stored as T) : fallback;
		} catch {
			return fallback;
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* Browsing also works when storage is unavailable. */
		}
	}, [key, value]);
	return [value, setValue] as const;
}

export function useBrowserPreferences() {
	const [viewMode, setViewMode] = usePreference<ViewMode>(
		"webdrive.view",
		["list", "gallery"],
		"list",
	);
	const [sortKey, setSortKey] = usePreference<SortKey>(
		"webdrive.sort",
		["name", "size", "mod_time"],
		"name",
	);
	const [sortDir, setSortDir] = usePreference<SortDirection>(
		"webdrive.order",
		["asc", "desc"],
		"asc",
	);
	return { viewMode, setViewMode, sortKey, setSortKey, sortDir, setSortDir };
}
