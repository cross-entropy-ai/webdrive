const languages: Record<string, string> = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	py: "python",
	rb: "ruby",
	rs: "rust",
	go: "go",
	java: "java",
	c: "c",
	h: "c",
	cpp: "cpp",
	hpp: "cpp",
	cs: "csharp",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	toml: "ini",
	xml: "xml",
	html: "xml",
	htm: "xml",
	svg: "xml",
	css: "css",
	scss: "scss",
	less: "less",
	sql: "sql",
	md: "markdown",
	dockerfile: "dockerfile",
	makefile: "makefile",
	lua: "lua",
	php: "php",
	swift: "swift",
	kt: "kotlin",
	r: "r",
	pl: "perl",
	ex: "elixir",
	erl: "erlang",
	hs: "haskell",
	ml: "ocaml",
	vim: "vim",
	tf: "hcl",
	proto: "protobuf",
	graphql: "graphql",
	gql: "graphql",
};

const imageExts = new Set([
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"svg",
	"bmp",
	"ico",
	"avif",
	"heic",
]);
const videoExts = new Set(["mp4", "webm", "mov", "avi", "mkv", "m4v"]);
const audioExts = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a"]);

export function mimeCategory(
	ct: string,
): "text" | "image" | "video" | "audio" | "pdf" | "binary" {
	ct = ct.split(";", 1)[0]?.trim().toLowerCase() ?? "";
	if (
		ct.startsWith("text/") ||
		ct === "application/json" ||
		ct === "application/xml" ||
		ct.includes("javascript") ||
		ct.includes("yaml") ||
		ct.includes("toml")
	)
		return "text";
	if (ct.startsWith("image/")) return "image";
	if (ct.startsWith("video/")) return "video";
	if (ct.startsWith("audio/")) return "audio";
	if (ct === "application/pdf") return "pdf";
	return "binary";
}

export function mediaTypeFromName(
	name: string,
): "image" | "video" | "audio" | null {
	const ext = name.split(".").pop()?.toLowerCase();
	if (!ext) return null;
	if (imageExts.has(ext)) return "image";
	if (videoExts.has(ext)) return "video";
	if (audioExts.has(ext)) return "audio";
	return null;
}

export function fileIcon(name: string, isDir: boolean): string {
	if (isDir) return "solar:folder-bold-duotone";
	const media = mediaTypeFromName(name);
	if (media === "image") return "solar:gallery-linear";
	if (media === "video") return "solar:videocamera-linear";
	if (media === "audio") return "solar:music-note-linear";
	return "solar:document-text-linear";
}

export function langFromFilename(name: string): string | undefined {
	const ext = name.split(".").pop()?.toLowerCase();
	if (!ext) return undefined;
	return languages[ext];
}
