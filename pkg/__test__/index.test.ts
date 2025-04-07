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
			expect(plugin.rules["function-case"]).toBeDefined();
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
			expect(config.rules["react-use-client/function-case"]).toBeDefined();

			const ruleConfig = config.rules["react-use-client/function-case"] as [string, Record<string, unknown>];
			expect(Array.isArray(ruleConfig)).toBe(true);
			expect(ruleConfig[0]).toBe("error");
			expect(ruleConfig[1].style).toBe("uppercase");
		});
	});
});
