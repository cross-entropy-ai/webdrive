import { expect, test } from "bun:test";
import { escapeCode, splitHighlightedLines } from "./highlight-lines";

test("multiline syntax spans remain balanced on every numbered line", () => {
	expect(
		splitHighlightedLines(
			'<span class="hljs-comment">one\n<span class="hljs-doctag">two\nthree</span> end</span>\n',
		),
	).toEqual([
		'<span class="hljs-comment">one</span>',
		'<span class="hljs-comment"><span class="hljs-doctag">two</span></span>',
		'<span class="hljs-comment"><span class="hljs-doctag">three</span> end</span>',
		"",
	]);
});
test("blank lines and literal code stay intact without becoming HTML", () => {
	expect(splitHighlightedLines(escapeCode("<script>&\n\n</script>"))).toEqual([
		"&lt;script&gt;&amp;",
		"",
		"&lt;/script&gt;",
	]);
	expect(splitHighlightedLines("")).toEqual([""]);
	expect(splitHighlightedLines("a\r\nb")).toEqual(["a\r", "b"]);
});
