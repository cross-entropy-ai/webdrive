import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

const navItems = [
	{ path: "/", icon: "solar:monitor-linear", label: "Dashboard" },
	{ path: "/files", icon: "solar:folder-with-files-linear", label: "Files" },
];

export function Layout({ children }: { children: ReactNode }) {
	const [hostname, setHostname] = useState<string>("");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();

	const activeTab = location.pathname.startsWith("/files") ? "/files" : "/";

	useEffect(() => {
		fetch("/api/info")
			.then((r) => r.json())
			.then((d: { hostname: string }) => setHostname(d.hostname))
			.catch(() => setHostname(window.location.hostname));
	}, []);

	useEffect(() => {
		const onResize = () => {
			if (window.innerWidth >= 768) setSidebarOpen(false);
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

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
							key={item.path}
							type="button"
							className={`nav-item${activeTab === item.path ? " active" : ""}`}
							onClick={() => {
								navigate(item.path);
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
						<span className="text-xs text-muted">{hostname}</span>
					</div>
					<ThemeToggle />
				</header>
				<main className="layout-content">{children}</main>
			</div>
		</div>
	);
}
