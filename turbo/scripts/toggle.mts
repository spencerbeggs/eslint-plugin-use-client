#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, stringify } from "comment-json";
import prettier from "prettier";

async function main() {
	// File paths
	const settingsPath = resolve(process.cwd(), ".vscode/settings.json");
	const prettierConfigPath = resolve(process.cwd(), ".prettierrc");

	// Check if files exist
	if (!existsSync(settingsPath)) {
		console.error("❌ Error: .vscode/settings.json file not found!");
		process.exit(1);
	}

	// Read the settings file
	console.log("🔍 Reading VS Code settings file...");
	const settingsContent = readFileSync(settingsPath, "utf-8");

	// Parse JSON with comments
	const settings = parse(settingsContent) as {
		"files.exclude"?: Record<string, boolean>;
		"search.exclude"?: Record<string, boolean>;
	};

	// Track changes
	let filesExcludeChanged = false;
	let searchExcludeChanged = false;
	let toggledToTrue = false;
	let toggledToFalse = false;

	// Handle files.exclude
	if (settings["files.exclude"]) {
		const values = Object.values(settings["files.exclude"]);
		if (values.length > 0) {
			const allTrue = values.every((value) => value);
			const allFalse = values.every((value) => !value);

			// Set the target value based on current state
			const targetValue = allTrue ? false : allFalse ? true : !values[0];

			// Track which direction we're toggling
			if (targetValue) {
				toggledToTrue = true;
			} else {
				toggledToFalse = true;
			}

			// Set all values to target value
			const filesExclude = settings["files.exclude"];
			Object.keys(filesExclude).forEach((key) => {
				filesExclude[key] = targetValue;
			});

			filesExcludeChanged = true;
			console.log(`🔄 Changed all entries in files.exclude to ${targetValue ? "true" : "false"}`);
		} else {
			console.log("ℹ️ No entries in files.exclude, no changes made");
		}
	} else {
		console.log("ℹ️ No files.exclude configuration found");
	}

	// Handle search.exclude
	if (settings["search.exclude"]) {
		const values = Object.values(settings["search.exclude"]);
		if (values.length > 0) {
			const allTrue = values.every((value) => value);
			const allFalse = values.every((value) => !value);

			// Set the target value based on current state
			const targetValue = allTrue ? false : allFalse ? true : !values[0];

			// Track which direction we're toggling
			if (targetValue) {
				toggledToTrue = true;
			} else {
				toggledToFalse = true;
			}

			// Set all values to target value
			Object.keys(settings["search.exclude"]).forEach((key) => {
				if (settings["search.exclude"]) {
					settings["search.exclude"][key] = targetValue;
				}
			});

			searchExcludeChanged = true;
			console.log(`🔄 Changed all entries in search.exclude to ${targetValue ? "true" : "false"}`);
		} else {
			console.log("ℹ️ No entries in search.exclude, no changes made");
		}
	} else {
		console.log("ℹ️ No search.exclude configuration found");
	}

	// If changes were made, save the file
	if (filesExcludeChanged || searchExcludeChanged) {
		// Convert back to JSONC
		let updatedContent = stringify(settings, undefined, 2);

		// Format with prettier if .prettierrc exists
		if (existsSync(prettierConfigPath)) {
			console.log("💅 Formatting with Prettier using .prettierrc...");
			try {
				const prettierConfig = await prettier.resolveConfig(process.cwd());
				updatedContent = await prettier.format(updatedContent, {
					...prettierConfig,
					parser: "json"
				});
			} catch (error) {
				console.warn("⚠️ Warning: Failed to format with Prettier, saving without formatting");
				console.error(error);
			}
		}

		// Write the updated settings back to the file
		writeFileSync(settingsPath, updatedContent, "utf-8");

		// Provide a summary of what happened
		if (toggledToTrue && toggledToFalse) {
			console.log("✅ Successfully updated VS Code settings with mixed toggle directions!");
		} else if (toggledToTrue) {
			console.log("✅ Successfully enabled all exclude patterns!");
		} else {
			console.log("✅ Successfully disabled all exclude patterns!");
		}
	} else {
		console.log("🤷 No changes were needed");
	}
}

await main().catch((error: unknown) => {
	console.error("❌ An error occurred:", error);
	process.exit(1);
});
