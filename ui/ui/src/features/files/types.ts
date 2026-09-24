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

export type SearchEntry = {
	name: string;
	path: string;
	relative_path: string;
	is_dir: boolean;
};

export type SearchResponse = {
	entries: SearchEntry[];
	has_more: boolean;
	partial: boolean;
};

export type SearchProgress = SearchResponse & { done: boolean };

export type SortKey = "name" | "size" | "mod_time";
export type SortDirection = "asc" | "desc";
export type ViewMode = "list" | "gallery";
