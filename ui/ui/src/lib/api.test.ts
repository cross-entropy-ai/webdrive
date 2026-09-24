import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { filesApi, uploadFile } from "../features/files/api";
import {
	ApiError,
	contentUrl,
	downloadUrl,
	previewUrl,
	requestJSON,
} from "./api";

const fetchSpy = spyOn(globalThis, "fetch");
const originalDocument = Object.getOwnPropertyDescriptor(
	globalThis,
	"document",
);
const originalXHR = Object.getOwnPropertyDescriptor(
	globalThis,
	"XMLHttpRequest",
);
afterEach(() => {
	fetchSpy.mockReset();
	for (const [key, descriptor] of [
		["document", originalDocument],
		["XMLHttpRequest", originalXHR],
	] as const) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
});
afterAll(() => fetchSpy.mockRestore());

describe("API contract", () => {
	test("encodes special filenames and repeated download paths", () => {
		const paths = ["/你好/a #?%.txt", "/b+ c.txt"];
		const url = new URL(downloadUrl(paths), "http://localhost");
		expect(url.searchParams.getAll("path")).toEqual(paths);
		expect(
			new URL(downloadUrl(paths[0]!), "http://localhost").searchParams.get(
				"path",
			),
		).toBe(paths[0]!);
		expect(
			new URL(previewUrl(paths[0]!), "http://localhost").searchParams.get(
				"path",
			),
		).toBe(paths[0]!);
	});

	test("preserves both single and batch server errors", async () => {
		fetchSpy.mockResolvedValueOnce(
			Response.json({ error: "folder already exists" }, { status: 409 }),
		);
		await expect(filesApi.mkdir("/", "docs")).rejects.toThrow(
			"folder already exists",
		);
		fetchSpy.mockResolvedValueOnce(
			Response.json(
				{ errors: ["cannot delete root directory", "permission denied"] },
				{ status: 500 },
			),
		);
		await expect(filesApi.delete(["/", "/private"])).rejects.toThrow(
			"cannot delete root directory; permission denied",
		);
	});

	test("provides a useful fallback for non-JSON errors", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("<html>unavailable</html>", {
				status: 502,
				statusText: "Bad Gateway",
			}),
		);
		await expect(requestJSON("/api/info")).rejects.toThrow("Bad Gateway");
	});

	test("recognizes a file without swallowing missing paths or server failures", async () => {
		fetchSpy.mockResolvedValueOnce(
			Response.json({ error: "not a directory" }, { status: 400 }),
		);
		expect(await filesApi.list("/code.ts")).toBeNull();
		fetchSpy.mockResolvedValueOnce(
			Response.json({ error: "missing" }, { status: 404 }),
		);
		await expect(filesApi.list("/missing")).rejects.toBeInstanceOf(ApiError);
		fetchSpy.mockResolvedValueOnce(
			Response.json({ error: "not a directory" }, { status: 500 }),
		);
		await expect(filesApi.list("/broken")).rejects.toBeInstanceOf(ApiError);
	});

	test("keeps JSON field names and transmits all selected paths", async () => {
		fetchSpy.mockResolvedValueOnce(Response.json({ ok: true }));
		fetchSpy.mockResolvedValueOnce(Response.json({ ok: true }));
		await filesApi.rename("/a.txt", "b.txt");
		expect(fetchSpy).toHaveBeenLastCalledWith("/api/fs/rename", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: "/a.txt", new_name: "b.txt" }),
		});
		await filesApi.delete(["/a.txt", "/b.txt"]);
		expect(JSON.parse(fetchSpy.mock.calls.at(-1)?.[1]?.body as string)).toEqual(
			{ paths: ["/a.txt", "/b.txt"] },
		);
	});

	test("propagates conflict-check failures instead of assuming files are safe to overwrite", async () => {
		fetchSpy.mockResolvedValueOnce(
			Response.json({ error: "unavailable" }, { status: 503 }),
		);
		await expect(filesApi.check("/", ["existing.txt"])).rejects.toThrow(
			"unavailable",
		);
	});

	test("passes cancellation through to directory requests", async () => {
		const controller = new AbortController();
		fetchSpy.mockResolvedValueOnce(
			Response.json({ path: "/a b", entries: [] }),
		);
		expect(await filesApi.list("/a b", controller.signal)).toEqual({
			path: "/a b",
			entries: [],
		});
		expect(fetchSpy).toHaveBeenLastCalledWith("/api/fs/list?path=%2Fa%20b", {
			signal: controller.signal,
		});
	});
});

for (const prefix of ["/", "/proxy/9090/", "/code/proxy/9090/", "/files/"]) {
	test(`all file requests preserve the mount ${prefix}`, async () => {
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: { baseURI: `https://example.com${prefix}` },
		});
		fetchSpy.mockResolvedValueOnce(Response.json({ hostname: "test" }));
		await requestJSON("/api/info");
		expect(fetchSpy.mock.calls.at(-1)?.[0]).toBe(`${prefix}api/info`);

		fetchSpy.mockResolvedValueOnce(
			Response.json({ path: "/docs", entries: [] }),
		);
		await filesApi.list("/docs");
		expect(fetchSpy.mock.calls.at(-1)?.[0]).toBe(
			`${prefix}api/fs/list?path=%2Fdocs`,
		);

		fetchSpy.mockResolvedValueOnce(Response.json({ ok: true }));
		await filesApi.mkdir("/docs", "new");
		expect(fetchSpy.mock.calls.at(-1)?.[0]).toBe(`${prefix}api/fs/mkdir`);
		expect(JSON.parse(fetchSpy.mock.calls.at(-1)?.[1]?.body as string)).toEqual(
			{ path: "/docs", name: "new" },
		);

		const filename = "/docs/你好 #?%.txt";
		expect(contentUrl(filename)).toBe(
			`${prefix}api/fs/content/docs/${encodeURIComponent("你好 #?%.txt")}`,
		);
		const preview = new URL(previewUrl(filename), "https://example.com");
		expect(preview.pathname).toBe(`${prefix}api/fs/preview`);
		expect(preview.searchParams.get("path")).toBe(filename);
		const download = new URL(
			downloadUrl([filename, "/another.txt"]),
			"https://example.com",
		);
		expect(download.pathname).toBe(`${prefix}api/fs/download`);
		expect(download.searchParams.getAll("path")).toEqual([
			filename,
			"/another.txt",
		]);

		let uploadURL = "";
		let uploadBody: FormData | undefined;
		Object.defineProperty(globalThis, "XMLHttpRequest", {
			configurable: true,
			value: class {
				upload = {};
				status = 200;
				onload = () => {};
				open(_method: string, url: string) {
					uploadURL = url;
				}
				send(body: FormData) {
					uploadBody = body;
					this.onload();
				}
			},
		});
		await uploadFile(
			"/docs",
			new File(["test"], "hello.txt"),
			"nested/hello.txt",
			() => {},
		);
		expect(uploadURL).toBe(`${prefix}api/fs/upload`);
		expect(uploadBody?.get("path")).toBe("/docs");
		expect(uploadBody?.get("relativePaths")).toBe("nested/hello.txt");
	});
}
