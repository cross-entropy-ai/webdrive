import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { contentUrl } from "../../lib/api";
import { documentUrl } from "./document-url";
import { baseName } from "./path";

export function DocumentPreview({
	content,
	path,
	kind,
}: {
	content: string;
	path: string;
	kind: "html" | "markdown";
}) {
	const rendered = useMemo(() => {
		if (kind === "html") {
			const doc = new DOMParser().parseFromString(content, "text/html");
			doc
				.querySelectorAll("base, meta[http-equiv]")
				.forEach((node) => node.remove());
			const base = doc.createElement("base");
			base.href = new URL(contentUrl(path), window.location.href).href;
			doc.head.prepend(base);
			for (const node of doc.querySelectorAll("[src], [href], [poster]")) {
				for (const attribute of ["src", "href", "poster"]) {
					const value = node.getAttribute(attribute);
					if (value?.startsWith("/") && !value.startsWith("//"))
						node.setAttribute(attribute, documentUrl(value, path));
				}
			}
			return `<!doctype html>${doc.documentElement.outerHTML}`;
		}
		const doc = new DOMParser().parseFromString(
			DOMPurify.sanitize(marked.parse(content, { async: false, gfm: true }), {
				FORBID_TAGS: ["style", "form"],
				FORBID_ATTR: ["style"],
			}),
			"text/html",
		);
		for (const image of doc.querySelectorAll("img")) {
			image.setAttribute(
				"src",
				documentUrl(image.getAttribute("src") ?? "", path),
			);
			image.removeAttribute("srcset");
			image.loading = "lazy";
		}
		for (const link of doc.querySelectorAll("a[href]")) {
			const href = link.getAttribute("href")!;
			link.setAttribute("href", documentUrl(href, path, false));
			if (/^(https?:)?\/\//i.test(href)) {
				link.setAttribute("target", "_blank");
				link.setAttribute("rel", "noopener noreferrer");
			}
		}
		const ids = new Set<string>();
		for (const heading of doc.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
			const slug =
				heading.textContent
					.toLowerCase()
					.replace(/[^\p{L}\p{N}\s_-]/gu, "")
					.trim()
					.replace(/\s+/g, "-") || "section";
			let id = slug;
			for (let i = 1; ids.has(id); i++) id = `${slug}-${i}`;
			ids.add(id);
			heading.id = `document-${id}`;
		}
		return DOMPurify.sanitize(doc.body.innerHTML);
	}, [content, path, kind]);
	if (kind === "html")
		return (
			<iframe
				className="preview-html"
				sandbox=""
				srcDoc={rendered}
				title={`${baseName(path)} preview`}
			/>
		);
	return (
		<article
			className="preview-markdown"
			onClick={(event) => {
				const link = (event.target as HTMLElement).closest("a");
				const href = link?.getAttribute("href");
				if (href?.startsWith("#")) {
					event.preventDefault();
					try {
						document
							.getElementById(`document-${decodeURIComponent(href.slice(1))}`)
							?.scrollIntoView({ behavior: "smooth" });
					} catch {
						/* Ignore malformed fragments. */
					}
				}
			}}
			dangerouslySetInnerHTML={{ __html: rendered }}
		/>
	);
}
