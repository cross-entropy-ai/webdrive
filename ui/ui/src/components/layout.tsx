import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);
	if (!mounted) return <div style={{ width: "1rem", height: "1rem" }} />;

	const isDark = theme === "dark";
	return (
		<button
			type="button"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className="theme-toggle"
			aria-label="Toggle theme"
		>
			<Icon icon={isDark ? "solar:sun-linear" : "solar:moon-linear"} width={14} />
		</button>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="layout-container">
			<div className="layout-sidebar">
				<div className="layout-header">
					<div>
						<span className="text-sm text-accent font-semibold">Vault</span>
						<span style={{ fontSize: "10px", marginLeft: "0.5rem" }} className="text-muted">v1.0.0</span>
					</div>
				</div>
				<div style={{ flex: 1, overflowY: "auto", padding: "1rem 0" }}>
					<div style={{ padding: "0 1rem", marginBottom: "0.5rem" }}>
						<div className="text-xs text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>System</div>
						<div className="nav-item">
							<Icon icon="solar:folder-with-files-linear" width={14} />
							<span>File Browser</span>
						</div>
					</div>
				</div>
			</div>

			<div className="layout-main">
				<header className="layout-header">
					<div className="flex items-center gap-2">
						<div className="text-xs text-muted">localhost</div>
					</div>
					<div className="flex items-center gap-4">
						<ThemeToggle />
					</div>
				</header>
				<main style={{ flex: 1 }}>
					{children}
				</main>
			</div>
		</div>
	);
}
