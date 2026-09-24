import { expect, test } from "bun:test";
import { fuzzyEntries, fuzzyMatch } from "./fuzzy-search";
import type { Entry } from "./types";

test("fuzzy matching finds ordered filename characters and highlights Unicode correctly", () => {
	expect(fuzzyMatch("file-browser.tsx", "fbr")?.positions).toEqual([0, 5, 6]);
	expect(fuzzyMatch("file-browser.tsx", " F B R ")?.positions).toEqual([
		0, 5, 6,
	]);
	expect(fuzzyMatch("📝notes.md", "📝m")?.positions).toEqual([0, 7]);
	expect(fuzzyMatch("你好-world.md", "你wm")?.positions).toEqual([0, 3, 9]);
	expect(fuzzyMatch("file.ts", "zz")).toBeNull();
	expect(fuzzyMatch("a", "aaa")).toBeNull();
	expect(fuzzyMatch("file.ts", "  ")).toEqual({ score: 0, positions: [] });
});
test("exact and contiguous matches rank first, with stable ties and no mutation", () => {
	const entries = ["fabulous", "file-browser.tsx", "fb", "fb-notes.md"].map(
		(name) => ({ name, is_dir: false, size: 1, mod_time: "" }),
	);
	expect(fuzzyEntries(entries, "fb").map((entry) => entry.name)).toEqual([
		"fb",
		"fb-notes.md",
		"file-browser.tsx",
		"fabulous",
	]);
	expect(entries[0]!.name).toBe("fabulous");
	expect(fuzzyEntries(entries, "missing")).toEqual([]);
	const ties: Entry[] = [
		{ ...entries[0]!, name: "note" },
		{ ...entries[0]!, name: "note" },
	];
	expect(fuzzyEntries(ties, "nt")[0]).toBe(ties[0]);
	expect(fuzzyEntries(entries, " ")).toEqual(entries);
});
