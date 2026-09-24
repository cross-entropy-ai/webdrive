import {
	ApiError,
	postJSON,
	request,
	requestJSON,
	responseError,
} from "../../lib/api";
import { appUrl } from "../../lib/app-url";
import type { ListResponse, SearchResponse, SearchProgress } from "./types";

export const filesApi = {
	async searchProgress(
		path: string,
		query: string,
		signal: AbortSignal,
		onProgress: (result: SearchProgress) => void,
	): Promise<void> {
		const response = await request(
			appUrl(
				`/api/fs/search?path=${encodeURIComponent(path)}&q=${encodeURIComponent(query)}&stream=1`,
			),
			{ signal },
		);
		if (!response.body) throw new Error("Search response is unavailable");
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let complete = false;
		const consume = (line: string) => {
			if (!line.trim()) return;
			const result = JSON.parse(line) as SearchProgress;
			if (!Array.isArray(result.entries) || typeof result.done !== "boolean")
				throw new Error("Invalid search response");
			complete = result.done;
			onProgress(result);
		};
		try {
			while (true) {
				const { value, done } = await reader.read();
				signal.throwIfAborted();
				buffer += decoder.decode(value, { stream: !done });
				let newline: number;
				while ((newline = buffer.indexOf("\n")) >= 0) {
					consume(buffer.slice(0, newline));
					buffer = buffer.slice(newline + 1);
				}
				if (done) break;
			}
			consume(buffer);
			if (!complete) throw new Error("Search was interrupted. Try again.");
		} finally {
			await reader.cancel().catch(() => {});
			reader.releaseLock();
		}
	},
	search: (path: string, query: string, signal?: AbortSignal) =>
		requestJSON<SearchResponse>(
			`/api/fs/search?path=${encodeURIComponent(path)}&q=${encodeURIComponent(query)}`,
			{ signal },
		),
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
		xhr.open("POST", appUrl("/api/fs/upload"));
		xhr.send(form);
	});
}
