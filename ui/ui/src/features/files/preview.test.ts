import { describe, expect, test } from "bun:test";
import { documentUrl } from "./document-url";
import { isTextFilename, previewKind } from "./file-types";
import { readPreviewText } from "./preview-text";

describe("document previews", () => {
	test("detects rich documents independently of plain-text server MIME types", () => {
		expect(previewKind("README.MD", "text/plain")).toBe("markdown");
		expect(previewKind("notes.markdown")).toBe("markdown");
		expect(previewKind("page.HTM", "text/plain")).toBe("html");
		expect(previewKind("page", "text/html; charset=utf-8")).toBe("html");
		expect(previewKind("movie.MP4")).toBe("video");
		expect(previewKind("unknown", "application/octet-stream")).toBe("binary");
	});
	test("resolves document images, navigation, fragments, and special filenames", () => {
		const path = "/docs/你好 #%.md";
		expect(documentUrl("../photo%20%23%25.png", path)).toBe(
			"/api/fs/content/photo%20%23%25.png",
		);
		expect(documentUrl("guide.md#hello", path, false)).toBe(
			"/docs/guide.md#hello",
		);
		expect(documentUrl("/images/a.png", path)).toBe(
			"/api/fs/content/images/a.png",
		);
		expect(documentUrl("#heading", path, false)).toBe("#heading");
		expect(documentUrl("https://example.com/a.png", path)).toBe(
			"https://example.com/a.png",
		);
		expect(documentUrl("mailto:hello@example.com", path, false)).toBe(
			"mailto:hello@example.com",
		);
		expect(documentUrl("malformed%.png", path)).toBe("");
	});
	test("reads complete text, including exact-limit and multibyte boundaries", async () => {
		expect(await readPreviewText(new Response("hello"), 5)).toEqual({
			text: "hello",
			truncated: false,
		});
		expect(await readPreviewText(new Response("你好"), 6)).toEqual({
			text: "你好",
			truncated: false,
		});
		expect(await readPreviewText(new Response("你好"), 4)).toEqual({
			text: "你",
			truncated: true,
		});
		expect(await readPreviewText(new Response(null))).toEqual({
			text: "",
			truncated: false,
		});
	});
	test("cancels the response stream after the preview limit", async () => {
		let cancelled = false;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("hello world"));
			},
			cancel() {
				cancelled = true;
			},
		});
		expect(await readPreviewText(new Response(stream), 5)).toEqual({
			text: "hello",
			truncated: true,
		});
		expect(cancelled).toBe(true);
	});
	test("decodes characters split across network chunks", async () => {
		const bytes = new TextEncoder().encode("你好");
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.subarray(0, 2));
				controller.enqueue(bytes.subarray(2, 4));
				controller.enqueue(bytes.subarray(4));
				controller.close();
			},
		});
		expect(await readPreviewText(new Response(stream), 6)).toEqual({
			text: "你好",
			truncated: false,
		});
	});
});

test("archives and application binaries stay download-only regardless of MIME", () => {
	for (const filename of [
		"backup.tar",
		"backup.tar.gz",
		"archive.ZIP",
		"data.7z",
		"image.iso",
		"app.exe",
		"module.wasm",
		"lib.so.1.2",
		"database.sqlite3",
		"model.gguf",
		"slides.pptx",
	]) {
		expect(previewKind(filename)).toBe("binary");
		expect(previewKind(filename, "text/plain")).toBe("binary");
	}
	expect(previewKind("README.md")).toBe("markdown");
	expect(previewKind("document.pdf")).toBe("pdf");
	expect(isTextFilename("project.ts")).toBe(true);
	expect(isTextFilename("server.LOG")).toBe(true);
	expect(isTextFilename("unknown.blob")).toBe(false);
	expect(isTextFilename("no-extension")).toBe(false);
});
