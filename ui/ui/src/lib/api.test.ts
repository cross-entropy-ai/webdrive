import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { filesApi } from "../features/files/api";
import { ApiError, downloadUrl, previewUrl, requestJSON } from "./api";

const fetchSpy = spyOn(globalThis, "fetch");
afterEach(() => fetchSpy.mockReset());
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
