import type { ReactNode } from "react";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
	if (!open) return null;
	return (
		<div className="modal-root">
			<div className="modal-backdrop" onClick={onClose} />
			<div className="modal-content">{children}</div>
		</div>
	);
}

function Header({ children }: { children: ReactNode }) {
	return (
		<div className="modal-header">
			<span className="text-accent font-medium">{children}</span>
		</div>
	);
}

function Body({ children }: { children: ReactNode }) {
	return <div className="modal-body">{children}</div>;
}

Modal.Header = Header;
Modal.Body = Body;
