export const MAX_PREVIEW_BYTES = 1024 * 1024;

// Bound both network work and rendering costs for large text/log files.
export async function readPreviewText(
	response: Response,
	limit = MAX_PREVIEW_BYTES,
): Promise<{ text: string; truncated: boolean }> {
	if (!response.body) return { text: "", truncated: false };
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let text = "";
	let bytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return { text: text + decoder.decode(), truncated: false };
			const remaining = limit - bytes;
			if (value.length > remaining) {
				text += decoder.decode(value.subarray(0, remaining), { stream: true });
				await reader.cancel();
				return { text, truncated: true };
			}
			text += decoder.decode(value, { stream: true });
			bytes += value.length;
		}
	} finally {
		reader.releaseLock();
	}
}
