import { fuzzyMatch } from "./fuzzy-search";
export function FilenameMatch({
	name,
	query,
}: {
	name: string;
	query: string;
}) {
	if (!query.trim()) return <>{name}</>;
	const positions = new Set(fuzzyMatch(name, query)?.positions ?? []);
	return (
		<>
			{Array.from(name).map((letter, index) =>
				positions.has(index) ? <mark key={index}>{letter}</mark> : letter,
			)}
		</>
	);
}
