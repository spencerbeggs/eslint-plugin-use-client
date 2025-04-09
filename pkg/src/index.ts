import { consistentUseClientPlacementRule } from "./rules/consistent-use-client-placement.js";
import { destructureReactImportsRule } from "./rules/destructure-react-imports.js";
import { noMixedServerClientAPIsRule } from "./rules/no-mixed-server-client-apis.js";
import { noServerOnlyInClientRule } from "./rules/no-server-only-in-client.js";
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
		"use-client-directive": useClientDirectiveRule,
		"consistent-use-client-placement": consistentUseClientPlacementRule,
		"no-mixed-server-client-apis": noMixedServerClientAPIsRule,
		"no-server-only-in-client": noServerOnlyInClientRule
	},
	configs: {
		// Base configuration - includes all rules without specific options
		recommended: () => ({
			plugins: ["react-use-client"],
			rules: {
				"react-use-client/destructure-react-imports": "error",
				"react-use-client/use-client-directive": "error",
				"react-use-client/consistent-use-client-placement": "error",
				"react-use-client/no-mixed-server-client-apis": "error",
				"react-use-client/no-server-only-in-client": "error"
			}
		})
	}
};
