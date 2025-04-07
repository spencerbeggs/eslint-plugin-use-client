import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		reporters: [process.env.GITHUB_ACTIONS ? "github-actions" : "text"],
		coverage: {
			provider: "istanbul",
			reporter: ["text", "json", ["html", { subdir: "report" }]],
			reportsDirectory: "./.coverage"
		}
	}
});
