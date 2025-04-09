import { resolve } from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";

/**
 * A helper class for createing new type-aware rule testers.
 * @example
 * ```ts
 * import { TSTester } from "./utils/tester.js";
 *
 * const rule = TSTester.create();
 * rule.run("lowercase", functionCaseRule, {
 *  valid: [],
 *  invalid: []
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TSTester {
	static create() {
		return new RuleTester({
			languageOptions: {
				ecmaVersion: 2021,
				sourceType: "module",
				parserOptions: {
					ecmaFeatures: {
						jsx: true
					},
					project: "./tsconfig.json",
					projectService: {
						allowDefaultProject: ["*.ts*"],
						maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20
					},
					tsconfigRootDir: resolve(import.meta.dirname, "../..")
				}
			}
		});
	}
}
