import { ThemeProvider } from "next-themes";
import { Layout } from "./components/layout";
import { Dashboard } from "./pages/dashboard";
import "./tailwind.css";

export function App() {
	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<Layout>
				<Dashboard />
			</Layout>
		</ThemeProvider>
	);
}

export default App;
