import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "ghost" | "danger" | "outline";
}

export function Button({ variant = "outline", className = "", ...props }: ButtonProps) {
	const base = "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm transition-all disabled:opacity-40 cursor-pointer";
	const variants = {
		primary: "text-accent hover:bg-accent/15",
		ghost: "text-muted hover:text-accent hover:bg-accent/10",
		danger: "text-muted hover:text-danger hover:bg-danger/10",
		outline: "border border-border text-muted hover:text-foreground hover:border-foreground/30",
	};

	return (
		<button className={`${base} ${variants[variant]} ${className}`} {...props} />
	);
}
