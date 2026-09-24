import { contentUrl } from "../../lib/api";
import { appUrl } from "../../lib/app-url";

// Resolve document paths independently of the browser's proxy prefix.
export function documentUrl(
	reference: string,
	path: string,
	asset = true,
): string {
	if (
		!reference ||
		reference.startsWith("#") ||
		/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)
	)
		return reference;
	const base = path.split("/").map(encodeURIComponent).join("/");
	try {
		const resolved = new URL(reference, `https://document.invalid${base}`);
		const target = decodeURIComponent(resolved.pathname);
		return (
			(asset ? contentUrl(target) : appUrl(resolved.pathname)) +
			resolved.search +
			resolved.hash
		);
	} catch {
		return "";
	}
}
