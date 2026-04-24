import type { ReactNode } from "react";

export function DataTable({ title, action, children }: { title?: ReactNode; action?: ReactNode; children: ReactNode }) {
	return (
		<div className="datatable-wrapper">
			{(title || action) && (
				<div className="datatable-header-bar">
					<div className="text-sm font-medium">{title}</div>
					<div>{action}</div>
				</div>
			)}
			<div className="datatable-scroll">
				<table className="datatable">
					{children}
				</table>
			</div>
		</div>
	);
}

export function DataTableHeader({ children }: { children: ReactNode }) {
	return (
		<thead>
			<tr>{children}</tr>
		</thead>
	);
}

export function DataTableHead({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <th className={className}>{children}</th>;
}

export function DataTableBody({ children, isEmpty }: { children: ReactNode; isEmpty?: boolean }) {
	if (isEmpty) {
		return (
			<tbody>
				<tr>
					<td colSpan={100} style={{ padding: "2rem 1rem", textAlign: "center" }} className="text-muted text-sm">
						{children}
					</td>
				</tr>
			</tbody>
		);
	}
	return <tbody>{children}</tbody>;
}

export function DataTableRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
	return (
		<tr
			onClick={onClick}
			className={onClick ? "interactive" : ""}
		>
			{children}
		</tr>
	);
}

export function DataTableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <td className={className}>{children}</td>;
}
