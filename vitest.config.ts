import { defineConfig } from "vitest/config";

export default defineConfig({
	// Cache all modules to ensure the same instance is used
	cacheDir: "./.vitest/cache",
	test: {
		//reporters: process.env.GITHUB_ACTIONS ? ["github-actions"] : ["text"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", ["html", { subdir: "report" }]],
			reportsDirectory: "./.coverage",
			exclude: [
				"dist/**",
				"**/*.config.*",
				"**/*.d.ts",
				"**/__test__/**",
				"**/__tests__/**",
				"**/__mocks__/**",
				"turbo/**",
				"eslint.config.ts",
				"vitest.*.ts"
			],
			include: ["pkg/src/**/*.ts"],
			enabled: true
		},
		environment: "node"
	}
});
