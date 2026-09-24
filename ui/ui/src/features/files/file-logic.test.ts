import { expect, test } from "bun:test";
import { mediaTypeFromName, mimeCategory } from "./file-types";
import { baseName, joinPath, parentOf } from "./path";
import { sortEntries } from "./sort";
import type { Entry } from "./types";

test("path helpers preserve special filenames and root navigation", () => {
	for (const name of ["a #?%.txt", "你好.txt", "a+b.txt"]) {
		expect(joinPath("/docs/", name)).toBe(`/docs/${name}`);
		expect(baseName(`/docs/${name}`)).toBe(name);
		expect(parentOf(`/docs/${name}`)).toBe("/docs");
	}
	expect(joinPath("/", "docs")).toBe("/docs");
	expect(parentOf("/docs/")).toBe("/");
	expect(parentOf("/")).toBe("/");
	expect(baseName("/")).toBe("/");
});

test("preview MIME classification handles parameters and case", () => {
	for (const mime of [
		"text/plain; charset=utf-8",
		"application/json; charset=utf-8",
		"Application/XML",
	]) {
		expect(mimeCategory(mime)).toBe("text");
	}
	expect(mimeCategory("application/pdf; version=1.7")).toBe("pdf");
	expect(mimeCategory("video/mp4")).toBe("video");
	expect(mimeCategory("audio/mpeg")).toBe("audio");
	expect(mimeCategory("application/octet-stream")).toBe("binary");
	expect(mediaTypeFromName("PHOTO.JPG")).toBe("image");
	expect(mediaTypeFromName("song.mp3")).toBe("audio");
	expect(mediaTypeFromName("code.ts")).toBeNull();
});

test("sorting keeps directories first in either direction without changing the source", () => {
	const entries: Entry[] = [
		{ name: "b", is_dir: false, size: 10, mod_time: "2026-01-01" },
		{ name: "z", is_dir: true, size: 0, mod_time: "2026-01-02" },
		{ name: "a", is_dir: false, size: 20, mod_time: "2026-01-03" },
	];
	const names = (items: Entry[]) => items.map((item) => item.name);
	expect(names(sortEntries(entries, "name", "asc"))).toEqual(["z", "a", "b"]);
	expect(names(sortEntries(entries, "name", "desc"))).toEqual(["z", "b", "a"]);
	expect(names(sortEntries(entries, "size", "desc"))).toEqual(["z", "a", "b"]);
	expect(names(sortEntries(entries, "mod_time", "asc"))).toEqual([
		"z",
		"b",
		"a",
	]);
	expect(names(entries)).toEqual(["b", "z", "a"]);
});
