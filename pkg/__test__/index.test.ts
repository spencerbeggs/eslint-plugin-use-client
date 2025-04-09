import { describe, it, expect } from "vitest";
import plugin from "../src/index.js";

describe("eslint-plugin-react-use-client", () => {
	describe("plugin structure", () => {
		it("should have meta information", () => {
			expect(plugin.meta).toBeDefined();
			expect(plugin.meta.name).toBe("eslint-plugin-react-use-client");
			expect(plugin.meta.version).toBe("0.0.0-test");
		});

		it("should have rules", () => {
			expect(plugin.rules).toBeDefined();
		});

		it("should have configs", () => {
			expect(plugin.configs).toBeDefined();
			expect(plugin.configs.recommended).toBeDefined();
		});
	});

	describe("provided configs", () => {
		it("should return correct recommended config", () => {
			const config = plugin.configs.recommended();
			expect(config.plugins).toContain("react-use-client");
		});
	});
});
