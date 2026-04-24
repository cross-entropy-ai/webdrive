import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export function Terminal() {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const fontFamily = getComputedStyle(document.documentElement)
			.getPropertyValue("--font-mono")
			.trim();

		const term = new XTerm({
			cursorBlink: true,
			fontSize: 13,
			fontFamily,
			theme: getTheme(),
			allowProposedApi: true,
			rightClickSelectsWord: false,
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.loadAddon(new WebLinksAddon());

		term.open(el);

		const onContextMenu = (e: Event) => e.preventDefault();
		el.addEventListener("contextmenu", onContextMenu);

		fitAddon.fit();

		// Connect WebSocket
		const proto = location.protocol === "https:" ? "wss:" : "ws:";
		const ws = new WebSocket(`${proto}//${location.host}/api/terminal`);
		ws.binaryType = "arraybuffer";

		ws.onopen = () => {
			// Send initial size
			ws.send(
				JSON.stringify({
					type: "resize",
					cols: term.cols,
					rows: term.rows,
				}),
			);
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
			el.removeEventListener("contextmenu", onContextMenu);
			ws.close();
			term.dispose();
		};
	}, []);

	return (
		<div className="terminal-page">
			<div className="terminal-wrapper">
				<div ref={containerRef} className="terminal-container" />
			</div>
		</div>
	);
}

function getTheme() {
	const isDark = document.documentElement.classList.contains("dark");
	return isDark
		? {
				background: "#0a0a0a",
				foreground: "#d4d4d4",
				cursor: "#d4d4d4",
				cursorAccent: "#0a0a0a",
				selectionBackground: "#ffffff30",
				selectionForeground: "#ffffff",
				black: "#1e1e1e",
				red: "#f14c4c",
				green: "#23d18b",
				yellow: "#e5e510",
				blue: "#3b8eea",
				magenta: "#d670d6",
				cyan: "#29b8db",
				white: "#d4d4d4",
				brightBlack: "#666666",
				brightRed: "#f14c4c",
				brightGreen: "#23d18b",
				brightYellow: "#f5f543",
				brightBlue: "#3b8eea",
				brightMagenta: "#d670d6",
				brightCyan: "#29b8db",
				brightWhite: "#ffffff",
				scrollbarSliderBackground: "#ffffff20",
				scrollbarSliderHoverBackground: "#ffffff40",
				scrollbarSliderActiveBackground: "#ffffff50",
			}
		: {
				background: "#ffffff",
				foreground: "#383a42",
				cursor: "#383a42",
				cursorAccent: "#ffffff",
				selectionBackground: "#383a4230",
				selectionForeground: "#383a42",
				black: "#383a42",
				red: "#d63031",
				green: "#2d8659",
				yellow: "#c18401",
				blue: "#4078f2",
				magenta: "#a626a4",
				cyan: "#0b7285",
				white: "#fafafa",
				brightBlack: "#737373",
				brightRed: "#e45649",
				brightGreen: "#50a14f",
				brightYellow: "#c18401",
				brightBlue: "#4078f2",
				brightMagenta: "#a626a4",
				brightCyan: "#0b7285",
				brightWhite: "#ffffff",
				scrollbarSliderBackground: "#00000015",
				scrollbarSliderHoverBackground: "#00000030",
				scrollbarSliderActiveBackground: "#00000040",
			};
}
