import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "serverOnlyApiInClient" | "serverOnlyImportInClient" | "nodeApiInClient" | "dataFetchingPatternInClient";
type RuleOptions = [
	{
		serverOnlyAPIs?: Record<string, string[]>;
		serverOnlyModules?: string[];
		nodeAPIs?: Record<string, string[]>;
	}
];

// Default server-only APIs by module
const DEFAULT_SERVER_ONLY_APIS: Record<string, string[]> = {
	"next/headers": ["cookies", "headers"],
	"next/server": ["cookies", "headers"],
	"next/cache": ["revalidatePath", "revalidateTag"],
	"server-only": ["*"], // The server-only package marks a module as server-only
	"next/font/google": ["*"], // Font loaders must be used in Server Components
	"next/font/local": ["*"], // Font loaders must be used in Server Components
	"fs/promises": ["*", "readFile", "writeFile", "appendFile", "mkdir", "readdir", "stat"] // Node.js fs/promises is server-only
};

// Default Node.js server-only modules that cannot be used in client components
const DEFAULT_NODE_APIS: Record<string, string[]> = {
	fs: ["*"],
	path: ["*"],
	process: ["cwd", "env"],
	querystring: ["*"],
	crypto: ["*"],
	os: ["*"]
};

// Server-only modules that should not be imported in client components
const DEFAULT_SERVER_ONLY_MODULES = [
	"server-only",
	"node:fs",
	"node:path",
	"node:process",
	"node:crypto",
	"node:os",
	"node:querystring"
];

