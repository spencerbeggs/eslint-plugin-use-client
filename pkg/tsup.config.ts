import { copyFile, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { defineConfig } from "tsup";
import type { PackageJson } from "type-fest";

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

		// Read and process package.json
		const packageJsonPath = join(process.cwd(), "package.json");
		const packageJson: PackageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as PackageJson;

		// Remove devDependencies and scripts
		const { devDependencies, scripts, ...rest } = packageJson;

		// Update exports to point to dist files
		const processedPackageJson: PackageJson = {
			...rest
		};

		processedPackageJson.exports = {
			".": {
				import: "./index.js",
				types: "./index.d.ts"
			}
		};

		// Write processed package.json to dist
		await writeFile(join(process.cwd(), "dist", "package.json"), JSON.stringify(processedPackageJson, null, "\t"));
	}
});
