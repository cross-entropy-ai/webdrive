import { useEffect, useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Modal } from "./modal";

interface RenameModalProps {
	open: boolean;
	onClose: () => void;
	initialName: string;
	onRename: (newName: string) => Promise<void>;
}

export function RenameModal({
	open,
	onClose,
	initialName,
	onRename,
}: RenameModalProps) {
	const [name, setName] = useState(initialName);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (open) {
			setName(initialName);
			setError(null);
		}
	}, [open]);

	const handleSubmit = async () => {
		setError(null);
		setLoading(true);
		try {
			await onRename(name);
			onClose();
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal open={open} onClose={onClose}>
			<Modal.Header>Rename</Modal.Header>
			<Modal.Body>
				<form
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
				>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
					/>
					{error && <div className="error-box">{error}</div>}
					<div className="flex items-center gap-2 justify-end">
						<Button variant="ghost" type="button" onClick={onClose}>
							Cancel
						</Button>
						<Button
							variant="primary"
							type="submit"
							disabled={loading || !name.trim()}
						>
							{loading ? "Renaming..." : "Rename"}
						</Button>
					</div>
				</form>
			</Modal.Body>
		</Modal>
	);
}
