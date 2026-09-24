export type Entry = {
	name: string;
	is_dir: boolean;
	size: number;
	mod_time: string;
};

export type ListResponse = {
	path: string;
	entries: Entry[];
};

export type SortKey = "name" | "size" | "mod_time";
export type SortDirection = "asc" | "desc";
export type ViewMode = "list" | "gallery";
