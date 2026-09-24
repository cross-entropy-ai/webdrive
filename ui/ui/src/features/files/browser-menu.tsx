import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/button";
import { downloadUrl } from "../../lib/api";
import type { SortKey, SortDirection, ViewMode } from "./types";

type BrowserMenuProps = {
	path: string;
	isFile: boolean;
	viewMode: ViewMode;
	setViewMode: (mode: ViewMode) => void;
	sortKey: SortKey;
	sortDir: SortDirection;
	toggleSort: (key: SortKey) => void;
	onSelect: () => void;
	onNewFolder: () => void;
	onUpload: () => void;
	onRename: () => void;
	onDelete: () => void;
};

export function BrowserMenu({
	path,
	isFile,
	viewMode,
	setViewMode,
	sortKey,
	sortDir,
	toggleSort,
	onSelect,
	onNewFolder,
	onUpload,
	onRename,
	onDelete,
}: BrowserMenuProps) {
	// Popup menu
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, [menuOpen]);

	return (
		<div className="popup-anchor" ref={menuRef}>
			<Button variant="ghost" onClick={() => setMenuOpen(!menuOpen)}>
				<Icon icon="solar:menu-dots-bold" width={15} />
			</Button>
			{menuOpen && (
				<div className="popup-menu">
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
				</div>
			)}
		</div>
	);
}
