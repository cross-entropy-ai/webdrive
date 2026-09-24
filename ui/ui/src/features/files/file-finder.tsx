import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../components/icon";
import { Modal } from "../../components/modal";
import { errorMessage } from "../../lib/api";
import { filesApi } from "./api";
import { fileIcon } from "./file-types";
import { FilenameMatch } from "./filename-match";
import type { SearchEntry, SearchProgress } from "./types";
import "./file-finder.css";

// Mounted only while open, so closing also cancels pending work and clears the query.
export function FileFinder({
	onClose,
	onOpen,
}: {
	onClose: () => void;
	onOpen: (entry: SearchEntry) => void;
}) {
	const [query, setQuery] = useState("");
	const [response, setResponse] = useState<SearchProgress | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [activePath, setActivePath] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const id = useId();
	const entries = response?.entries ?? [];
	const active = Math.max(
		0,
		entries.findIndex((entry) => entry.path === activePath),
	);
	const pending = !!query.trim() && !error && response?.done !== true;

	useEffect(() => {
		if (!query.trim()) return;
		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			try {
				await filesApi.searchProgress(
					"/",
					query,
					controller.signal,
					(result) => {
						if (!controller.signal.aborted) setResponse(result);
					},
				);
			} catch (error) {
				if (!controller.signal.aborted) setError(errorMessage(error));
			}
		}, 200);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [query, attempt]);

	useEffect(() => {
		listRef.current
			?.querySelector('[aria-selected="true"]')
			?.scrollIntoView({ block: "nearest" });
	}, [active, response]);

	return (
		<Modal open onClose={onClose} className="finder-modal">
			<Modal.Header>Find files</Modal.Header>
			<div className="finder-scope">All files · from root</div>
			<div className="finder-input-row">
				<Icon icon="solar:minimalistic-magnifer-linear" width={20} />
				<input
					ref={inputRef}
					autoFocus
					role="combobox"
					aria-label="Find files"
					aria-autocomplete="list"
					aria-expanded={true}
					aria-controls={`${id}-results`}
					aria-activedescendant={
						entries[active] ? `${id}-${active}` : undefined
					}
					placeholder="Search by filename or path…"
					maxLength={128}
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setResponse(null);
						setError(null);
						setActivePath(null);
					}}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing) return;
						if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							if (entries.length) {
								const next =
									(active +
										(event.key === "ArrowDown" ? 1 : -1) +
										entries.length) %
									entries.length;
								setActivePath(entries[next]!.path);
							}
						}
						if (event.key === "Enter" && entries[active]) {
							event.preventDefault();
							onOpen(entries[active]);
						}
					}}
				/>
				<button
					type="button"
					className="icon-btn"
					aria-label="Close finder"
					onClick={onClose}
				>
					<Icon icon="solar:close-circle-linear" width={19} />
				</button>
			</div>
			<div className="finder-results" ref={listRef}>
				<div
					id={`${id}-results`}
					role="listbox"
					aria-label="Matching files"
					aria-busy={pending}
				>
					{entries.map((entry, index) => (
						<button
							key={entry.path}
							id={`${id}-${index}`}
							type="button"
							role="option"
							aria-selected={active === index}
							tabIndex={-1}
							className="finder-result"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => onOpen(entry)}
						>
							<Icon icon={fileIcon(entry.name, entry.is_dir)} width={22} />
							<span className="finder-result-copy">
								<strong>
									<FilenameMatch name={entry.name} query={query} />
								</strong>
								<small>
									<FilenameMatch name={entry.relative_path} query={query} />
								</small>
							</span>
							{entry.is_dir && <span className="finder-kind">Folder</span>}
						</button>
					))}
				</div>
				{!entries.length && (
					<div className="finder-empty" role={error ? "alert" : "status"}>
						{error ? (
							<>
								<span>{error}</span>
								<button
									className="btn"
									onClick={() => {
										setError(null);
										setAttempt((value) => value + 1);
										inputRef.current?.focus();
									}}
								>
									Try again
								</button>
							</>
						) : pending ? (
							"Searching all files…"
						) : query.trim() ? (
							"No matching files. Try fewer characters."
						) : (
							"Type a few characters to find files anywhere in your workspace."
						)}
					</div>
				)}
			</div>
			{error && entries.length > 0 && (
				<div className="finder-stream-error" role="alert">
					{error}
					<button
						className="btn"
						onClick={() => {
							setError(null);
							setResponse(null);
							setAttempt((value) => value + 1);
							inputRef.current?.focus();
						}}
					>
						Try again
					</button>
				</div>
			)}
			<div className="finder-footer">
				<span role="status">
					{pending
						? `Searching… · ${entries.length} matches so far`
						: response?.partial
							? "Partial results — some folders could not be searched."
							: response?.has_more
								? "Top 100 matches · keep typing to narrow"
								: response
									? `${entries.length} matches`
									: "Fuzzy filename & path search"}
				</span>
				<span className="finder-keys">↑↓ select · Enter open · Esc close</span>
			</div>
		</Modal>
	);
}
