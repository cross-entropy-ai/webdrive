import { Icon } from "../../components/icon";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
	type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/button";
import { downloadUrl } from "../../lib/api";
import type { SortKey, SortDirection, ViewMode } from "./types";

export type BrowserMenuProps = {
	previewOptions?: ReactNode;
	path: string;
	isFile: boolean;
	viewMode: ViewMode;
	setViewMode: (mode: ViewMode) => void;
	sortKey: SortKey;
	sortDir: SortDirection;
	toggleSort: (key: SortKey) => void;
	onFind: () => void;
	onSelect: () => void;
	onNewFolder: () => void;
	onUpload: () => void;
	onRename: () => void;
	onDelete: () => void;
};

export function BrowserMenu({
	previewOptions,
	path,
	isFile,
	viewMode,
	setViewMode,
	sortKey,
	sortDir,
	toggleSort,
	onFind,
	onSelect,
	onNewFolder,
	onUpload,
	onRename,
	onDelete,
}: BrowserMenuProps) {
	// Popup menu
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<CSSProperties>({});
	useLayoutEffect(() => {
		if (!menuOpen) return;
		const place = () => {
			const anchor = menuRef.current?.getBoundingClientRect();
			if (!anchor) return;
			const below = window.innerHeight - anchor.bottom - 16;
			const above = anchor.top - 16;
			const upward = below < 220 && above > below;
			setPosition({
				position: "fixed",
				top: upward ? "auto" : anchor.bottom + 8,
				bottom: upward ? window.innerHeight - anchor.top + 8 : "auto",
				right: Math.max(8, window.innerWidth - anchor.right),
				maxHeight: Math.max(80, upward ? above : below),
				maxWidth: "calc(100vw - 16px)",
				marginTop: 0,
				zIndex: 70,
			});
		};
		place();
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [menuOpen]);

	useEffect(() => {
		if (!menuOpen) return;
		const onClick = (e: MouseEvent) => {
			if (
				!menuRef.current?.contains(e.target as Node) &&
				!popupRef.current?.contains(e.target as Node)
			) {
				setMenuOpen(false);
			}
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setMenuOpen(false);
				menuRef.current?.querySelector("button")?.focus();
			}
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				const items = Array.from(
					popupRef.current?.querySelectorAll<HTMLElement>(
						".popup-item:not(:disabled)",
					) ?? [],
				);
				const index = items.indexOf(document.activeElement as HTMLElement);
				event.preventDefault();
				const next =
					index < 0
						? event.key === "ArrowDown"
							? 0
							: items.length - 1
						: (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
							items.length;
				items[next]?.focus();
			}
		};
		document.addEventListener("mousedown", onClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [menuOpen]);

	return (
		<div className="popup-anchor" ref={menuRef}>
			<Button
				variant="ghost"
				aria-label="More actions"
				title="More actions"
				aria-expanded={menuOpen}
				onClick={() => setMenuOpen(!menuOpen)}
			>
				<Icon icon="solar:menu-dots-bold" width={15} />
			</Button>
			{menuOpen &&
				createPortal(
					<div className="popup-menu" ref={popupRef} style={position}>
						<button
							type="button"
							className="popup-item"
							onClick={() => {
								setMenuOpen(false);
								onFind();
							}}
						>
							<Icon icon="solar:minimalistic-magnifer-linear" width={14} />
							Find in subfolders <kbd style={{ marginLeft: "auto" }}>f</kbd>
						</button>
						<div className="popup-divider" />
						{previewOptions}
						{previewOptions && <div className="popup-divider" />}
						{!isFile && (
							<>
								<button
									type="button"
									className="popup-item"
									onClick={() => {
										onSelect();
										setMenuOpen(false);
									}}
								>
									<Icon icon="solar:check-square-linear" width={14} />
									Select
								</button>
								<div className="popup-divider" />
								<button
									type="button"
									className="popup-item"
									onClick={() => {
										setViewMode("list");
										setMenuOpen(false);
									}}
								>
									<span className="popup-check">
										{viewMode === "list" && (
											<Icon icon="solar:check-circle-bold" width={14} />
										)}
									</span>
									<Icon icon="solar:list-linear" width={14} />
									List
								</button>
								<button
									type="button"
									className="popup-item"
									onClick={() => {
										setViewMode("gallery");
										setMenuOpen(false);
									}}
								>
									<span className="popup-check">
										{viewMode === "gallery" && (
											<Icon icon="solar:check-circle-bold" width={14} />
										)}
									</span>
									<Icon icon="solar:widget-linear" width={14} />
									Gallery
								</button>
								<div className="popup-divider" />
								{(
									[
										["name", "Name"],
										["mod_time", "Date"],
										["size", "Size"],
									] as const
								).map(([key, label]) => (
									<button
										key={key}
										type="button"
										className="popup-item"
										onClick={() => {
											toggleSort(key);
											setMenuOpen(false);
										}}
									>
										<span className="popup-check">
											{sortKey === key && (
												<Icon icon="solar:check-circle-bold" width={14} />
											)}
										</span>
										<span>
											{label}
											{sortKey === key && (
												<span className="text-muted">
													{" "}
													· {sortDir === "asc" ? "Asc" : "Desc"}
												</span>
											)}
										</span>
									</button>
								))}
								<div className="popup-divider" />
							</>
						)}
						{!isFile && (
							<button
								type="button"
								className="popup-item"
								onClick={() => {
									onNewFolder();
									setMenuOpen(false);
								}}
							>
								<Icon icon="solar:add-folder-linear" width={14} />
								New Folder
							</button>
						)}
						{!isFile && (
							<button
								type="button"
								className="popup-item"
								onClick={() => {
									onUpload();
									setMenuOpen(false);
								}}
							>
								<Icon icon="solar:upload-square-linear" width={14} />
								Upload
							</button>
						)}
						<a
							href={downloadUrl(path)}
							target="_blank"
							rel="noreferrer"
							className="popup-item"
							onClick={() => setMenuOpen(false)}
						>
							<Icon icon="solar:download-square-linear" width={14} />
							Download
						</a>
						{path !== "/" && (
							<button
								type="button"
								className="popup-item"
								onClick={() => {
									onRename();
									setMenuOpen(false);
								}}
							>
								<Icon icon="solar:pen-linear" width={14} />
								Rename
							</button>
						)}
						{path !== "/" && (
							<button
								type="button"
								className="popup-item text-danger"
								onClick={() => {
									onDelete();
									setMenuOpen(false);
								}}
							>
								<Icon icon="solar:trash-bin-2-linear" width={14} />
								Delete
							</button>
						)}
					</div>,
					document.body,
				)}
		</div>
	);
}