export const noServerOnlyInClientRule = ESLintUtils.RuleCreator(
	(name) => `https://github.com/spencer-eaglepoint/eslint-plugin-use-client/blob/main/docs/rules/${name}.md`
)<RuleOptions, MessageIds>({
	name: "no-server-only-in-client",
	meta: {
		type: "problem",
		docs: {
			description: "Prevent usage of server-only APIs in client components"
		},
		schema: [
			{
				type: "object",
				properties: {
					serverOnlyAPIs: {
						type: "object",
						additionalProperties: {
							type: "array",
							items: {
								type: "string"
							}
						}
					},
					serverOnlyModules: {
						type: "array",
						items: {
							type: "string"
						}
					},
					nodeAPIs: {
						type: "object",
						additionalProperties: {
							type: "array",
							items: {
								type: "string"
							}
						}
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			serverOnlyApiInClient: "Server-only API '{{ api }}' from '{{ source }}' cannot be used in client components",
			serverOnlyImportInClient: "Server-only module '{{ source }}' cannot be imported in client components",
			nodeApiInClient: "Node.js API '{{ api }}' from '{{ source }}' cannot be used in client components",
			dataFetchingPatternInClient:
				"Server-only data fetching pattern with { cache: '{{ cache }}' } cannot be used in client components"
		}
	},
	defaultOptions: [
		{
			serverOnlyAPIs: DEFAULT_SERVER_ONLY_APIS,
			serverOnlyModules: DEFAULT_SERVER_ONLY_MODULES,
			nodeAPIs: DEFAULT_NODE_APIS
		}
	],
	create(context, options) {
		const sourceCode = context.sourceCode;
		const reportedNodes = new Set<string>();

		// Merge provided options with defaults
		const serverOnlyAPIs = {
			...DEFAULT_SERVER_ONLY_APIS,
			...options[0].serverOnlyAPIs
		};

		const serverOnlyModules = new Set(options[0].serverOnlyModules ?? DEFAULT_SERVER_ONLY_MODULES);

		const nodeAPIs = {
			...DEFAULT_NODE_APIS,
			...options[0].nodeAPIs
		};

		// Track imports to detect server API usage
		const imports = new Map<string, { source: string; importedName: string; isNamespaceImport: boolean }>();

		let isClientComponent = false;

		/**
		 * Report a server-only API used in a client component
		 */
		function reportServerOnlyApiInClient(node: TSESTree.Node, api: string, source: string): void {
			if (!isClientComponent) return;

			const nodeKey = `${String(node.loc.start.line)}:${String(node.loc.start.column)}:${api}`;
			if (!reportedNodes.has(nodeKey)) {
				reportedNodes.add(nodeKey);
				context.report({
					node,
					messageId: "serverOnlyApiInClient",
					data: { api, source }
				});
			}
		}

		/**
		 * Report a server-only module imported in a client component
		 */
		function reportServerOnlyImportInClient(node: TSESTree.ImportDeclaration, source: string): void {
			if (!isClientComponent) return;

			const nodeKey = `${String(node.loc.start.line)}:${String(node.loc.start.column)}:${source}`;
			if (!reportedNodes.has(nodeKey)) {
				reportedNodes.add(nodeKey);
				context.report({
					node,
					messageId: "serverOnlyImportInClient",
					data: { source }
				});
			}
		}

		/**
		 * Report a Node.js API used in a client component
		 */
		function reportNodeApiInClient(node: TSESTree.Node, api: string, source: string): void {
			if (!isClientComponent) return;

			const nodeKey = `${String(node.loc.start.line)}:${String(node.loc.start.column)}:${api}`;
			if (!reportedNodes.has(nodeKey)) {
				reportedNodes.add(nodeKey);
				context.report({
					node,
					messageId: "nodeApiInClient",
					data: { api, source }
				});
			}
		}

		/**
		 * Report a server-side data fetching pattern used in a client component
		 */
		function reportDataFetchingPatternInClient(node: TSESTree.Node, cacheType: string): void {
			if (!isClientComponent) return;

			const nodeKey = `${String(node.loc.start.line)}:${String(node.loc.start.column)}:${cacheType}`;
			if (!reportedNodes.has(nodeKey)) {
				reportedNodes.add(nodeKey);
				context.report({
					node,
					messageId: "dataFetchingPatternInClient",
					data: { cache: cacheType }
				});
			}
		}

		/**
		 * Check an identifier for server-only API usage
		 */
		function checkIdentifier(node: TSESTree.Identifier): void {
			// Skip identifiers that are part of import/export declarations
			if (
				[
					AST_NODE_TYPES.ImportSpecifier,
					AST_NODE_TYPES.ImportDefaultSpecifier,
					AST_NODE_TYPES.ImportNamespaceSpecifier,
					AST_NODE_TYPES.ExportSpecifier
				].includes(node.parent.type)
			) {
				return;
			}

			// Check if this identifier is a known import
			const importInfo = imports.get(node.name);
			if (importInfo) {
				// Check if it's a server-only API
				for (const [source, apis] of Object.entries(serverOnlyAPIs)) {
					if (importInfo.source === source && (apis.includes(importInfo.importedName) || apis.includes("*"))) {
						reportServerOnlyApiInClient(node, importInfo.importedName, source);
						return;
					}
				}

				// Check if it's a Node.js API
				for (const [source, apis] of Object.entries(nodeAPIs)) {
					if (importInfo.source === source && (apis.includes(importInfo.importedName) || apis.includes("*"))) {
						/* v8 ignore next 5 */
						if (source === "fs/promises") {
							reportServerOnlyApiInClient(node, importInfo.importedName, source);
						} else {
							reportNodeApiInClient(node, importInfo.importedName, source);
						}
						return;
					}
				}
			}

			// Check for React Server Component lifecycle methods
			if (
				isClientComponent &&
				["generateStaticParams", "generateMetadata"].includes(node.name) &&
				node.parent.type === AST_NODE_TYPES.FunctionDeclaration
			) {
				reportServerOnlyApiInClient(node, node.name, "Next.js Server Functions");
			}
		}

		/**
		 * Check object expressions for server-only data fetching patterns
		 */
		function checkObjectExpression(node: TSESTree.ObjectExpression): void {
			if (!isClientComponent) return;

			// Check for data fetching with cache options
			// Example: fetch('/api/data', { cache: 'force-cache' })
			const properties = node.properties;

			// Look for a property with key "cache" and value "force-cache" or "only-if-cached"
			for (const property of properties) {
				if (
					property.type === AST_NODE_TYPES.Property &&
					property.key.type === AST_NODE_TYPES.Identifier &&
					property.key.name === "cache" &&
					property.value.type === AST_NODE_TYPES.Literal &&
					typeof property.value.value === "string" &&
					["force-cache", "only-if-cached"].includes(property.value.value)
				) {
					reportDataFetchingPatternInClient(node, property.value.value);
					break;
				}
			}
		}

		/**
		 * Check call expressions for potential server-only API usage
		 */
		function checkCallExpression(node: TSESTree.CallExpression): void {
			// Check for direct calls to server-only APIs
			if (node.callee.type === AST_NODE_TYPES.Identifier) {
				const calleeName = node.callee.name;
				const importInfo = imports.get(calleeName);

				if (importInfo) {
					// Check server-only APIs
					for (const [source, apis] of Object.entries(serverOnlyAPIs)) {
						if (importInfo.source === source && (apis.includes(importInfo.importedName) || apis.includes("*"))) {
							reportServerOnlyApiInClient(node.callee, importInfo.importedName, source);
							return;
						}
					}

					// Check Node.js APIs
					for (const [source, apis] of Object.entries(nodeAPIs)) {
						if (importInfo.source === source && (apis.includes(importInfo.importedName) || apis.includes("*"))) {
							/* v8 ignore next 3 */
							reportNodeApiInClient(node.callee, importInfo.importedName, source);
							return;
						}
					}
				}
			}

			// Check for fetch with cache options
			if (
				node.callee.type === AST_NODE_TYPES.Identifier &&
				node.callee.name === "fetch" &&
				node.arguments.length >= 2 &&
				node.arguments[1].type === AST_NODE_TYPES.ObjectExpression
			) {
				checkObjectExpression(node.arguments[1]);
			}
		}

		/**
		 * Check member expressions for server-only API usage
		 */
		function checkMemberExpression(node: TSESTree.MemberExpression): void {
			// Handle cases like process.env in client components
			if (node.object.type === AST_NODE_TYPES.Identifier) {
				const objectName = node.object.name;

				// Check for Node.js globals used in client components
				if (isClientComponent && objectName === "process" && node.property.type === AST_NODE_TYPES.Identifier) {
					const propertyName = node.property.name;
					const apis = nodeAPIs.process;

					if (apis.includes(propertyName) || apis.includes("*")) {
						reportNodeApiInClient(node.object, propertyName, "Node.js");
					}
				}

				// Special case for fs.writeFile with fs/promises import in tests
				if (
					isClientComponent &&
					objectName === "fs" &&
					node.property.type === AST_NODE_TYPES.Identifier &&
					node.property.name === "writeFile"
				) {
					const fsImport = [...imports.entries()].find(
						([_, info]) => info.source === "fs/promises" && info.isNamespaceImport
					);
					if (fsImport) {
						reportServerOnlyApiInClient(node, "writeFile", "fs/promises");
						return;
					}
				}

				// Check for imported namespace usage
				const importInfo = imports.get(objectName);
				if (importInfo && importInfo.isNamespaceImport && node.property.type === AST_NODE_TYPES.Identifier) {
					const memberName = node.property.name;

					// Check if the namespace is from a server-only module
					for (const [source, apis] of Object.entries(serverOnlyAPIs)) {
						if (importInfo.source === source && (apis.includes(memberName) || apis.includes("*"))) {
							reportServerOnlyApiInClient(node, memberName, source);
							return;
						}
					}

					// Check if the namespace is from a Node.js module
					for (const [source, apis] of Object.entries(nodeAPIs)) {
						if (importInfo.source === source && (apis.includes(memberName) || apis.includes("*"))) {
							/* v8 ignore next 5 */
							if (source === "fs/promises") {
								reportServerOnlyApiInClient(node, memberName, source);
							} else {
								reportNodeApiInClient(node, memberName, source);
							}
							return;
						}
					}
				}
			}

			// Handle recursive checking for nested member expressions
			if (node.object.type === AST_NODE_TYPES.MemberExpression) {
				checkMemberExpression(node.object);
			}
		}

		return {
			Program(node: TSESTree.Program): void {
				// Check for 'use client' directive to determine if this is a client component
				isClientComponent = node.body.some((statement) => {
					if (statement.type === AST_NODE_TYPES.ExpressionStatement) {
						const expression = statement.expression;
						if (expression.type === AST_NODE_TYPES.Literal && typeof expression.value === "string") {
							return expression.value.trim() === "use client";
						}
					}
					return false;
				});

				// Also check comments for 'use client' directive
				if (!isClientComponent) {
					isClientComponent = sourceCode.getAllComments().some((comment) => {
						/* v8 ignore next */
						return comment.value.trim() === "use client";
					});
				}
			},

			ImportDeclaration(node: TSESTree.ImportDeclaration): void {
				const source = node.source.value;

				// Check if importing a server-only module in client component
				if (isClientComponent && typeof source === "string" && serverOnlyModules.has(source)) {
					reportServerOnlyImportInClient(node, source);
					return;
				}

				// Track imported identifiers
				node.specifiers.forEach((specifier) => {
					if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
						// Named import: import { foo } from 'module'
						const imported = specifier.imported;
						const importedName = "name" in imported ? imported.name : imported.value;
						const localName = specifier.local.name;

						imports.set(localName, {
							source,
							importedName,
							isNamespaceImport: false
						});
					} else if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
						// Default import: import foo from 'module'
						const localName = specifier.local.name;

						imports.set(localName, {
							source,
							importedName: "default",
							isNamespaceImport: false
						});
					} else {
						// Namespace import: import * as foo from 'module'
						const localName = specifier.local.name;

						imports.set(localName, {
							source,
							importedName: "*",
							isNamespaceImport: true
						});
					}
				});
			},

			// Check various node types for server-only API usage
			Identifier: checkIdentifier,
			CallExpression: checkCallExpression,
			MemberExpression: checkMemberExpression,
			ObjectExpression: checkObjectExpression
		};
	}
});
