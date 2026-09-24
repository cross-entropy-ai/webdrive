import hljs from "highlight.js";
import { useEffect, useRef } from "react";
import { langFromFilename } from "./file-types";

export function CodePreview({
	content,
	filename,
}: {
	content: string;
	filename: string;
}) {
	const codeRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (!codeRef.current) return;
		const lang = langFromFilename(filename);
		if (lang) {
			try {
				const result = hljs.highlight(content, { language: lang });
				codeRef.current.innerHTML = result.value;
			} catch {
				codeRef.current.textContent = content;
			}
		} else {
			const result = hljs.highlightAuto(content);
			codeRef.current.innerHTML = result.value;
		}
	}, [content, filename]);

	return (
		<div className="preview-text">
			<pre>
				<code ref={codeRef} className="hljs">
					{content}
				</code>
			</pre>
		</div>
	);
}
