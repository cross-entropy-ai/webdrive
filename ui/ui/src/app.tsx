import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout";
import { FileBrowser } from "./pages/file-browser";
import "./index.css";

export function App() {
	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<BrowserRouter>
				<Layout>
					<Routes>
						<Route path="/*" element={<FileBrowser />} />
					</Routes>
				</Layout>
			</BrowserRouter>
		</ThemeProvider>
	);
}

export default App;
