import { serve } from "bun";
import index from "./index.html";

const backend = process.env.WEBDRIVE_BACKEND ?? "http://localhost:9090";
const wsBackend = backend.replace(/^http/, "ws");

const server = serve({
	routes: {
		"/api/*": async (req) => {
			// WebSocket upgrade — proxy to backend
			if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
				const url = new URL(req.url);
				const target = wsBackend + url.pathname + url.search;
				const ws = new WebSocket(target);
				return new Response(null, {
					status: 101,
					webSocket: ws,
				} as any);
			}
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

console.log(`UI dev server at ${server.url} (proxying /api -> ${backend})`);
