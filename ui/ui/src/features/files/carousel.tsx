import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import { downloadUrl, previewUrl } from "../../lib/api";

export function Carousel({
	items,
	startIndex,
	onClose,
	onOpen,
}: {
	items: { name: string; path: string; type: "image" | "video" }[];
	startIndex: number;
	onClose: () => void;
	onOpen: (path: string) => void;
}) {
	const [index, setIndex] = useState(startIndex);
	const touchStartX = useRef(0);

	const item = items[index];
	const hasPrev = index > 0;
	const hasNext = index < items.length - 1;

	const prev = () => setIndex((i) => Math.max(0, i - 1));
	const next = () => setIndex((i) => Math.min(items.length - 1, i + 1));

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowLeft") prev();
			if (e.key === "ArrowRight") next();
			if (e.key === "Enter" && item) onOpen(item.path);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [index, item, items.length, onClose, onOpen]);

	const onTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0]?.clientX ?? 0;
	};
	const onTouchEnd = (e: React.TouchEvent) => {
		const touch = e.changedTouches[0];
		if (!touch) return;
		const dx = touch.clientX - touchStartX.current;
		if (dx > 60) prev();
		else if (dx < -60) next();
	};

	if (!item) return null;

	return (
		<div
			className="carousel-overlay"
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
		>
			<div className="carousel-backdrop" onClick={onClose} />

			{/* Top bar */}
			<div className="carousel-topbar">
				<span className="carousel-filename">{item.name}</span>
				<span className="text-sm text-muted">
					{index + 1} / {items.length}
				</span>
				<div className="toolbar-group">
					<button
						type="button"
						className="carousel-btn"
						onClick={() => onOpen(item.path)}
					>
						<Icon icon="solar:maximize-linear" width={16} />
					</button>
					<a
						href={downloadUrl(item.path)}
						target="_blank"
						rel="noreferrer"
						className="carousel-btn"
					>
						<Icon icon="solar:download-square-linear" width={16} />
					</a>
					<button type="button" className="carousel-btn" onClick={onClose}>
						<Icon icon="solar:close-circle-linear" width={16} />
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="carousel-content">
				{item.type === "image" ? (
					<img key={item.path} src={previewUrl(item.path)} alt={item.name} />
				) : (
					<video
						key={item.path}
						src={previewUrl(item.path)}
						controls
						autoPlay
					/>
				)}
			</div>

			{/* Arrows */}
			{hasPrev && (
				<button
					type="button"
					className="carousel-arrow carousel-arrow-left"
					onClick={prev}
				>
					<Icon icon="solar:alt-arrow-left-linear" width={24} />
				</button>
			)}
			{hasNext && (
				<button
					type="button"
					className="carousel-arrow carousel-arrow-right"
					onClick={next}
				>
					<Icon icon="solar:alt-arrow-right-linear" width={24} />
				</button>
			)}
		</div>
	);
}
