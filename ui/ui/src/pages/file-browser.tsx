import { Icon } from "../components/icon";
import {
	lazy,
	Suspense,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/button";
import { Modal } from "../components/modal";
import { RenameModal } from "../components/rename-modal";
import { filesApi } from "../features/files/api";
import { Breadcrumb } from "../features/files/breadcrumb";
import { BrowserMenu } from "../features/files/browser-menu";
import { LoadingState } from "../components/loading-state";
import { FileColumns, FileList } from "../features/files/file-list";
import { EmptyFolder } from "../features/files/empty-folder";
import { GalleryView, ZOOM_MIN } from "../features/files/gallery-view";
import { PreviewBoundary } from "../features/files/preview-boundary";
import { baseName, joinPath, parentOf } from "../features/files/path";
import { FileFinder } from "../features/files/file-finder";
import { fuzzyEntries } from "../features/files/fuzzy-search";
import { sortEntries } from "../features/files/sort";
import { useBrowserPreferences } from "../features/files/use-browser-preferences";
import type { SortKey } from "../features/files/types";
import { useDirectory } from "../features/files/use-directory";
import { useFileUpload } from "../features/files/use-file-upload";
import { downloadUrl, errorMessage } from "../lib/api";

import "./file-browser.css";

const FilePreview = lazy(() =>
	import("../features/files/file-preview").then((module) => ({
		default: module.FilePreview,
	})),
);

export function FileBrowser() {
	const location = useLocation();
	const routerNavigate = useNavigate();

	const path = decodeURIComponent(location.pathname) || "/";

	const navigate = (p: string, knownKind?: "file" | "directory") => {
		const entry = data?.entries.find(
			(entry) => joinPath(path, entry.name) === p,
		);
		const kind =
			p === "/" || p === parentOf(path)
				? "directory"
				: entry
					? entry.is_dir
						? "directory"
						: "file"
					: undefined;
		if (p === "/") {
			routerNavigate("/", { state: { entryKind: "directory" } });
			return;
		}
		const encoded = p
			.split("/")
			.map((seg) => encodeURIComponent(seg))
			.join("/");
		routerNavigate(encoded, { state: { entryKind: knownKind ?? kind } });
	};

	const {
		data,
		error,
		setError,
		loading,
		isFile,
		refresh: refreshListing,
	} = useDirectory(
		path,
		location.state?.entryKind === "file"
			? true
			: location.state?.entryKind === "directory"
				? false
				: undefined,
	);

	const { viewMode, setViewMode, sortKey, setSortKey, sortDir, setSortDir } =
		useBrowserPreferences();
	const [query, setQuery] = useState("");
	const [finderPath, setFinderPath] = useState<string | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const searchFocusPending = useRef(false);

	const [newFolderOpen, setNewFolderOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [galleryCols, setGalleryCols] = useState(5);
	const [zoomMax, setZoomMax] = useState(8);

	const [selectMode, setSelectMode] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
	const [batchDeleting, setBatchDeleting] = useState(false);
	useLayoutEffect(() => {
		if (!selectMode && searchFocusPending.current) {
			searchFocusPending.current = false;
			searchRef.current?.focus();
			searchRef.current?.select();
		}
	}, [selectMode]);

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
		if (selected.size === sortedEntries.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(sortedEntries.map((e) => e.name)));
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
		setQuery("");
		setFinderPath((current) => (current === path ? current : null));
	}, [path]);

	useEffect(() => {
		setSelected(new Set());
	}, [query]);
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement;
			if (
				event.defaultPrevented ||
				document.querySelector(
					"dialog[open], .carousel-overlay, .popup-menu",
				) ||
				target.closest(
					'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
				)
			)
				return;
			if (
				(event.key.toLowerCase() === "f" || event.key === "/") &&
				!event.metaKey &&
				!event.ctrlKey &&
				!event.altKey &&
				!event.isComposing
			) {
				if (event.key.toLowerCase() === "f") {
					event.preventDefault();
					searchFocusPending.current = false;
					setFinderPath(path);
				} else if (!isFile) {
					event.preventDefault();
					setSelectMode(false);
					setSelected(new Set());
					if (searchRef.current) {
						searchRef.current.focus();
						searchRef.current.select();
					} else {
						// Selection mode remounts the input; focus before the next paint.
						searchFocusPending.current = true;
					}
				}
			}
			if (event.key === "Escape") {
				setSelectMode(false);
				setSelected(new Set());
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isFile, path]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const {
		uploadState,
		conflictFile,
		applyAll,
		setApplyAll,
		resolveConflict,
		handleUpload,
		handleDropUpload,
	} = useFileUpload(isFile ? parentOf(path) : path, refreshListing, setError);

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
		if (!e.dataTransfer.types.includes("Files")) return;
		dragCounter.current++;
		if (dragCounter.current === 1) setDragOver(true);
	};
	const onDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		dragCounter.current = Math.max(0, dragCounter.current - 1);
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
		() =>
			!isFile && data
				? fuzzyEntries(sortEntries(data.entries, sortKey, sortDir), query)
				: [],
		[data, isFile, sortKey, sortDir, query],
	);
	const fileMenu = (previewOptions?: React.ReactNode) => (
		<BrowserMenu
			path={path}
			isFile={true}
			viewMode={viewMode}
			setViewMode={setViewMode}
			sortKey={sortKey}
			sortDir={sortDir}
			toggleSort={toggleSort}
			onFind={() => setFinderPath(path)}
			onSelect={() => setSelectMode(true)}
			onNewFolder={() => setNewFolderOpen(true)}
			onUpload={() => fileInputRef.current?.click()}
			onRename={() => setRenameOpen(true)}
			onDelete={() => setDeleteOpen(true)}
			previewOptions={previewOptions}
		/>
	);

	return (
		<div className="page-shell animate-fadeUp">
			<Breadcrumb path={path} onNavigate={navigate} />
			<section className="browser-heading">
				<div className="browser-heading-copy">
					<div className="eyebrow">
						{isFile ? "FILE PREVIEW" : "YOUR WORKSPACE"}
					</div>
					<h1 title={path === "/" ? "All files" : baseName(path)}>
						{path === "/" ? "All files" : baseName(path)}
					</h1>
					<p>
						{isFile
							? "A closer look, without leaving your workspace."
							: loading && !data
								? "Getting your files ready…"
								: `${data?.entries.filter((entry) => entry.is_dir).length ?? 0} folders · ${data?.entries.filter((entry) => !entry.is_dir).length ?? 0} files`}
					</p>
				</div>
				{isFile ? (
					<div className="heading-actions">
						<Button onClick={() => navigate(parentOf(path))}>
							<Icon icon="solar:arrow-left-linear" width={18} />
							Back to folder
						</Button>
						<a
							className="btn btn-primary"
							aria-label="Download current file"
							href={downloadUrl(path)}
						>
							<Icon icon="solar:download-square-linear" width={18} />
							Download file
						</a>
					</div>
				) : (
					<div className="heading-actions">
						<Button
							onClick={() => setNewFolderOpen(true)}
							aria-label="Create folder"
						>
							<Icon icon="solar:add-folder-linear" width={18} />
							<span>New folder</span>
						</Button>
						<Button
							variant="primary"
							onClick={() => fileInputRef.current?.click()}
							aria-label="Upload files"
						>
							<Icon icon="solar:upload-square-linear" width={18} />
							<span>Upload files</span>
						</Button>
					</div>
				)}
			</section>

			{error && (
				<div className="error-box" role="alert">
					<span>{error}</span>
					<Button
						variant="ghost"
						onClick={() => {
							setError(null);
							void refreshListing();
						}}
					>
						Try again
					</Button>
				</div>
			)}

			<div className="flex-1">
				<div
					className={`datatable-wrapper${dragOver ? " drag-over" : ""}`}
					aria-busy={loading}
					onDragEnter={onDragEnter}
					onDragLeave={onDragLeave}
					onDragOver={onDragOver}
					onDrop={onDrop}
				>
					{dragOver && (
						<div className="drop-overlay">
							<Icon icon="solar:upload-square-linear" width={40} />
							<strong>Drop to upload</strong>
							<span>Your files will be added to this folder</span>
						</div>
					)}
					{!isFile && (
						<div className="file-list-header">
							<div className="toolbar-group">
								{selectMode ? (
									<>
										<input
											type="checkbox"
											className="select-checkbox"
											checked={
												!!data &&
												sortedEntries.length > 0 &&
												selected.size === sortedEntries.length
											}
											ref={(el) => {
												if (el)
													el.indeterminate =
														selected.size > 0 &&
														(!data || selected.size < sortedEntries.length);
											}}
											aria-label="Select all visible files"
											onChange={toggleSelectAll}
										/>
										<span className="select-action-count">
											{selected.size} selected
										</span>
										{selected.size > 0 && (
											<>
												<Button
													variant="ghost"
													aria-label="Download selected"
													title="Download selected"
													onClick={handleBatchDownload}
												>
													<Icon
														icon="solar:download-square-linear"
														width={15}
													/>
												</Button>
												<Button
													variant="danger"
													aria-label="Delete selected"
													title="Delete selected"
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
											aria-label="Parent folder"
											title="Parent folder"
											onClick={() => navigate(parentOf(path))}
										>
											<Icon icon="solar:arrow-left-linear" width={15} />
											{isFile && <span>Back to folder</span>}
										</Button>
									)
								)}
								{!isFile && !selectMode && (
									<div className="file-search">
										<Icon
											icon="solar:minimalistic-magnifer-linear"
											width={18}
										/>
										<input
											ref={searchRef}
											type="search"
											aria-label="Search this folder"
											placeholder="Filter this folder…"
											title="Match filename characters in order. Press / to filter this folder, Enter to open the best match."
											value={query}
											onChange={(event) => setQuery(event.target.value)}
											onKeyDown={(event) => {
												if (event.nativeEvent.isComposing) return;
												if (event.key === "Enter" && sortedEntries[0]) {
													event.preventDefault();
													navigate(joinPath(path, sortedEntries[0].name));
												}
												if (event.key === "ArrowDown") {
													event.preventDefault();
													document
														.querySelector<HTMLElement>(
															".file-list-item, .gallery-item",
														)
														?.focus();
												}
												if (event.key === "Escape") {
													setQuery("");
													searchRef.current?.blur();
												}
											}}
										/>
										{query ? (
											<button
												className="icon-btn"
												aria-label="Clear search"
												onClick={() => {
													setQuery("");
													searchRef.current?.focus();
												}}
											>
												<Icon icon="solar:close-circle-linear" width={16} />
											</button>
										) : (
											<kbd>/</kbd>
										)}
									</div>
								)}
							</div>
							<div className="toolbar-group toolbar-end">
								{!isFile && !selectMode && (
									<>
										<Button
											className="refresh-button"
											variant="ghost"
											aria-label="Refresh folder"
											title="Refresh folder"
											disabled={loading}
											onClick={() => void refreshListing()}
										>
											<Icon icon="solar:refresh-linear" width={17} />
										</Button>
										<div className="view-switch" aria-label="View mode">
											<button
												aria-label="List view"
												title="List view"
												aria-pressed={viewMode === "list"}
												onClick={() => setViewMode("list")}
											>
												<Icon icon="solar:list-linear" width={18} />
											</button>
											<button
												aria-label="Gallery view"
												title="Gallery view"
												aria-pressed={viewMode === "gallery"}
												onClick={() => setViewMode("gallery")}
											>
												<Icon icon="solar:widget-linear" width={18} />
											</button>
										</div>
									</>
								)}
								{!isFile && viewMode === "gallery" && (
									<input
										type="range"
										aria-label="Thumbnail size"
										className="zoom-slider"
										min={ZOOM_MIN}
										max={zoomMax}
										value={zoomMax + ZOOM_MIN - galleryCols}
										onChange={(e) =>
											setGalleryCols(
												zoomMax + ZOOM_MIN - Number(e.target.value),
											)
										}
									/>
								)}
								{selectMode ? (
									<Button
										variant="ghost"
										aria-label="Cancel selection"
										onClick={exitSelectMode}
									>
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
										onFind={() => setFinderPath(path)}
										onSelect={() => setSelectMode(true)}
										onNewFolder={() => setNewFolderOpen(true)}
										onUpload={() => fileInputRef.current?.click()}
										onRename={() => setRenameOpen(true)}
										onDelete={() => setDeleteOpen(true)}
									/>
								)}
							</div>
						</div>
					)}
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

					{!isFile && (
						<FileColumns
							gallery={viewMode === "gallery"}
							searching={!!query.trim()}
							selecting={selectMode}
							sortKey={sortKey}
							sortDir={sortDir}
							onSort={toggleSort}
						/>
					)}
					<div className="datatable-scroll" key={path}>
						{isFile ? (
							<PreviewBoundary key={path} path={path}>
								<Suspense
									fallback={
										<div className="file-preview">
											<div className="file-list-header">
												<span className="toolbar-caption">
													Loading preview…
												</span>
											</div>
											<div className="preview-status">
												Getting your file ready…
											</div>
											<LoadingState label="Loading preview…" />
										</div>
									}
								>
									<FilePreview
										path={path}
										onBack={() => navigate(parentOf(path))}
										renderMenu={fileMenu}
									/>
								</Suspense>
							</PreviewBoundary>
						) : loading && !data ? (
							<LoadingState label="Loading files…" />
						) : sortedEntries.length === 0 ? (
							<EmptyFolder
								filtered={!!query.trim()}
								onClear={() => setQuery("")}
								onUpload={() => fileInputRef.current?.click()}
							/>
						) : viewMode === "gallery" ? (
							<GalleryView
								query={query}
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
						) : (
							<FileList
								query={query}
								entries={sortedEntries}
								path={path}
								selectMode={selectMode}
								selected={selected}
								onSelect={toggleSelect}
								onNavigate={navigate}
							/>
						)}
					</div>
					<footer className="browser-status">
						<span aria-live="polite">
							{isFile
								? "File preview"
								: loading && !data
									? "Loading…"
									: selected.size
										? `${selected.size} selected`
										: `${sortedEntries.length}${query ? ` of ${data?.entries.length ?? 0}` : ""} items`}
						</span>
						<span className="status-hint">
							{isFile
								? "Text options in ···"
								: query.trim()
									? "Best matches first · Enter to open"
									: "/ filter folder · f find all files"}
						</span>
						<span className="status-mobile">
							{isFile
								? "Preview"
								: viewMode === "list"
									? "List view"
									: "Gallery view"}
						</span>
					</footer>
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

			{finderPath === path && (
				<FileFinder
					onClose={() => setFinderPath(null)}
					onOpen={(entry) => {
						setFinderPath(null);
						navigate(entry.path, entry.is_dir ? "directory" : "file");
					}}
				/>
			)}

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
