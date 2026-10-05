import { serve } from "bun";
import index from "./index.html";

const backend = process.env.WEBDRIVE_BACKEND ?? "http://localhost:9090";

const server = serve({
	routes: {
		"/manifest.webmanifest": () =>
			new Response(Bun.file("public/manifest.webmanifest"), {
				headers: {
					"Content-Type": "application/manifest+json",
					"Cache-Control": "no-cache",
				},
			}),
		"/sw.js": () =>
			new Response(Bun.file("public/sw.js"), {
				headers: {
					"Content-Type": "text/javascript",
					"Cache-Control": "no-cache",
				},
			}),
		"/icons/:name": async (req) => {
			if (!/^icon-(180|192|512)\.png$/.test(req.params.name)) {
				return new Response(null, { status: 404 });
			}
			const file = Bun.file(`public/icons/${req.params.name}`);
			return (await file.exists())
				? new Response(file)
				: new Response(null, { status: 404 });
		},
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

console.log(`UI dev server at ${server.url} (proxying /api -> ${backend})`);
