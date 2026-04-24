import type { ReactNode } from "react";

export function DataTable({ title, action, children }: { title?: ReactNode; action?: ReactNode; children: ReactNode }) {
	return (
		<div className="border border-border h-full flex flex-col overflow-hidden bg-background">
			{(title || action) && (
				<div className="px-4 py-3 border-b border-border flex items-center justify-between">
					<div className="text-sm font-medium">{title}</div>
					<div>{action}</div>
				</div>
			)}
			<div className="flex-1 overflow-auto">
				<table className="w-full text-left border-collapse">
					{children}
				</table>
			</div>
		</div>
	);
}

export function DataTableHeader({ children }: { children: ReactNode }) {
	return (
		<thead className="sticky top-0 z-10 bg-surface">
			<tr>{children}</tr>
		</thead>
	);
}

export function DataTableHead({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <th className={`px-4 py-2 text-sm text-muted font-normal border-b border-border ${className}`}>{children}</th>;
}

export function DataTableBody({ children, isEmpty }: { children: ReactNode; isEmpty?: boolean }) {
	if (isEmpty) {
		return (
			<tbody>
				<tr>
					<td colSpan={100} className="px-4 py-8 text-center text-muted text-sm">
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
			className={`border-b border-border/50 hover:bg-default/40 transition-colors ${onClick ? "cursor-pointer" : ""}`}
		>
			{children}
		</tr>
	);
}

export function DataTableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <td className={`px-4 py-2.5 text-sm whitespace-nowrap ${className}`}>{children}</td>;
}
