import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/button";
import { Modal } from "../components/modal";
import { RenameModal } from "../components/rename-modal";
import { filesApi } from "../features/files/api";
import { Breadcrumb } from "../features/files/breadcrumb";
import { BrowserMenu } from "../features/files/browser-menu";
import { FilePreview } from "../features/files/file-preview";
import { fileIcon } from "../features/files/file-types";
import { GalleryView, ZOOM_MIN } from "../features/files/gallery-view";
import { baseName, joinPath, parentOf } from "../features/files/path";
import { sortEntries } from "../features/files/sort";
import type { SortDirection, SortKey, ViewMode } from "../features/files/types";
import { useDirectory } from "../features/files/use-directory";
import { useFileUpload } from "../features/files/use-file-upload";
import { downloadUrl, errorMessage } from "../lib/api";
import { formatBytes, formatTime } from "../lib/format";
import "./file-browser.css";

export function FileBrowser() {
	const location = useLocation();
	const routerNavigate = useNavigate();

	const path = decodeURIComponent(location.pathname) || "/";

	const navigate = (p: string) => {
		if (p === "/") {
			routerNavigate("/");
			return;
		}
		const encoded = p
			.split("/")
			.map((seg) => encodeURIComponent(seg))
			.join("/");
		routerNavigate(encoded);
	};

	const {
		data,
		error,
		setError,
		loading,
		isFile,
		refresh: refreshListing,
	} = useDirectory(path);

	const [sortKey, setSortKey] = useState<SortKey>("name");
	const [sortDir, setSortDir] = useState<SortDirection>("asc");

	const [newFolderOpen, setNewFolderOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [galleryCols, setGalleryCols] = useState(5);
	const [zoomMax, setZoomMax] = useState(8);

	const [selectMode, setSelectMode] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
	const [batchDeleting, setBatchDeleting] = useState(false);

	const toggleSelect = (name: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (!data) return;
		if (selected.size === data.entries.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(data.entries.map((e) => e.name)));
		}
	};

	const exitSelectMode = () => {
		setSelectMode(false);
		setSelected(new Set());
	};

	const handleBatchDownload = () => {
		window.open(
			downloadUrl(Array.from(selected, (name) => joinPath(path, name))),
			"_blank",
		);
	};

	const handleBatchDelete = async () => {
		setBatchDeleting(true);
		try {
			const paths = Array.from(selected).map((name) => joinPath(path, name));
			await filesApi.delete(paths);
		} catch (e: unknown) {
			setError(errorMessage(e));
		} finally {
			// A batch can partially succeed, so refresh even when it reports errors.
			await refreshListing();
			exitSelectMode();
			setBatchDeleting(false);
			setBatchDeleteOpen(false);
		}
	};

	useEffect(() => {
		setSelectMode(false);
		setSelected(new Set());
	}, [path]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const {
		uploadState,
		conflictFile,
		applyAll,
		setApplyAll,
		resolveConflict,
		handleUpload,
		handleDropUpload,
	} = useFileUpload(path, refreshListing, setError);

	const handleNewFolder = async (name: string) => {
		await filesApi.mkdir(path, name);
		await refreshListing();
	};

	const handleRename = async (newName: string) => {
		await filesApi.rename(path, newName);
		navigate(joinPath(parentOf(path), newName));
	};

	const handleDelete = async () => {
		setDeleting(true);
		try {
			await filesApi.delete([path]);
			navigate(parentOf(path));
		} catch (e: unknown) {
			setError(errorMessage(e));
		} finally {
			setDeleting(false);
			setDeleteOpen(false);
		}
	};

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir(sortDir === "asc" ? "desc" : "asc");
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	};

	const [dragOver, setDragOver] = useState(false);
	const dragCounter = useRef(0);

	const onDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current++;
		if (dragCounter.current === 1) setDragOver(true);
	};
	const onDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current--;
		if (dragCounter.current === 0) setDragOver(false);
	};
	const onDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};
	const onDrop = (e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current = 0;
		setDragOver(false);
		if (e.dataTransfer) handleDropUpload(e.dataTransfer);
	};

	const sortedEntries = useMemo(
		() => (!isFile && data ? sortEntries(data.entries, sortKey, sortDir) : []),
		[data, isFile, sortKey, sortDir],
	);

	return (
		<div className="page-shell animate-fadeUp">
			<Breadcrumb path={path} onNavigate={navigate} />

			{error && <div className="error-box">Error: {error}</div>}

			<div className="flex-1">
				<div
					className={`datatable-wrapper${dragOver ? " drag-over" : ""}`}
					onDragEnter={onDragEnter}
					onDragLeave={onDragLeave}
					onDragOver={onDragOver}
					onDrop={onDrop}
				>
					<div className="file-list-header">
						<div className="toolbar-group">
							{selectMode ? (
								<>
									<input
										type="checkbox"
										className="select-checkbox"
										checked={
											!!data &&
											data.entries.length > 0 &&
											selected.size === data.entries.length
										}
										ref={(el) => {
											if (el)
												el.indeterminate =
													selected.size > 0 &&
													(!data || selected.size < data.entries.length);
										}}
										onChange={toggleSelectAll}
									/>
									<span className="select-action-count">
										{selected.size} selected
									</span>
									{selected.size > 0 && (
										<>
											<Button variant="ghost" onClick={handleBatchDownload}>
												<Icon icon="solar:download-square-linear" width={15} />
											</Button>
											<Button
												variant="danger"
												onClick={() => setBatchDeleteOpen(true)}
											>
												<Icon icon="solar:trash-bin-2-linear" width={15} />
											</Button>
										</>
									)}
								</>
							) : (
								path !== "/" && (
									<Button
										variant="ghost"
										onClick={() => navigate(parentOf(path))}
									>
										<Icon icon="solar:arrow-left-linear" width={15} />
									</Button>
								)
							)}
						</div>
						<div className="toolbar-group">
							{!isFile && viewMode === "gallery" && (
								<input
									type="range"
									className="zoom-slider"
									min={ZOOM_MIN}
									max={zoomMax}
									value={zoomMax + ZOOM_MIN - galleryCols}
									onChange={(e) =>
										setGalleryCols(zoomMax + ZOOM_MIN - Number(e.target.value))
									}
								/>
							)}
							{selectMode ? (
								<Button variant="ghost" onClick={exitSelectMode}>
									<Icon icon="solar:close-circle-linear" width={15} />
								</Button>
							) : (
								<BrowserMenu
									path={path}
									isFile={isFile}
									viewMode={viewMode}
									setViewMode={setViewMode}
									sortKey={sortKey}
									sortDir={sortDir}
									toggleSort={toggleSort}
									onSelect={() => setSelectMode(true)}
									onNewFolder={() => setNewFolderOpen(true)}
									onUpload={() => fileInputRef.current?.click()}
									onRename={() => setRenameOpen(true)}
									onDelete={() => setDeleteOpen(true)}
								/>
							)}
						</div>
					</div>

					{uploadState &&
						(() => {
							const pct = Math.round(
								((uploadState.index + uploadState.fileProgress) /
									uploadState.total) *
									100,
							);
							return (
								<div className="upload-status">
									<div className="upload-status-info">
										<span className="upload-status-name">
											{uploadState.current}
										</span>
										<span className="text-muted text-xs">
											{uploadState.index + 1}/{uploadState.total} · {pct}%
										</span>
									</div>
									<div className="upload-progress-bar">
										<div
											className="upload-progress-fill"
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>
							);
						})()}

					<div className="datatable-scroll">
						{isFile ? (
							<FilePreview path={path} />
						) : loading && !data ? (
							<div className="datatable-state">loading...</div>
						) : viewMode === "gallery" ? (
							sortedEntries.length === 0 ? (
								<div className="datatable-state">Empty directory.</div>
							) : (
								<GalleryView
									key={path}
									entries={sortedEntries}
									dirPath={path}
									onNavigate={navigate}
									cols={galleryCols}
									onColsChange={setGalleryCols}
									onZoomMaxChange={setZoomMax}
									selectMode={selectMode}
									selected={selected}
									onToggleSelect={toggleSelect}
								/>
							)
						) : sortedEntries.length === 0 ? (
							<div className="datatable-state">Empty directory.</div>
						) : (
							<div className="file-list">
								{sortedEntries.map((entry) => (
									<button
										key={entry.name}
										type="button"
										className={`file-list-item${selectMode && selected.has(entry.name) ? " selected" : ""}`}
										onClick={() =>
											selectMode
												? toggleSelect(entry.name)
												: navigate(joinPath(path, entry.name))
										}
									>
										{selectMode && (
											<input
												type="checkbox"
												className="select-checkbox"
												checked={selected.has(entry.name)}
												readOnly
											/>
										)}
										<Icon
											icon={
												entry.is_dir
													? "solar:folder-bold-duotone"
													: fileIcon(entry.name, false)
											}
											width={22}
											className={entry.is_dir ? "text-accent" : "text-muted"}
										/>
										<div className="file-list-info">
											<span className="file-list-name">{entry.name}</span>
											<span className="file-list-meta">
												{entry.mod_time && formatTime(entry.mod_time)}
												{!entry.is_dir && entry.mod_time && " · "}
												{!entry.is_dir && formatBytes(entry.size)}
											</span>
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			<input
				type="file"
				ref={fileInputRef}
				multiple
				style={{ display: "none" }}
				onChange={(e) => {
					if (e.target.files && e.target.files.length > 0) {
						handleUpload(e.target.files);
						e.target.value = "";
					}
				}}
			/>

			<Modal
				open={conflictFile !== null}
				onClose={() => resolveConflict("cancel")}
			>
				<Modal.Header>File already exists</Modal.Header>
				<Modal.Body>
					<p>
						<strong>{conflictFile}</strong> already exists.
					</p>
					<label
						className="flex items-center gap-2"
						style={{ marginTop: "0.5rem" }}
					>
						<input
							type="checkbox"
							className="select-checkbox"
							style={{ pointerEvents: "auto" }}
							checked={applyAll}
							onChange={(e) => {
								setApplyAll(e.target.checked);
							}}
						/>
						<span className="text-sm text-muted">Apply to all conflicts</span>
					</label>
					<div
						className="flex justify-end gap-2"
						style={{ marginTop: "0.75rem" }}
					>
						<Button variant="ghost" onClick={() => resolveConflict("cancel")}>
							Cancel
						</Button>
						<Button variant="ghost" onClick={() => resolveConflict("skip")}>
							Skip
						</Button>
						<Button
							variant="primary"
							onClick={() => resolveConflict("overwrite")}
						>
							Overwrite
						</Button>
					</div>
				</Modal.Body>
			</Modal>

			<RenameModal
				open={newFolderOpen}
				onClose={() => setNewFolderOpen(false)}
				initialName=""
				onRename={handleNewFolder}
				title="New Folder"
				buttonLabel="Create"
			/>

			<RenameModal
				open={renameOpen}
				onClose={() => setRenameOpen(false)}
				initialName={baseName(path)}
				onRename={handleRename}
			/>

			<Modal open={deleteOpen} onClose={() => setDeleteOpen(false)}>
				<Modal.Header>Delete</Modal.Header>
				<Modal.Body>
					<p>
						Delete <strong>{baseName(path)}</strong>? This cannot be undone.
					</p>
					<div
						className="flex justify-end gap-2"
						style={{ marginTop: "0.75rem" }}
					>
						<Button variant="ghost" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDelete} disabled={deleting}>
							{deleting ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</Modal.Body>
			</Modal>

			<Modal open={batchDeleteOpen} onClose={() => setBatchDeleteOpen(false)}>
				<Modal.Header>Delete {selected.size} items</Modal.Header>
				<Modal.Body>
					<p>
						Delete <strong>{selected.size}</strong> selected item
						{selected.size > 1 ? "s" : ""}? This cannot be undone.
					</p>
					<div
						className="flex justify-end gap-2"
						style={{ marginTop: "0.75rem" }}
					>
						<Button variant="ghost" onClick={() => setBatchDeleteOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={handleBatchDelete}
							disabled={batchDeleting}
						>
							{batchDeleting ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</Modal.Body>
			</Modal>
		</div>
	);
}
