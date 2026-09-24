import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
	className?: string;
}

export function Modal({ open, onClose, children, className = "" }: ModalProps) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = ref.current;
		if (!open || !dialog) return;
		const previous = document.activeElement as HTMLElement | null;
		const title = dialog.querySelector(".modal-header")?.textContent;
		if (title) dialog.setAttribute("aria-label", title);
		dialog.showModal();
		return () => {
			dialog.close();
			if (previous?.isConnected) previous.focus();
		};
	}, [open]);
	if (!open) return null;
	return (
		<dialog
			ref={ref}
			className={`modal-root ${className}`}
			onKeyDown={(event) => {
				if (event.key !== "Tab") return;
				const controls = Array.from(
					event.currentTarget.querySelectorAll<HTMLElement>(
						'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
					),
				).filter(
					(control) =>
						control.tabIndex >= 0 && control.getClientRects().length > 0,
				);
				const first = controls[0];
				const last = controls.at(-1);
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last?.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first?.focus();
				}
			}}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="modal-content">{children}</div>
		</dialog>
	);
}
function Header({ children }: { children: ReactNode }) {
	return (
		<div className="modal-header">
			<span className="font-semibold">{children}</span>
		</div>
	);
}
function Body({ children }: { children: ReactNode }) {
	return <div className="modal-body">{children}</div>;
}
Modal.Header = Header;
Modal.Body = Body;
