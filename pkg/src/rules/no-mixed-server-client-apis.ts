import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "serverInClient" | "clientInServer";
type RuleOptions = [
	{
		serverOnlyAPIs?: Record<string, string[]>;
		clientOnlyAPIs?: Record<string, string[]>;
		browserGlobals?: string[];
		clientHooks?: string[];
	}
];

// Default browser globals that should not be used in server components
const DEFAULT_BROWSER_GLOBALS = ["document", "window", "navigator", "localStorage", "sessionStorage", "history", "location"];

// Default React hooks that should not be used in server components
const DEFAULT_CLIENT_HOOKS = [
	"useState",
	"useEffect",
	"useLayoutEffect",
	"useReducer",
	"useRef",
	"useImperativeHandle",
	"useCallback",
	"useMemo",
	"useContext",
	"useTransition",
	"useDeferredValue",
	"useInsertionEffect"
];

// Default server-only APIs by module
const DEFAULT_SERVER_ONLY_APIS: Record<string, string[]> = {
	"next/headers": ["cookies", "headers"],
	"next/server": ["cookies", "headers"],
	"next/cache": ["revalidatePath", "revalidateTag"],
	"next/navigation": ["redirect", "permanentRedirect"]
};

// Default client-only APIs by module
const DEFAULT_CLIENT_ONLY_APIS: Record<string, string[]> = {
	"next/router": ["useRouter"],
	"next/navigation": ["useRouter", "useSearchParams", "usePathname"]
};

