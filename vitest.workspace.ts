// vitest.workspace.ts
export default [
	{
		test: {
			extends: true,
			name: "eslint-plugin-react-use-client",
			include: ["pkg/__test__/**/*.test.ts"],
			environment: "node",
			setupFiles: ["./pkg/vitest.setup.ts"]
		}
	}
];
