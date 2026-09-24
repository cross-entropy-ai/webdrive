export type UploadItem = { file: File; relativePath: string };

const readEntries = async (
	entry: FileSystemDirectoryEntry,
): Promise<FileSystemEntry[]> => {
	const reader = entry.createReader();
	const all: FileSystemEntry[] = [];
	let batch: FileSystemEntry[];
	do {
		batch = await new Promise((resolve, reject) =>
			reader.readEntries(resolve, reject),
		);
		all.push(...batch);
	} while (batch.length > 0);
	return all;
};

export const collectFiles = async (
	entry: FileSystemEntry,
	basePath: string,
): Promise<UploadItem[]> => {
	if (entry.isFile) {
		const file = await new Promise<File>((resolve, reject) =>
			(entry as FileSystemFileEntry).file(resolve, reject),
		);
		return [{ file, relativePath: basePath }];
	}
	const items: UploadItem[] = [];
	const entries = await readEntries(entry as FileSystemDirectoryEntry);
	for (const child of entries) {
		items.push(...(await collectFiles(child, `${basePath}/${child.name}`)));
	}
	return items;
};
