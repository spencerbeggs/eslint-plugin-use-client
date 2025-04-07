import { describe } from "vitest";
import { functionCaseRule, FunctionCase } from "../src/rules/function-case-rule.js";
import { TSTester } from "./utils/tester.js";

describe("[rule] function-case", () => {
	describe("options", () => {
		const rule = TSTester.create();
		describe("style", () => {
			rule.run("lowercase", functionCaseRule, {
				valid: [
					{
						name: "function name is lowercase",
						code: `function foobar() {};`,
						options: [{ style: FunctionCase.SHOULD_BE_LOWER }],
						filename: "lowercase-function-name.tsx"
					}
				],
				invalid: [
					{
						name: "function name is uppercase",
						code: `function Foobar() {};`,
						options: [{ style: FunctionCase.SHOULD_BE_LOWER }],
						errors: [{ messageId: "lowercase" }],
						filename: "uppercase-function-name.tsx"
					}
				]
			});

			rule.run("uppercase", functionCaseRule, {
				valid: [
					{
						name: "function name is uppercase",
						code: `function Foobar() {};`,
						options: [{ style: FunctionCase.SHOULD_BE_UPPER }],
						filename: "uppercase-function-name.tsx"
					}
				],
				invalid: [
					{
						name: "function name is lowercase",
						code: `function foobar() {};`,
						options: [{ style: FunctionCase.SHOULD_BE_UPPER }],
						errors: [{ messageId: FunctionCase.SHOULD_BE_UPPER }],
						filename: "lowercase-function-name.tsx"
					}
				]
			});
		});
	});
});
