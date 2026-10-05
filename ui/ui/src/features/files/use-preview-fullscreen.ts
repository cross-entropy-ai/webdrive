import { useEffect, useRef, useState } from "react";

export function usePreviewFullscreen() {
	const ref = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [expanded, setExpanded] = useState(false);

	const exit = async () => {
		if (document.fullscreenElement === ref.current) {
			await document.exitFullscreen().catch(() => {});
		}
		setExpanded(false);
		buttonRef.current?.focus();
	};
	const toggle = async () => {
		if (expanded) return exit();
		setExpanded(true);
		// Safari on some devices and embedded browsers don't expose fullscreen.
		// The same preview fills the viewport if native fullscreen is unavailable.
		try {
			await ref.current?.requestFullscreen?.();
		} catch {
			/* Keep the viewport-sized preview. */
		}
	};

	useEffect(() => {
		const node = ref.current;
		const onChange = () => {
			if (!document.fullscreenElement) {
				setExpanded(false);
				buttonRef.current?.focus();
			}
		};
		document.addEventListener("fullscreenchange", onChange);
		return () => {
			document.removeEventListener("fullscreenchange", onChange);
			if (document.fullscreenElement === node) {
				void document.exitFullscreen().catch(() => {});
			}
		};
	}, []);

	useEffect(() => {
		if (!expanded) return;
		buttonRef.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (document.querySelector("dialog[open], .popup-menu")) return;
			if (event.key === "Escape") {
				event.preventDefault();
				void exit();
			}
			if (event.key === "Tab" && !document.fullscreenElement) {
				const controls = Array.from(
					ref.current?.querySelectorAll<HTMLElement>(
						'button:not(:disabled), a[href], input, iframe, video[controls], audio[controls], [tabindex="0"]',
					) ?? [],
				).filter((node) => node.tabIndex >= 0 && node.getClientRects().length);
				const first = controls[0];
				const last = controls.at(-1);
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last?.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first?.focus();
				}
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [expanded]);
	return { ref, buttonRef, expanded, toggle };
}
