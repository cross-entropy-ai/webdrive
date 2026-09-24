import { FilenameMatch } from "./filename-match";
import { Icon } from "../../components/icon";
import { formatBytes, formatTime } from "../../lib/format";
import { fileIcon, mediaTypeFromName, previewKind } from "./file-types";
import { joinPath } from "./path";
import type { Entry, SortDirection, SortKey } from "./types";

export function FileColumns({
	selecting,
	gallery = false,
	searching = false,
	sortKey,
	sortDir,
	onSort,
}: {
	selecting: boolean;
	gallery?: boolean;
	searching?: boolean;
	sortKey: SortKey;
	sortDir: SortDirection;
	onSort: (key: SortKey) => void;
}) {
	if (gallery || searching)
		return (
			<div className="file-columns file-columns-summary">
				<span>{searching ? "Best filename matches" : "Gallery"}</span>
			</div>
		);
	return (
		<div className={`file-columns${selecting ? " selecting" : ""}`}>
			{(
				[
					["name", "Name"],
					["mod_time", "Modified"],
					["size", "Size"],
				] as const
			).map(([key, label]) => (
				<button
					key={key}
					className={`column-${key}`}
					onClick={() => onSort(key)}
					aria-label={`Sort by ${label}${sortKey === key ? `, ${sortDir === "asc" ? "ascending" : "descending"}` : ""}`}
				>
					{label}
					{sortKey === key && (
						<span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>
					)}
				</button>
			))}
		</div>
	);
}

export function FileList({
	query = "",
	entries,
	path,
	selectMode,
	selected,
	onSelect,
	onNavigate,
}: {
	entries: Entry[];
	query?: string;
	path: string;
	selectMode: boolean;
	selected: Set<string>;
	onSelect: (name: string) => void;
	onNavigate: (path: string) => void;
}) {
	return (
		<div className="file-list">
			{entries.map((entry) => {
				const type = entry.is_dir
					? "folder"
					: (mediaTypeFromName(entry.name) ??
						(previewKind(entry.name) === "binary" ? "archive" : "document"));
				return (
					<button
						key={entry.name}
						type="button"
						title={entry.name}
						aria-label={entry.name}
						aria-pressed={selectMode ? selected.has(entry.name) : undefined}
						className={`file-list-item${selectMode && selected.has(entry.name) ? " selected" : ""}`}
						onClick={() =>
							selectMode
								? onSelect(entry.name)
								: onNavigate(joinPath(path, entry.name))
						}
					>
						{selectMode && (
							<span
								className={`selection-mark${selected.has(entry.name) ? " checked" : ""}`}
								aria-hidden="true"
							>
								{selected.has(entry.name) && "✓"}
							</span>
						)}
						<span className={`file-type-icon type-${type}`}>
							<Icon
								icon={
									type === "archive"
										? "solar:archive-linear"
										: fileIcon(entry.name, entry.is_dir)
								}
								width={22}
							/>
						</span>
						<span className="file-list-info">
							<span className="file-list-name">
								<FilenameMatch name={entry.name} query={query} />
							</span>
							<span className="file-list-meta">
								{entry.mod_time && formatTime(entry.mod_time)}
								{!entry.is_dir && entry.mod_time && " · "}
								{!entry.is_dir && formatBytes(entry.size)}
							</span>
						</span>
						<span className="file-date">
							{entry.mod_time ? formatTime(entry.mod_time) : "—"}
						</span>
						<span className="file-size">
							{entry.is_dir ? "—" : formatBytes(entry.size)}
						</span>
						<Icon
							className="file-chevron"
							icon="solar:alt-arrow-right-linear"
							width={16}
						/>
					</button>
				);
			})}
		</div>
	);
}
