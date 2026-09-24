export const MAX_NUMBERED_LINES = 10_000;
export function escapeCode(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

// Highlight.js spans can cross newlines (comments/template strings). Reopen
// them on the next line so wrapping and line numbers share each row's height.
export function splitHighlightedLines(html: string): string[] {
	const open: string[] = [];
	const lines: string[] = [];
	let line = "";
	for (const token of html.split(/(<span\b[^>]*>|<\/span>|\n)/g)) {
		if (token === "\n") {
			lines.push(line + "</span>".repeat(open.length));
			line = open.join("");
		} else {
			line += token;
			if (token.startsWith("<span")) open.push(token);
			else if (token === "</span>") open.pop();
		}
	}
	lines.push(line);
	return lines;
}
