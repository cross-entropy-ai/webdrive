import { expect, test } from "bun:test";
import { collectFiles } from "./upload-items";

function fileEntry(name: string): FileSystemEntry {
	return {
		name,
		isFile: true,
		isDirectory: false,
		file: (success: (file: File) => void) => success(new File([name], name)),
	} as unknown as FileSystemEntry;
}

function directory(
	name: string,
	batches: FileSystemEntry[][],
): FileSystemEntry {
	return {
		name,
		isFile: false,
		isDirectory: true,
		createReader: () => {
			let index = 0;
			return {
				readEntries: (success: (entries: FileSystemEntry[]) => void) =>
					success(batches[index++] ?? []),
			};
		},
	} as unknown as FileSystemEntry;
}

test("folder drops read every batch and preserve nested relative paths", async () => {
	const root = directory("photos", [
		[fileEntry("one.jpg")],
		[directory("nested", [[fileEntry("two.jpg")]])],
	]);
	const files = await collectFiles(root, root.name);
	expect(files.map((item) => item.relativePath)).toEqual([
		"photos/one.jpg",
		"photos/nested/two.jpg",
	]);
	expect(await files[1]?.file.text()).toBe("two.jpg");
});

test("unreadable dropped files reject instead of hanging", async () => {
	const entry = {
		isFile: true,
		file: (_: unknown, reject: (error: Error) => void) =>
			reject(new Error("permission denied")),
	} as unknown as FileSystemEntry;
	await expect(collectFiles(entry, "private.txt")).rejects.toThrow(
		"permission denied",
	);
});
