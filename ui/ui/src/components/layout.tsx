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
			className="icon-btn"
			aria-label="Toggle theme"
		>
			<Icon
				icon={isDark ? "solar:sun-linear" : "solar:moon-linear"}
				width={14}
			/>
		</button>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	const [hostname, setHostname] = useState<string>("");

	useEffect(() => {
		fetch("/api/info")
			.then((r) => r.json())
			.then((d: { hostname: string }) => setHostname(d.hostname))
			.catch(() => setHostname(window.location.hostname));
	}, []);

	return (
		<div className="layout-container">
			<div className="layout-main">
				<header className="chrome-bar">
					<div className="flex items-center gap-2">
						<Icon
							icon="solar:folder-with-files-linear"
							width={14}
							className="text-muted"
						/>
						<span className="text-accent font-semibold">webdrive</span>
						<span className="text-xs text-muted">{hostname}</span>
					</div>
					<ThemeToggle />
				</header>
				<main className="layout-content">{children}</main>
			</div>
		</div>
	);
}
