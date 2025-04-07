import { enforceRule } from "./rules/index.js";

// Common client-side libraries for Next.js
const nextjsAllowlist = {
	// Server components libraries
	"next/headers": true,
	"next/server": true,
	"server-only": true,
	// Mixed libraries with safe exports
	"next/navigation": ["usePathname", "useSearchParams", "useParams", "headers"]
};

// Export the plugin with the flat config format
export default {
	meta: {
		name: "react-use-client",
		version: "0.0.0"
	},
	rules: {
		"enforce-use-client": enforceRule
	},

	// Export configs as functions that return the configuration
	configs: {
		recommended: () => ({
			plugins: ["react-use-client"],
			rules: {
				"react-use-client/enforce-use-client": [
					"error",
					{
						traceDepth: 0,
						traceDependencies: false,
						allowlist: nextjsAllowlist
					}
				]
			}
		}),

		standard: () => ({
			plugins: ["react-use-client"],
			rules: {
				"react-use-client/enforce-use-client": [
					"error",
					{
						traceDepth: 1,
						traceDependencies: true,
						allowlist: nextjsAllowlist
					}
				]
			}
		}),

		strict: () => ({
			plugins: ["react-use-client"],
			rules: {
				"react-use-client/enforce-use-client": [
					"error",
					{
						traceDepth: 3,
						traceDependencies: true,
						allowlist: nextjsAllowlist
					}
				]
			}
		})
	}
};