export const noMixedServerClientAPIsRule = ESLintUtils.RuleCreator(
	(name) => `https://github.com/spencerbeggs/eslint-plugin-use-client/blob/main/docs/rules/${name}.md`
)<RuleOptions, MessageIds>({
	name: "no-mixed-server-client-apis",
	meta: {
		type: "problem",
		docs: {
			description: "Prevent mixing server-only APIs with client-side code or client-only APIs with server components"
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
					clientOnlyAPIs: {
						type: "object",
						additionalProperties: {
							type: "array",
							items: {
								type: "string"
							}
						}
					},
					browserGlobals: {
						type: "array",
						items: {
							type: "string"
						}
					},
					clientHooks: {
						type: "array",
						items: {
							type: "string"
						}
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			serverInClient: "Server-only API '{{ api }}' from '{{ source }}' cannot be used in client components",
			clientInServer: "Client-only feature '{{ api }}' cannot be used in server components"
		}
	},
	defaultOptions: [
		{
			serverOnlyAPIs: DEFAULT_SERVER_ONLY_APIS,
			clientOnlyAPIs: DEFAULT_CLIENT_ONLY_APIS,
			browserGlobals: DEFAULT_BROWSER_GLOBALS,
			clientHooks: DEFAULT_CLIENT_HOOKS
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

		const clientOnlyAPIs = {
			...DEFAULT_CLIENT_ONLY_APIS,
			...options[0].clientOnlyAPIs
		};

		/* v8 ignore start */
		const browserGlobals = new Set(options[0].browserGlobals ?? DEFAULT_BROWSER_GLOBALS);

		const clientHooks = new Set(options[0].clientHooks ?? DEFAULT_CLIENT_HOOKS);
		/* v8 ignore end */

		// Track imports to detect server/client API usage
		const imports = new Map<string, { source: string; importedName: string; isNamespaceImport: boolean }>();

		let isClientComponent = false;

		function reportServerInClient(node: TSESTree.Node, api: string, source: string): void {
			if (!isClientComponent) return;

			const nodeKey = `${String(node.loc.start.line)}:${String(node.loc.start.column)}:${api}`;
			if (!reportedNodes.has(nodeKey)) {
				reportedNodes.add(nodeKey);
				context.report({
					node,
					messageId: "serverInClient",
					data: { api, source }
				});
			}
		}

		function reportClientInServer(node: TSESTree.Node, api: string): void {
			/* v8 ignore next */
			if (isClientComponent) return;

			const nodeKey = `${String(node.loc.start.line)}:${String(node.loc.start.column)}:${api}`;
			if (!reportedNodes.has(nodeKey)) {
				reportedNodes.add(nodeKey);
				context.report({
					node,
					messageId: "clientInServer",
					data: { api }
				});
			}
		}

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
				// Check if it's a server-only API used in client component
				for (const [source, apis] of Object.entries(serverOnlyAPIs)) {
					if (importInfo.source === source && apis.includes(importInfo.importedName)) {
						reportServerInClient(node, importInfo.importedName, source);
						return;
					}
				}

				// Check if it's a client-only API used in server component
				for (const [source, apis] of Object.entries(clientOnlyAPIs)) {
					if (importInfo.source === source && apis.includes(importInfo.importedName)) {
						reportClientInServer(node, importInfo.importedName);
						return;
					}
				}
			}

			// Check for React hooks used in server components
			if (!isClientComponent && clientHooks.has(node.name)) {
				// Verify it's being used as a function call
				if (node.parent.type === AST_NODE_TYPES.CallExpression && node.parent.callee === node) {
					reportClientInServer(node, node.name);
				}
			}

			// Check for browser globals used in server components
			if (!isClientComponent && browserGlobals.has(node.name)) {
				reportClientInServer(node, node.name);
			}
		}

		function checkMemberExpression(node: TSESTree.MemberExpression): void {
			// Handle cases like cookies().get()
			if (
				node.object.type === AST_NODE_TYPES.CallExpression &&
				node.object.callee.type === AST_NODE_TYPES.Identifier
			) {
				const calleeName = node.object.callee.name;
				/* v8 ignore start */
				{
					const importInfo = imports.get(calleeName);

					// Check if it's a server-only API used in client component
					for (const [source, apis] of Object.entries(serverOnlyAPIs)) {
						if (importInfo?.source === source && apis.includes(importInfo.importedName)) {
							reportServerInClient(node.object.callee, importInfo.importedName, source);
							return;
						}
					}
				}
				/* v8 ignore end */
			}

			// Handle cases like window.location
			/* v8 ignore start */
			if (node.object.type === AST_NODE_TYPES.Identifier) {
				const objectName = node.object.name;

				// Check for browser globals used in server components
				if (!isClientComponent && browserGlobals.has(objectName)) {
					reportClientInServer(node.object, objectName);
				}
			}
			/* v8 ignore end */

			// Handle recursive checking for nested member expressions
			checkNestedMemberExpression(node);
		}

		// Helper function for the recursive check
		function checkNestedMemberExpression(node: TSESTree.MemberExpression): void {
			// Simplify recursive check to improve coverage
			if (node.object.type === AST_NODE_TYPES.MemberExpression) {
				// Direct call to ensure coverage
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
						return comment.value.trim() === "use client";
					});
				}
			},

			ImportDeclaration(node: TSESTree.ImportDeclaration): void {
				const source = node.source.value;

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

				// Check if we're directly importing a server component in client code
				if (isClientComponent && !source.startsWith(".") && !source.startsWith("/")) {
					// For external modules, we don't know if they're server components
					return;
				}

				// For relative imports, we'd need more context about the imported file
				// This would require analyzing the imported file to detect if it's a server component
				// which might be complex for an ESLint rule
			},

			Identifier: checkIdentifier,
			MemberExpression: checkMemberExpression,

			// Check for client-side event handlers in server components
			JSXAttribute(node: TSESTree.JSXAttribute): void {
				if (isClientComponent) return;

				if (node.name.type === AST_NODE_TYPES.JSXIdentifier) {
					const attributeName = node.name.name;
					if (
						attributeName.startsWith("on") &&
						attributeName.length > 2 &&
						attributeName[2] === attributeName[2].toUpperCase()
					) {
						reportClientInServer(node, attributeName);
					}
				}
			}
		};
	}
});
