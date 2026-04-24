import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
	return (
		<AnimatePresence>
			{open && (
				<div className="modal-root">
					<motion.div
						className="modal-backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.1 }}
						onClick={onClose}
					/>
					<motion.div
						className="modal-content"
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 4 }}
						transition={{ duration: 0.1 }}
					>
						{children}
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}

function Header({ children }: { children: ReactNode }) {
	return (
		<div className="modal-header">
			<h2 className="text-sm text-accent">{children}</h2>
		</div>
	);
}

function Body({ children }: { children: ReactNode }) {
	return <div className="modal-body">{children}</div>;
}

Modal.Header = Header;
Modal.Body = Body;
