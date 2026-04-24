import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Layout, type Tab } from "./components/layout";
import { Dashboard } from "./pages/dashboard";
import { FileBrowser } from "./pages/file-browser";
import "./index.css";

export function App() {
	const [tab, setTab] = useState<Tab>("dashboard");

	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<Layout tab={tab} onTabChange={setTab}>
				{tab === "dashboard" && <Dashboard />}
				{tab === "file-browser" && <FileBrowser />}
			</Layout>
		</ThemeProvider>
	);
}

export default App;
