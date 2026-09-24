import { useEffect, useRef } from "react";
import { langFromFilename } from "./file-types";

export function CodePreview({
	content,
	filename,
	wrap = false,
}: {
	content: string;
	filename: string;
	wrap?: boolean;
}) {
	const codeRef = useRef<HTMLElement>(null);
	useEffect(() => {
		let cancelled = false;
		const code = codeRef.current;
		if (!code) return;
		code.textContent = content;
		const language = langFromFilename(filename);
		// Large files and unknown languages stay immediately readable as plain text.
		if (language && content.length <= 100_000) {
			void import("highlight.js/lib/common")
				.then(({ default: hljs }) => {
					if (!cancelled && hljs.getLanguage(language))
						code.innerHTML = hljs.highlight(content, { language }).value;
				})
				.catch(() => {
					/* Plain text remains available if highlighting cannot load. */
				});
		}
		return () => {
			cancelled = true;
		};
	}, [content, filename]);
	return (
		<div className={`preview-text${wrap ? " preview-wrap" : ""}`}>
			<pre>
				<code ref={codeRef} className="hljs">
					{content}
				</code>
			</pre>
		</div>
	);
}
