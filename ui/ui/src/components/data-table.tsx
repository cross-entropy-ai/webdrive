import type React from "react";

export interface DataTableColumn<T> {
	key: string;
	label: string;
	width?: string;
	render?: (row: T) => React.ReactNode;
	onSort?: () => void;
	sortDir?: "asc" | "desc";
}

interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	data: T[];
	keyExtractor: (row: T) => string;
	title?: React.ReactNode;
	headerAction?: React.ReactNode;
	actions?: (row: T) => React.ReactNode;
	emptyMessage?: string;
	isLoading?: boolean;
	onRowClick?: (row: T) => void;
}

export function DataTable<T>({
	columns,
	data,
	keyExtractor,
	title,
	headerAction,
	actions,
	emptyMessage = "No entries.",
	isLoading = false,
	onRowClick,
}: DataTableProps<T>) {
	const showEmpty = !isLoading && data.length === 0;

	return (
		<div className="datatable-wrapper">
			{(title || headerAction) && (
				<div className="datatable-header-bar">
					<div>{title}</div>
					<div>{headerAction}</div>
				</div>
			)}

			<div className="datatable-scroll">
				{isLoading ? (
					<div className="datatable-state">loading...</div>
				) : showEmpty ? (
					<div className="datatable-state">{emptyMessage}</div>
				) : (
					<table className="datatable">
						<thead>
							<tr>
								{columns.map((col) => (
									<th
										key={col.key}
										style={{ width: col.width }}
										className={col.onSort ? "sortable" : ""}
										onClick={col.onSort}
									>
										<span className="th-content">
											{col.label}
											{col.sortDir === "asc" && (
												<span className="sort-indicator">↑</span>
											)}
											{col.sortDir === "desc" && (
												<span className="sort-indicator">↓</span>
											)}
										</span>
									</th>
								))}
								{actions && <th style={{ width: "1px" }} />}
							</tr>
						</thead>
						<tbody>
							{data.map((row) => (
								<tr
									key={keyExtractor(row)}
									className={onRowClick ? "interactive" : ""}
									onClick={() => onRowClick?.(row)}
								>
									{columns.map((col) => (
										<td key={col.key}>
											{col.render
												? col.render(row)
												: String(
														(row as Record<string, unknown>)[col.key] ?? "",
													)}
										</td>
									))}
									{actions && (
										<td className="actions-cell">
											<div className="actions-cell-inner">{actions(row)}</div>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
