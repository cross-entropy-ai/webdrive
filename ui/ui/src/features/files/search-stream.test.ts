import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import { filesApi } from "./api";
import type { SearchProgress } from "./types";

const fetchSpy = spyOn(globalThis, "fetch");
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());
const frame = (done: boolean): SearchProgress => ({
	entries: [
		{
			name: "你好.ts",
			path: "/deep/你好.ts",
			relative_path: "deep/你好.ts",
			is_dir: false,
		},
	],
	done,
	has_more: false,
	partial: false,
});

test("search delivers partial results before EOF and decodes split Unicode frames", async () => {
	let stream!: ReadableStreamDefaultController<Uint8Array>;
	fetchSpy.mockResolvedValueOnce(
		new Response(
			new ReadableStream({
				start(controller) {
					stream = controller;
				},
			}),
		),
	);
	const controller = new AbortController();
	const received: SearchProgress[] = [];
	let first!: () => void;
	const progressed = new Promise<void>((resolve) => {
		first = resolve;
	});
	const pending = filesApi.searchProgress(
		"/deep",
		"你好",
		controller.signal,
		(result) => {
			received.push(result);
			first();
		},
	);
	const data = new TextEncoder().encode(JSON.stringify(frame(false)) + "\n");
	for (const byte of data) stream.enqueue(new Uint8Array([byte]));
	await progressed;
	expect(received).toEqual([frame(false)]);
	stream.enqueue(new TextEncoder().encode(JSON.stringify(frame(true)) + "\n"));
	stream.close();
	await pending;
	expect(received).toEqual([frame(false), frame(true)]);
	expect(fetchSpy.mock.calls.at(-1)?.[1]?.signal).toBe(controller.signal);
});

test("search detects truncated streams and cancels outdated requests", async () => {
	fetchSpy.mockResolvedValueOnce(
		new Response(JSON.stringify(frame(false)) + "\n"),
	);
	await expect(
		filesApi.searchProgress("/", "q", new AbortController().signal, () => {}),
	).rejects.toThrow("interrupted");
	const controller = new AbortController();
	controller.abort();
	fetchSpy.mockResolvedValueOnce(
		new Response(JSON.stringify(frame(true)) + "\n"),
	);
	const received: SearchProgress[] = [];
	await expect(
		filesApi.searchProgress("/", "q", controller.signal, (result) =>
			received.push(result),
		),
	).rejects.toThrow();
	expect(received).toEqual([]);
});
