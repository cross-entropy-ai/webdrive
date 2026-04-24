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
			<Icon
				icon={isDark ? "solar:sun-linear" : "solar:moon-linear"}
				width={14}
			/>
		</button>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	const [hostname, setHostname] = useState<string>("");
	const [root, setRoot] = useState<string>("");
	const [sidebarOpen, setSidebarOpen] = useState(false);

	useEffect(() => {
		fetch("/api/info")
			.then((r) => r.json())
			.then((d: { hostname: string; root: string }) => {
				setHostname(d.hostname);
				setRoot(d.root);
			})
			.catch(() => setHostname(window.location.hostname));
	}, []);

	// Close sidebar when resizing to desktop
	useEffect(() => {
		const onResize = () => {
			if (window.innerWidth >= 768) setSidebarOpen(false);
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	return (
		<div className="layout-container">
			{/* Mobile overlay */}
			{sidebarOpen && (
				<div
					className="sidebar-overlay"
					onClick={() => setSidebarOpen(false)}
					aria-hidden="true"
				/>
			)}

			{/* Sidebar */}
			<div className={`layout-sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
				<div className="layout-header">
					<div>
						<span className="text-accent font-semibold">webdrive</span>
					</div>
					{/* Close button — mobile only */}
					<button
						type="button"
						className="theme-toggle sidebar-close-btn"
						onClick={() => setSidebarOpen(false)}
						aria-label="Close sidebar"
					>
						<Icon icon="solar:close-circle-linear" width={16} />
					</button>
				</div>
				<div style={{ flex: 1, overflowY: "auto", padding: "1rem 0" }}>
					<div style={{ padding: "0 1rem", marginBottom: "0.5rem" }}>
						<div
							className="text-xs text-muted"
							style={{
								textTransform: "uppercase",
								letterSpacing: "0.05em",
								marginBottom: "0.5rem",
							}}
						>
							System
						</div>
						<div className="nav-item">
							<Icon icon="solar:folder-with-files-linear" width={14} />
							<span>File Browser</span>
						</div>
					</div>
				</div>
			</div>

			{/* Main */}
			<div className="layout-main">
				<header className="layout-header">
					<div className="flex items-center gap-2">
						{/* Hamburger — mobile only */}
						<button
							type="button"
							className="theme-toggle sidebar-menu-btn"
							onClick={() => setSidebarOpen(true)}
							aria-label="Open sidebar"
						>
							<Icon icon="solar:hamburger-menu-linear" width={16} />
						</button>
						<div className="text-xs text-muted">
								{hostname}{root ? ` : ${root}` : ""}
							</div>
					</div>
					<div className="flex items-center gap-4">
						<ThemeToggle />
					</div>
				</header>
				<main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
					{children}
				</main>
			</div>
		</div>
	);
}
