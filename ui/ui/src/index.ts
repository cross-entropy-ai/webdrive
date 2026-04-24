import { serve } from "bun";
import index from "./index.html";

const backend = process.env.WEBDRIVE_BACKEND ?? "http://localhost:8080";

const server = serve({
	routes: {
		"/api/*": async (req) => {
			const url = new URL(req.url);
			const target = backend + url.pathname + url.search;
			return fetch(target, {
				method: req.method,
				headers: req.headers,
				body: req.body,
			});
		},
		"/*": index,
	},

	development: process.env.NODE_ENV !== "production" && {
		hmr: true,
		console: true,
	},
});

console.log(`🚀 UI dev server at ${server.url} (proxying /api -> ${backend})`);
