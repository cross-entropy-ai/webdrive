import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/api";
import { filesApi, uploadFile } from "./api";
import { collectFiles, type UploadItem } from "./upload-items";

export function useFileUpload(
	path: string,
	refreshListing: () => Promise<void>,
	setError: (error: string) => void,
) {
	const [uploadState, setUploadState] = useState<{
		current: string;
		index: number;
		total: number;
		fileProgress: number;
	} | null>(null);

	const [conflictFile, setConflictFile] = useState<string | null>(null);
	const [applyAll, setApplyAll] = useState(false);
	const applyAllRef = useRef(false);
	const conflictResolveRef = useRef<
		((action: "skip" | "overwrite" | "cancel") => void) | null
	>(null);

	const askConflict = (
		name: string,
	): Promise<"skip" | "overwrite" | "cancel"> => {
		return new Promise((resolve) => {
			applyAllRef.current = false;
			setApplyAll(false);
			setConflictFile(name);
			conflictResolveRef.current = (action) => {
				setConflictFile(null);
				conflictResolveRef.current = null;
				resolve(action);
			};
		});
	};

	const busy = useRef(false);
	const generation = useRef(0);
	const runUpload = async (
		operation: (isCurrent: () => boolean) => Promise<void>,
	) => {
		if (busy.current) return;
		busy.current = true;
		const startedAt = generation.current;
		const isCurrent = () => generation.current === startedAt;
		try {
			await operation(isCurrent);
		} catch (error) {
			if (isCurrent()) setError(errorMessage(error));
		} finally {
			busy.current = false;
			setUploadState(null);
		}
	};

	useEffect(
		() => () => {
			generation.current++;
			conflictResolveRef.current?.("cancel");
		},
		[path],
	);

	const handleDropUpload = (dataTransfer: DataTransfer) =>
		runUpload(async (isCurrent) => {
			const items: UploadItem[] = [];
			const entries = Array.from(dataTransfer.items)
				.map((item) => item.webkitGetAsEntry?.())
				.filter((e): e is FileSystemEntry => e !== null && e !== undefined);

			if (entries.length > 0) {
				for (const entry of entries) {
					items.push(...(await collectFiles(entry, entry.name)));
				}
			} else {
				for (const file of Array.from(dataTransfer.files)) {
					items.push({ file, relativePath: file.name });
				}
			}

			if (items.length === 0) return;
			await handleUploadItems(items, isCurrent);
		});

	const handleUpload = (files: FileList) =>
		runUpload(async (isCurrent) => {
			const items: UploadItem[] = Array.from(files).map((f) => ({
				file: f,
				relativePath: f.name,
			}));
			await handleUploadItems(items, isCurrent);
		});

	const handleUploadItems = async (
		items: UploadItem[],
		isCurrent: () => boolean,
	) => {
		if (!isCurrent()) return;
		const body = await filesApi.check(
			path,
			items.map((item) => item.relativePath),
		);
		if (!isCurrent()) return;
		const existingSet = new Set(body.existing);

		const conflicts = items.filter((item) =>
			existingSet.has(item.relativePath),
		);
		const safe = items.filter((item) => !existingSet.has(item.relativePath));

		const toUpload = [...safe];
		let rememberedAction: "skip" | "overwrite" | null = null;
		for (const item of conflicts) {
			let action: "skip" | "overwrite" | "cancel";
			if (rememberedAction) {
				action = rememberedAction;
			} else {
				action = await askConflict(item.relativePath);
				if (applyAllRef.current && action !== "cancel") {
					rememberedAction = action;
				}
			}
			if (action === "cancel" || !isCurrent()) return;
			if (action === "overwrite") toUpload.push(item);
		}

		const total = toUpload.length;
		if (total === 0) return;

		const errors: string[] = [];
		for (const [i, item] of toUpload.entries()) {
			if (!isCurrent()) return;
			setUploadState({
				current: item.relativePath,
				index: i,
				total,
				fileProgress: 0,
			});
			try {
				await uploadFile(path, item.file, item.relativePath, (fileProgress) => {
					if (!isCurrent()) return;
					setUploadState((state) =>
						state ? { ...state, fileProgress } : state,
					);
				});
			} catch (error) {
				errors.push(errorMessage(error));
			}
		}

		if (!isCurrent()) return;
		setUploadState(null);
		if (errors.length > 0) {
			setError(`Failed to upload: ${errors.join(", ")}`);
		}
		await refreshListing();
	};

	return {
		uploadState,
		conflictFile,
		applyAll,
		handleUpload,
		handleDropUpload,
		setApplyAll: (value: boolean) => {
			setApplyAll(value);
			applyAllRef.current = value;
		},
		resolveConflict: (action: "skip" | "overwrite" | "cancel") =>
			conflictResolveRef.current?.(action),
	};
}
