import { ThemeProvider } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { Layout, type Tab } from "./components/layout";
import { Dashboard } from "./pages/dashboard";
import { FileBrowser } from "./pages/file-browser";
import "./index.css";

function readURL(): { tab: Tab; path: string } {
	const params = new URLSearchParams(window.location.search);
	const tab = (params.get("tab") as Tab) || "dashboard";
	const path = params.get("path") || "/";
	return { tab: tab === "file-browser" ? "file-browser" : "dashboard", path };
}

function pushURL(tab: Tab, path?: string) {
	const params = new URLSearchParams();
	if (tab !== "dashboard") params.set("tab", tab);
	if (tab === "file-browser" && path && path !== "/") params.set("path", path);
	const qs = params.toString();
	const url = qs ? `?${qs}` : "/";
	window.history.pushState(null, "", url);
}

export function App() {
	const initial = readURL();
	const [tab, setTab] = useState<Tab>(initial.tab);
	const [filePath, setFilePath] = useState<string>(initial.path);

	const handleTabChange = useCallback(
		(t: Tab) => {
			setTab(t);
			pushURL(t, t === "file-browser" ? filePath : undefined);
		},
		[filePath],
	);

	const handlePathChange = useCallback((p: string) => {
		setFilePath(p);
		pushURL("file-browser", p);
	}, []);

	useEffect(() => {
		const onPop = () => {
			const s = readURL();
			setTab(s.tab);
			setFilePath(s.path);
		};
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);

	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<Layout tab={tab} onTabChange={handleTabChange}>
				{tab === "dashboard" && <Dashboard />}
				{tab === "file-browser" && (
					<FileBrowser path={filePath} onNavigate={handlePathChange} />
				)}
			</Layout>
		</ThemeProvider>
	);
}

export default App;
