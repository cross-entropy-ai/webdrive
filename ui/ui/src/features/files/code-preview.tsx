import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { langFromFilename } from "./file-types";
import {
	escapeCode,
	MAX_NUMBERED_LINES,
	splitHighlightedLines,
} from "./highlight-lines";

export function CodePreview({
	content,
	filename,
	wrap = false,
	lineNumbers = true,
}: {
	content: string;
	filename: string;
	wrap?: boolean;
	lineNumbers?: boolean;
}) {
	const [highlighted, setHighlighted] = useState<{
		content: string;
		html: string;
	} | null>(null);
	useEffect(() => {
		let cancelled = false;
		const language = langFromFilename(filename);
		if (language && content.length <= 100_000) {
			void import("highlight.js/lib/common")
				.then(({ default: hljs }) => {
					if (!cancelled && hljs.getLanguage(language))
						setHighlighted({
							content,
							html: hljs.highlight(content, { language }).value,
						});
				})
				.catch(() => {
					/* Plain text stays readable when highlighting is unavailable. */
				});
		}
		return () => {
			cancelled = true;
		};
	}, [content, filename]);
	const html =
		highlighted?.content === content ? highlighted.html : escapeCode(content);
	const count = useMemo(() => content.split("\n").length, [content]);
	const numbered = lineNumbers && count <= MAX_NUMBERED_LINES;
	const lines = useMemo(
		() => (numbered ? splitHighlightedLines(html) : []),
		[html, numbered],
	);
	return (
		<div
			className={`preview-text${wrap ? " preview-wrap" : ""}${numbered ? " has-line-numbers" : ""}`}
		>
			{numbered ? (
				<pre
					className="code-lines"
					style={
						{
							"--gutter-width": `${Math.max(2, String(lines.length).length) + 2}ch`,
						} as CSSProperties
					}
				>
					<code className="hljs">
						{lines.map((line, index) => (
							<span className="code-line" key={index}>
								<span
									className="line-number"
									aria-hidden="true"
									data-line={index + 1}
								/>
								<span
									className="code-line-content"
									dangerouslySetInnerHTML={{
										__html: line + (index < lines.length - 1 ? "\n" : ""),
									}}
								/>
							</span>
						))}
					</code>
				</pre>
			) : (
				<pre>
					<code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
				</pre>
			)}
		</div>
	);
}
