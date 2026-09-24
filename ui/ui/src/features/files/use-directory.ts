import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/api";
import { filesApi } from "./api";
import type { ListResponse } from "./types";

export function useDirectory(path: string, knownIsFile?: boolean) {
	const [state, setState] = useState<{
		path: string;
		data: ListResponse | null;
		isFile: boolean;
		loading: boolean;
	}>({ path: "", data: null, isFile: knownIsFile ?? false, loading: true });
	const [error, setError] = useState<string | null>(null);
	const activeRequest = useRef<AbortController | null>(null);
	const mounted = useRef(false);
	const currentPath = useRef(path);
	currentPath.current = path;
	const refresh = useCallback(async () => {
		if (!mounted.current || currentPath.current !== path) return;
		activeRequest.current?.abort();
		const controller = new AbortController();
		activeRequest.current = controller;
		setState((previous) => ({
			path,
			data: previous.path === path ? previous.data : null,
			isFile: knownIsFile ?? previous.isFile,
			loading: true,
		}));
		try {
			const listing = await filesApi.list(path, controller.signal);
			if (!controller.signal.aborted && currentPath.current === path)
				setState({
					path,
					data: listing,
					isFile: listing === null,
					loading: false,
				});
		} catch (error) {
			if (!controller.signal.aborted && currentPath.current === path)
				setError(errorMessage(error));
		} finally {
			if (!controller.signal.aborted && currentPath.current === path)
				setState((previous) => ({ ...previous, loading: false }));
		}
	}, [path, knownIsFile]);
	useEffect(() => {
		mounted.current = true;
		setError(null);
		void refresh();
		return () => {
			mounted.current = false;
			activeRequest.current?.abort();
		};
	}, [refresh]);
	// Never render the previous directory's entries or reset a known file to a
	// directory while a navigation request is in flight.
	const current =
		state.path === path
			? state
			: { data: null, isFile: knownIsFile ?? state.isFile, loading: true };
	return {
		...current,
		error: state.path === path ? error : null,
		setError,
		refresh,
	};
}
