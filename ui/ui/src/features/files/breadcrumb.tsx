import { Icon } from "@iconify/react";
import { useState } from "react";
import { Modal } from "../../components/modal";

export function Breadcrumb({
	path,
	onNavigate,
}: {
	path: string;
	onNavigate: (p: string) => void;
}) {
	const [modalOpen, setModalOpen] = useState(false);
	const parts = path.split("/").filter(Boolean);

	const allSegments = (() => {
		let acc = "";
		return [
			{ name: "/", path: "/" },
			...parts.map((p) => {
				acc += `/${p}`;
				return { name: p, path: acc };
			}),
		];
	})();

	const showEllipsis = parts.length > 2;
	const visible = showEllipsis ? parts.slice(-2) : parts;
	const offset = showEllipsis ? parts.length - 2 : 0;

	return (
		<>
			<nav className="breadcrumb">
				<button
					type="button"
					className={`breadcrumb-seg${path === "/" ? " current" : ""}`}
					onClick={path === "/" ? undefined : () => onNavigate("/")}
				>
					<Icon icon="solar:folder-path-connect-linear" width={13} />
				</button>

				{showEllipsis && (
					<>
						<span className="breadcrumb-sep">/</span>
						<button
							type="button"
							className="breadcrumb-seg"
							onClick={() => setModalOpen(true)}
						>
							&hellip;
						</button>
					</>
				)}

				{visible.flatMap((name, i) => {
					const segPath = "/" + parts.slice(0, offset + i + 1).join("/");
					const isCurrent = i === visible.length - 1;
					return [
						<span key={`sep-${segPath}`} className="breadcrumb-sep">
							/
						</span>,
						isCurrent ? (
							<span key={segPath} className="breadcrumb-seg current">
								{name}
							</span>
						) : (
							<button
								key={segPath}
								type="button"
								className="breadcrumb-seg"
								onClick={() => onNavigate(segPath)}
							>
								{name}
							</button>
						),
					];
				})}
			</nav>

			<Modal open={modalOpen} onClose={() => setModalOpen(false)}>
				<Modal.Header>Navigate to</Modal.Header>
				<Modal.Body>
					<div className="path-modal-list">
						{allSegments.map((s, i) => (
							<button
								key={s.path}
								type="button"
								className={`path-modal-item${s.path === path ? " active" : ""}`}
								onClick={() => {
									onNavigate(s.path);
									setModalOpen(false);
								}}
							>
								<span
									className="text-muted"
									style={{ minWidth: `${i}rem`, display: "inline-block" }}
								/>
								<Icon
									icon={i === 0 ? "solar:home-linear" : "solar:folder-linear"}
									width={13}
									className="text-muted"
								/>
								<span>{s.name}</span>
							</button>
						))}
					</div>
				</Modal.Body>
			</Modal>
		</>
	);
}
