import { copyFile } from "fs/promises";
import { join } from "path";
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	splitting: false,
	sourcemap: false,
	dts: true,
	clean: true,
	outExtension() {
		return {
			js: `.js`
		};
	},
	format: "esm",
	minify: false,
	tsconfig: "tsconfig.json",
	async onSuccess() {
		await copyFile(join(process.cwd(), "..", "LICENSE"), join(process.cwd(), "dist", "LICENSE"));
		console.log("Successfully built plugin");
	}
});
