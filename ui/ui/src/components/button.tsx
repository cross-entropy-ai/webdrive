import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "ghost" | "danger" | "outline";
}

export function Button({ variant = "outline", className = "", ...props }: ButtonProps) {
	return (
		<button className={`btn btn-${variant} ${className}`} {...props} />
	);
}
