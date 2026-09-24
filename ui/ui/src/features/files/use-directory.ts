import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/api";
import { filesApi } from "./api";
import type { ListResponse } from "./types";

export function useDirectory(path: string) {
	const [data, setData] = useState<ListResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [isFile, setIsFile] = useState(false);
	const activeRequest = useRef<AbortController | null>(null);
	const mounted = useRef(false);
	const currentPath = useRef(path);
	currentPath.current = path;

	const refresh = useCallback(async () => {
		// An upload may finish after navigation. Never refresh its old directory.
		if (!mounted.current || currentPath.current !== path) return;
		activeRequest.current?.abort();
		const controller = new AbortController();
		activeRequest.current = controller;
		setLoading(true);
		try {
			const listing = await filesApi.list(path, controller.signal);
			if (!controller.signal.aborted && currentPath.current === path) {
				setData(listing);
				setIsFile(listing === null);
			}
		} catch (error) {
			if (!controller.signal.aborted && currentPath.current === path)
				setError(errorMessage(error));
		} finally {
			if (!controller.signal.aborted && currentPath.current === path)
				setLoading(false);
		}
	}, [path]);

	useEffect(() => {
		mounted.current = true;
		setData(null);
		setIsFile(false);
		setError(null);
		void refresh();
		return () => {
			mounted.current = false;
			activeRequest.current?.abort();
		};
	}, [refresh]);

	return { data, error, setError, loading, isFile, refresh };
}
