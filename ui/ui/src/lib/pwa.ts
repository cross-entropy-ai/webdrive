import { appUrl } from "./app-url";

// Resolve after the server's relative base is frozen. Bun must not fingerprint
// the manifest: its relative start URL and icons depend on this stable location.
export function configurePwa() {
	for (const [rel, path] of [
		["manifest", "manifest.webmanifest"],
		["apple-touch-icon", "icons/icon-180.png"],
	] as const) {
		const link = document.createElement("link");
		link.rel = rel;
		link.href = appUrl(path);
		if (rel === "manifest") link.crossOrigin = "use-credentials";
		document.head.append(link);
	}
}

export function registerServiceWorker() {
	if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
	void navigator.serviceWorker
		.register(appUrl("sw.js"), {
			scope: appUrl(""),
			updateViaCache: "none",
		})
		.catch((error: unknown) => {
			console.warn("Webdrive offline support could not start", error);
		});
}
