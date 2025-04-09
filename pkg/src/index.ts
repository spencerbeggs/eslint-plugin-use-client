import { destructureReactImportsRule } from "./rules/destructure-react-imports.js";
import { useClientDirectiveRule } from "./rules/use-client-directive.js";

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
		"destructure-react-imports": destructureReactImportsRule,
		"use-client-directive": useClientDirectiveRule
	},
	configs: {
		// Base configuration - includes all rules without specific options
		recommended: () => ({
			plugins: ["react-use-client"],
			rules: {
				"react-use-client/destructure-react-imports": "error"
			}
		})
	}
};
