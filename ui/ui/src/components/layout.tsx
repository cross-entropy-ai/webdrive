import { Icon } from "./icon";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { requestJSON } from "../lib/api";

function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);
	if (!mounted) return <div style={{ width: "1rem", height: "1rem" }} />;

	const isDark = resolvedTheme === "dark";
	return (
		<button
			type="button"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className="icon-btn"
			aria-label="Toggle theme"
		>
			<Icon
				icon={isDark ? "solar:sun-linear" : "solar:moon-linear"}
				width={19}
			/>
		</button>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	const [hostname, setHostname] = useState<string>("");

	useEffect(() => {
		requestJSON<{ hostname: string }>("/api/info")
			.then((d) => {
				setHostname(d.hostname);
				document.title = `Webdrive (${d.hostname})`;
			})
			.catch(() => setHostname(window.location.hostname));
	}, []);

	return (
		<div className="layout-container">
			<div className="layout-main">
				<header className="chrome-bar">
					<Link to="/" className="brand" aria-label="Webdrive home">
						<span className="brand-mark">
							<Icon icon="solar:folder-bold-duotone" width={23} />
						</span>
						<span>
							webdrive<span className="brand-dot">.</span>
						</span>
					</Link>
					<div className="chrome-actions">
						<span className="host-badge" title={hostname}>
							<span className="host-dot" />
							{hostname || "Your workspace"}
						</span>
						<span className="chrome-divider" />
						<ThemeToggle />
					</div>
				</header>
				<main className="layout-content">{children}</main>
			</div>
		</div>
	);
}
