import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export function Terminal() {
	const containerRef = useRef<HTMLDivElement>(null);
	const termRef = useRef<XTerm | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const term = new XTerm({
			cursorBlink: true,
			fontSize: 13,
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
			theme: getTheme(),
			allowProposedApi: true,
		});
		termRef.current = term;

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.loadAddon(new WebLinksAddon());

		term.open(containerRef.current);
		fitAddon.fit();

		// Connect WebSocket
		const proto = location.protocol === "https:" ? "wss:" : "ws:";
		const ws = new WebSocket(`${proto}//${location.host}/api/terminal`);
		ws.binaryType = "arraybuffer";

		ws.onopen = () => {
			// Send initial size
			ws.send(JSON.stringify({
				type: "resize",
				cols: term.cols,
				rows: term.rows,
			}));
		};

		ws.onmessage = (e) => {
			if (e.data instanceof ArrayBuffer) {
				term.write(new Uint8Array(e.data));
			} else {
				term.write(e.data);
			}
		};

		ws.onclose = () => {
			term.write("\r\n\x1b[90m[connection closed]\x1b[0m\r\n");
		};

		term.onData((data) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(new TextEncoder().encode(data));
			}
		});

		term.onResize(({ cols, rows }) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "resize", cols, rows }));
			}
		});

		// Handle window resize
		const onResize = () => fitAddon.fit();
		window.addEventListener("resize", onResize);

		// Watch for theme changes
		const observer = new MutationObserver(() => {
			term.options.theme = getTheme();
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", onResize);
			ws.close();
			term.dispose();
		};
	}, []);

	return <div ref={containerRef} className="terminal-container" />;
}

function getTheme() {
	const isDark = document.documentElement.classList.contains("dark");
	return isDark
		? {
				background: "#0a0a0a",
				foreground: "#ededed",
				cursor: "#ededed",
				selectionBackground: "#ededed33",
				black: "#0a0a0a",
				brightBlack: "#737373",
				white: "#ededed",
				brightWhite: "#ffffff",
			}
		: {
				background: "#ffffff",
				foreground: "#171717",
				cursor: "#171717",
				selectionBackground: "#17171733",
				black: "#171717",
				brightBlack: "#737373",
				white: "#f5f5f5",
				brightWhite: "#ffffff",
			};
}
