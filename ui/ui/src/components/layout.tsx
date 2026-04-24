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

export type Tab = "dashboard" | "file-browser";

export function Layout({
	tab,
	onTabChange,
	children,
}: {
	tab: Tab;
	onTabChange: (t: Tab) => void;
	children: ReactNode;
}) {
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

	useEffect(() => {
		const onResize = () => {
			if (window.innerWidth >= 768) setSidebarOpen(false);
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const navItems: { id: Tab; icon: string; label: string }[] = [
		{ id: "dashboard", icon: "solar:monitor-linear", label: "Dashboard" },
		{ id: "file-browser", icon: "solar:folder-with-files-linear", label: "File Browser" },
	];

	return (
		<div className="layout-container">
			{sidebarOpen && (
				<div
					className="sidebar-overlay"
					onClick={() => setSidebarOpen(false)}
					aria-hidden="true"
				/>
			)}

			<div className={`layout-sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
				<div className="chrome-bar">
					<span className="text-accent font-semibold">webdrive</span>
					<button
						type="button"
						className="icon-btn sidebar-close-btn"
						onClick={() => setSidebarOpen(false)}
						aria-label="Close sidebar"
					>
						<Icon icon="solar:close-circle-linear" width={14} />
					</button>
				</div>
				<div className="sidebar-body">
					<div className="nav-section-label">System</div>
					{navItems.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`nav-item${tab === item.id ? " active" : ""}`}
							onClick={() => {
								onTabChange(item.id);
								setSidebarOpen(false);
							}}
						>
							<Icon icon={item.icon} width={14} />
							<span>{item.label}</span>
						</button>
					))}
				</div>
			</div>

			<div className="layout-main">
				<header className="chrome-bar">
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="icon-btn sidebar-menu-btn"
							onClick={() => setSidebarOpen(true)}
							aria-label="Open sidebar"
						>
							<Icon icon="solar:hamburger-menu-linear" width={14} />
						</button>
						<span className="text-xs text-muted">
							{hostname}{root ? ` : ${root}` : ""}
						</span>
					</div>
					<ThemeToggle />
				</header>
				<main className="layout-content">
					{children}
				</main>
			</div>
		</div>
	);
}
