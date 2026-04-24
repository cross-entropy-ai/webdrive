import type { ReactNode } from "react";

export function PageShell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
	return (
		<div className="p-4 md:p-6 h-full flex flex-col gap-4 animate-[fadeUp_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
			<div>
				<h1 className="text-lg text-accent font-medium">{title}</h1>
				{description && <p className="text-sm text-muted mt-0.5">{description}</p>}
			</div>
			<div className="flex-1 min-h-0">
				{children}
			</div>
		</div>
	);
}
