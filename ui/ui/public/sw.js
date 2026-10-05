// Keep file contents, API responses and authenticated pages on the network.
// The worker only provides a self-contained fallback for offline app navigation.
self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
	const request = event.request;
	const url = new URL(request.url);
	const scope = new URL(self.registration.scope);
	if (
		request.method !== "GET" ||
		request.mode !== "navigate" ||
		url.origin !== scope.origin ||
		!url.pathname.startsWith(scope.pathname) ||
		url.pathname.startsWith(`${scope.pathname}api/`)
	)
		return;

	event.respondWith(
		fetch(request).catch(
			() =>
				new Response(
					`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#4263eb"><title>Webdrive · Offline</title>
<style>body{font:17px system-ui,sans-serif;margin:0;min-height:100dvh;display:grid;place-items:center;background:#f8fafc;color:#172033}main{max-width:28rem;padding:2rem}p{line-height:1.6;color:#526079}a{display:inline-block;padding:.7rem 1rem;border-radius:.6rem;background:#4263eb;color:white;text-decoration:none}@media(prefers-color-scheme:dark){body{background:#111827;color:#f8fafc}p{color:#cbd5e1}}</style>
</head><body><main><h1>You're offline</h1><p>Webdrive needs a connection to your server to browse and manage files. Reconnect, then try again.</p><a href="">Try again</a></main></body></html>`,
					{
						status: 503,
						headers: {
							"Content-Type": "text/html; charset=utf-8",
							"Cache-Control": "no-store",
						},
					},
				),
		),
	);
});
