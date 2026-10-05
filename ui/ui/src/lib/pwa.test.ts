import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// lib is inside src; public is alongside src.
const asset = (name: string) =>
	new URL(`../../public/${name}`, import.meta.url);
const worker = readFileSync(asset("sw.js"), "utf8");

function createWorker(scope: string, fetcher: typeof fetch) {
	const listeners: Record<string, (event: any) => void> = {};
	runInNewContext(worker, {
		self: {
			registration: { scope },
			addEventListener: (name: string, listener: (event: any) => void) => {
				listeners[name] = listener;
			},
		},
		URL,
		Response,
		fetch: fetcher,
	});
	return (url: string, mode = "navigate", method = "GET") => {
		let response: Promise<Response> | undefined;
		listeners.fetch!({
			request: { url, mode, method },
			respondWith: (value: Promise<Response>) => {
				response = value;
			},
		});
		return response;
	};
}

test("PWA has installable icons and stays inside each proxy mount", () => {
	const manifest = JSON.parse(
		readFileSync(asset("manifest.webmanifest"), "utf8"),
	);
	expect(manifest.display).toBe("standalone");
	for (const mount of ["/", "/proxy/9090/"]) {
		const url = `https://example.com${mount}manifest.webmanifest`;
		for (const key of ["id", "start_url", "scope"]) {
			expect(new URL(manifest[key], url).pathname).toBe(mount);
		}
		for (const size of [192, 512]) {
			const icon = manifest.icons.find(
				(entry: { sizes: string }) => entry.sizes === `${size}x${size}`,
			);
			expect(new URL(icon.src, url).pathname).toBe(
				`${mount}icons/icon-${size}.png`,
			);
			const png = readFileSync(asset(icon.src));
			expect(png.readUInt32BE(16)).toBe(size);
			expect(png.readUInt32BE(20)).toBe(size);
		}
	}
});

test("worker passes online navigation through and offers an offline retry page", async () => {
	for (const mount of ["/", "/proxy/9090/"]) {
		const scope = `https://example.com${mount}`;
		const online = new Response("current server page");
		const handleOnline = createWorker(
			scope,
			(async () => online) as unknown as typeof fetch,
		);
		expect(await handleOnline(`${scope}docs/nested`)).toBe(online);
		const handleOffline = createWorker(scope, (async () => {
			throw new Error("offline");
		}) as unknown as typeof fetch);
		const response = await handleOffline(`${scope}docs/nested`);
		expect(response?.status).toBe(503);
		expect(response?.headers.get("Cache-Control")).toBe("no-store");
		expect(await response?.text()).toContain("You're offline");
		for (const url of [
			"api/fs/download?path=/x",
			"api/fs/content/example.html",
			"api/fs/search?q=x",
		]) {
			expect(handleOffline(scope + url)).toBeUndefined();
		}
		expect(handleOffline(`${scope}chunk-123.js`, "cors")).toBeUndefined();
		expect(handleOffline(`${scope}docs`, "navigate", "POST")).toBeUndefined();
		expect(handleOffline("https://other.example/docs")).toBeUndefined();
		if (mount !== "/")
			expect(handleOffline("https://example.com/elsewhere/")).toBeUndefined();
	}
});
