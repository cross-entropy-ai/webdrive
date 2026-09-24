import type { Entry } from "./types";

export type FuzzyMatch = { score: number; positions: number[] };

// Filename subsequence matching: favor exact/prefix matches, contiguous runs,
// and word starts. Positions refer to Unicode characters, not UTF-16 bytes.
export function fuzzyMatch(name: string, query: string): FuzzyMatch | null {
	const letters = Array.from(name);
	const folded = letters.map((letter) => letter.toLocaleLowerCase());
	const needle = Array.from(query.trim().toLocaleLowerCase()).filter(
		(letter) => !/\s/u.test(letter),
	);
	if (!needle.length) return { score: 0, positions: [] };
	if (needle.length > letters.length) return null;
	let best: FuzzyMatch | null = null;
	for (let start = 0; start < letters.length; start++) {
		if (folded[start] !== needle[0]) continue;
		const positions: number[] = [];
		let cursor = start;
		let score = 0;
		for (const letter of needle) {
			while (cursor < folded.length && folded[cursor] !== letter) cursor++;
			if (cursor === folded.length) break;
			const previous = positions.at(-1);
			const boundary =
				cursor === 0 ||
				/[\s._\-/]/u.test(letters[cursor - 1]!) ||
				(/[a-z]/.test(letters[cursor - 1]!) && /[A-Z]/.test(letters[cursor]!));
			score +=
				10 +
				(boundary ? 12 : 0) +
				(previous !== undefined && cursor === previous + 1 ? 18 : 0);
			if (previous !== undefined) score -= cursor - previous - 1;
			positions.push(cursor++);
		}
		if (positions.length !== needle.length) continue;
		score -= start * 2 + letters.length * 0.01;
		if (positions[0] === 0) score += 30;
		if (needle.length === letters.length) score += 100;
		if (!best || score > best.score) best = { score, positions };
	}
	return best;
}

export function fuzzyEntries(
	entries: readonly Entry[],
	query: string,
): Entry[] {
	if (!query.trim()) return [...entries];
	return entries
		.flatMap((entry, index) => {
			const match = fuzzyMatch(entry.name, query);
			return match ? [{ entry, score: match.score, index }] : [];
		})
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map(({ entry }) => entry);
}
