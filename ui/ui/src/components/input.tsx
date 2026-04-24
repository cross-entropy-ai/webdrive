import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			className={`w-full px-3 py-2 text-sm bg-background border border-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors ${className}`}
			{...props}
		/>
	);
}
