import { ApiError, postJSON, requestJSON, responseError } from "../../lib/api";
import type { ListResponse } from "./types";

export const filesApi = {
	async list(path: string, signal?: AbortSignal): Promise<ListResponse | null> {
		try {
			return await requestJSON<ListResponse>(
				`/api/fs/list?path=${encodeURIComponent(path)}`,
				{ signal },
			);
		} catch (error) {
			if (
				error instanceof ApiError &&
				error.status === 400 &&
				error.message === "not a directory"
			)
				return null;
			throw error;
		}
	},
	mkdir: (path: string, name: string) =>
		postJSON("/api/fs/mkdir", { path, name }),
	rename: (path: string, newName: string) =>
		postJSON("/api/fs/rename", { path, new_name: newName }),
	delete: (paths: string[]) => postJSON("/api/fs/delete", { paths }),
	check: (dir: string, paths: string[]) =>
		postJSON<{ existing: string[] }>("/api/fs/check", { dir, paths }),
};

// XHR exposes upload progress; ordinary API requests use fetch.
export function uploadFile(
	dir: string,
	file: File,
	relativePath: string,
	onProgress: (progress: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const form = new FormData();
		form.append("path", dir);
		form.append("files", file);
		form.append("relativePaths", relativePath);
		const xhr = new XMLHttpRequest();
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(event.loaded / event.total);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
				return;
			}
			let body: unknown;
			try {
				body = JSON.parse(xhr.responseText);
			} catch {
				body = null;
			}
			reject(
				new ApiError(
					responseError(body, `Failed to upload ${relativePath}`),
					xhr.status,
				),
			);
		};
		xhr.onerror = () => reject(new Error(`Failed to upload ${relativePath}`));
		xhr.onabort = () => reject(new Error(`Upload cancelled: ${relativePath}`));
		xhr.open("POST", "/api/fs/upload");
		xhr.send(form);
	});
}
