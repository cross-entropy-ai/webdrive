export function previewUrl(path: string): string {
	return `/api/fs/preview?path=${encodeURIComponent(path)}`;
}

export function downloadUrl(path: string): string {
	return `/api/fs/download?path=${encodeURIComponent(path)}`;
}
