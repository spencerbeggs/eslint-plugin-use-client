import { destructureReactImports } from "./rules/destructure-react-imports.js";
import { FunctionCase, functionCaseRule } from "./rules/function-case-rule.js";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare const __PACKAGE_NAME__: string;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare const __PACKAGE_VERSION__: string;

export default {
	// eslint-plugin-react-use-client
	meta: {
		name: __PACKAGE_NAME__,
		version: __PACKAGE_VERSION__
	},
	rules: {
		"function-case": functionCaseRule,
		"destructure-react-imports": destructureReactImports
	},
	configs: {
		// Base configuration - includes all rules without specific options
		recommended: () => ({
			plugins: ["react-use-client"],
			rules: {
				"react-use-client/function-case": [
					"error",
					{
						style: FunctionCase.SHOULD_BE_UPPER
					}
				],
				"react-use-client/destructure-react-imports": "error"
			}
		})
	}
};
