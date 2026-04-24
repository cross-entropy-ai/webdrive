import type { ReactNode } from "react";

export function PageShell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
	return (
		<div className="page-shell animate-fadeUp">
			<div>
				<h1 className="text-lg text-accent font-medium">{title}</h1>
				{description && <p className="text-sm text-muted" style={{ marginTop: "0.125rem" }}>{description}</p>}
			</div>
			<div className="page-content">
				{children}
			</div>
		</div>
	);
}
