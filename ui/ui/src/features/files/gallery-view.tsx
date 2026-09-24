import { FilenameMatch } from "./filename-match";
import { Icon } from "../../components/icon";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { previewUrl } from "../../lib/api";
import { Carousel } from "./carousel";
import { fileIcon, mediaTypeFromName } from "./file-types";
import { joinPath } from "./path";
import type { Entry } from "./types";

export const ZOOM_MIN = 1;
const TILE_MIN_PX = 150;

export function GalleryView({
	query = "",
	entries,
	dirPath,
	onNavigate,
	cols,
	onColsChange,
	onZoomMaxChange,
	selectMode,
	selected,
	onToggleSelect,
}: {
	entries: Entry[];
	query?: string;
	dirPath: string;
	onNavigate: (p: string) => void;
	cols: number;
	onColsChange: (c: number) => void;
	onZoomMaxChange: (max: number) => void;
	selectMode?: boolean;
	selected?: Set<string>;
	onToggleSelect?: (name: string) => void;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const pinchRef = useRef<number | null>(null);
	const colsAtPinchStart = useRef(cols);
	const colsRef = useRef(cols);
	const onColsChangeRef = useRef(onColsChange);
	const onZoomMaxChangeRef = useRef(onZoomMaxChange);
	colsRef.current = cols;
	onColsChangeRef.current = onColsChange;
	onZoomMaxChangeRef.current = onZoomMaxChange;

	const maxRef = useRef(0);

	useLayoutEffect(() => {
		const el = gridRef.current;
		if (!el) return;

		const updateMax = () => {
			if (!el.clientWidth) return;
			const max = Math.max(
				ZOOM_MIN,
				Math.floor((el.clientWidth - 24) / (TILE_MIN_PX + 12)),
			);
			if (max === maxRef.current) return;
			maxRef.current = max;
			onZoomMaxChangeRef.current(max);
			if (colsRef.current > max) onColsChangeRef.current(max);
		};
		updateMax();
		const ro = new ResizeObserver(updateMax);
		ro.observe(el);

		const clamp = (n: number) =>
			Math.min(maxRef.current, Math.max(ZOOM_MIN, n));

		const onWheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			onColsChangeRef.current(clamp(colsRef.current + (e.deltaY > 0 ? 1 : -1)));
		};

		const onTouchStart = (e: TouchEvent) => {
			const [first, second] = Array.from(e.touches);
			if (e.touches.length === 2 && first && second) {
				const dx = first.clientX - second.clientX;
				const dy = first.clientY - second.clientY;
				pinchRef.current = Math.hypot(dx, dy);
				colsAtPinchStart.current = colsRef.current;
			}
		};

		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 2 || pinchRef.current === null) return;
			const [first, second] = Array.from(e.touches);
			if (!first || !second || pinchRef.current === 0) return;
			e.preventDefault();
			const dx = first.clientX - second.clientX;
			const dy = first.clientY - second.clientY;
			const dist = Math.hypot(dx, dy);
			const scale = dist / pinchRef.current;
			const newCols = Math.round(colsAtPinchStart.current / scale);
			onColsChangeRef.current(clamp(newCols));
		};

		const onTouchEnd = () => {
			pinchRef.current = null;
		};

		el.addEventListener("wheel", onWheel, { passive: false });
		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", onTouchEnd);

		return () => {
			ro.disconnect();
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", onTouchEnd);
		};
	}, []);

	const [carouselIndex, setCarouselIndex] = useState<number | null>(null);

	const mediaItems = useMemo(
		() =>
			entries.flatMap((entry) => {
				const type = mediaTypeFromName(entry.name);
				if (entry.is_dir || (type !== "image" && type !== "video")) return [];
				return [
					{ name: entry.name, path: joinPath(dirPath, entry.name), type },
				];
			}),
		[entries, dirPath],
	);

	const openCarousel = (entryName: string) => {
		const idx = mediaItems.findIndex((m) => m.name === entryName);
		if (idx >= 0) setCarouselIndex(idx);
	};

	return (
		<>
			<div
				ref={gridRef}
				className="gallery-grid"
				style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
			>
				{entries.map((entry) => {
					const fullPath = joinPath(dirPath, entry.name);
					const media = entry.is_dir ? null : mediaTypeFromName(entry.name);
					const isPreviewable = media === "image" || media === "video";
					const isSelected = selectMode && selected?.has(entry.name);

					return (
						<button
							key={entry.name}
							type="button"
							className={`gallery-item${isPreviewable ? " gallery-media" : ""}${isSelected ? " selected" : ""}`}
							onClick={() =>
								selectMode && onToggleSelect
									? onToggleSelect(entry.name)
									: isPreviewable
										? openCarousel(entry.name)
										: onNavigate(fullPath)
							}
							title={entry.name}
							aria-label={entry.name}
							aria-pressed={selectMode ? !!isSelected : undefined}
						>
							{selectMode && (
								<span
									className={`gallery-selection selection-mark${isSelected ? " checked" : ""}`}
									aria-hidden="true"
								>
									{isSelected && "✓"}
								</span>
							)}
							{isPreviewable ? (
								<>
									{media === "image" ? (
										<img
											src={previewUrl(fullPath)}
											alt={entry.name}
											loading="lazy"
										/>
									) : (
										<video
											src={previewUrl(fullPath)}
											muted
											preload="metadata"
										/>
									)}
									{media === "video" && (
										<div className="gallery-play">
											<Icon icon="solar:play-bold" width={20} />
										</div>
									)}
									<div className="gallery-hover-name">
										<FilenameMatch name={entry.name} query={query} />
									</div>
								</>
							) : (
								<>
									<Icon
										icon={fileIcon(entry.name, entry.is_dir)}
										width={24}
										className={entry.is_dir ? "text-accent" : "text-muted"}
									/>
									<span className="gallery-file-name">
										<FilenameMatch name={entry.name} query={query} />
									</span>
								</>
							)}
						</button>
					);
				})}
			</div>
			{carouselIndex !== null && (
				<Carousel
					items={mediaItems}
					startIndex={carouselIndex}
					onClose={() => setCarouselIndex(null)}
					onOpen={(p) => {
						setCarouselIndex(null);
						onNavigate(p);
					}}
				/>
			)}
		</>
	);
}
