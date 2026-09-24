import { mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Bun.write("dist/.gitkeep", "");

const result = await Bun.build({
	entrypoints: ["./src/index.html"],
	outdir: "./dist",
	target: "browser",
	minify: true,
	splitting: true,
	define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}
for (const output of result.outputs) {
	if (/\.(js|css)$/.test(output.path)) {
		const compressed = Bun.gzipSync(await output.arrayBuffer(), { level: 9 });
		await Bun.write(`${output.path}.gz`, compressed);
		console.log(
			`${output.path.split("/").pop()}: ${output.size} bytes (${compressed.length} gzip)`,
		);
	}
}
