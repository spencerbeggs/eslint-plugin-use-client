// vitest.workspace.ts
export default [
	// Include all projects in your packages directory
	"pkg",

	// Or specify specific config files
	// 'packages/*/vitest.config.{ts,js}'

	// You can also add inline configurations
	{
		test: {
			name: "eslint-plugin-react-use-client",
			include: ["__test__/**/*.test.ts"],
			environment: "node"
		}
	}
];
