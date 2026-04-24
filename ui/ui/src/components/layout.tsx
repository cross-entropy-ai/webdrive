import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);
	if (!mounted) return <div className="w-4 h-4" />;

	const isDark = theme === "dark";
	return (
		<button
			type="button"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className="text-muted hover:text-foreground cursor-pointer flex items-center justify-center p-1 rounded-sm hover:bg-default/50 transition-colors"
			aria-label="Toggle theme"
		>
			<Icon icon={isDark ? "solar:sun-linear" : "solar:moon-linear"} width={14} />
		</button>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<div className="flex h-screen w-full bg-background overflow-hidden">
			{/* Mobile Sidebar Overlay */}
			{sidebarOpen && (
				<div 
					className="fixed inset-0 bg-black/50 z-30 md:hidden" 
					onClick={() => setSidebarOpen(false)} 
				/>
			)}

			{/* Sidebar */}
			<div className={`fixed inset-y-0 left-0 z-40 w-56 bg-sidebar border-r border-border transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
				<div className="flex flex-col h-full">
					<div className="h-10 border-b border-border px-4 flex items-center justify-between">
						<div>
							<span className="text-sm text-accent font-semibold">Vault</span>
							<span className="text-[10px] text-muted ml-2">v1.0.0</span>
						</div>
						<button type="button" className="md:hidden text-muted p-1" onClick={() => setSidebarOpen(false)}>
							<Icon icon="solar:close-circle-linear" width={16} />
						</button>
					</div>
					<div className="flex-1 overflow-y-auto py-4">
						<div className="px-4 mb-2">
							<div className="text-xs text-muted uppercase tracking-wider mb-2">System</div>
							<div className="flex items-center gap-2 px-2 py-1.5 text-sm text-accent bg-default/50 rounded-sm">
								<Icon icon="solar:folder-with-files-linear" width={14} />
								<span>File Browser</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 flex flex-col min-w-0">
				<header className="h-10 border-b border-border px-4 flex items-center justify-between shrink-0">
					<div className="flex items-center gap-2">
						<button type="button" className="md:hidden text-muted p-1" onClick={() => setSidebarOpen(true)}>
							<Icon icon="solar:hamburger-menu-linear" width={16} />
						</button>
						<div className="text-xs text-muted hidden md:block">localhost</div>
					</div>
					<div className="flex items-center gap-4">
						<ThemeToggle />
					</div>
				</header>
				<main className="flex-1 overflow-auto bg-background">
					{children}
				</main>
			</div>
		</div>
	);
}
