export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function responseError(body: unknown, fallback: string): string {
	if (typeof body !== "object" || body === null) return fallback;
	if ("error" in body && typeof body.error === "string") return body.error;
	if ("errors" in body && Array.isArray(body.errors)) {
		const errors = body.errors.filter(
			(error): error is string => typeof error === "string",
		);
		if (errors.length) return errors.join("; ");
	}
	return fallback;
}

export async function request(
	url: string,
	init?: RequestInit,
): Promise<Response> {
	const response = await fetch(url, init);
	if (!response.ok) {
		const body: unknown = await response.json().catch(() => null);
		throw new ApiError(
			responseError(body, response.statusText || `HTTP ${response.status}`),
			response.status,
		);
	}
	return response;
}

export async function requestJSON<T>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	return (await request(url, init)).json() as Promise<T>;
}

export function postJSON<T>(url: string, body: unknown): Promise<T> {
	return requestJSON<T>(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

export function previewUrl(path: string): string {
	return `/api/fs/preview?path=${encodeURIComponent(path)}`;
}

export function downloadUrl(paths: string | readonly string[]): string {
	const params = new URLSearchParams();
	for (const path of typeof paths === "string" ? [paths] : paths) {
		params.append("path", path);
	}
	return `/api/fs/download?${params}`;
}
