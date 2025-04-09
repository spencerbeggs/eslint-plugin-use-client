import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "missingUseClient";
type RuleOptions = [{ allowlist: Record<string, boolean | string[]> }];

const DOM_APIS = new Set(["document", "window", "navigator", "localStorage", "sessionStorage", "history", "location"]);

export const useClientDirectiveRule = ESLintUtils.RuleCreator((name) => `https://spencerbeg.gs/rule/${name}`)<
	RuleOptions,
	MessageIds
>({
	name: "use-client-directive",
	meta: {
		type: "problem",
		docs: {
			description: "Enforce 'use client' directive when using DOM APIs"
		},
		fixable: "code",
		schema: [
			{
				type: "object",
				properties: {
					allowlist: {
						type: "object",
						additionalProperties: {
							oneOf: [
								{ type: "boolean" },
								{
									type: "array",
									items: { type: "string" }
								}
							]
						}
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			missingUseClient: "Component uses DOM API '{{ api }}' and must be marked with 'use client' directive"
		}
	},
	defaultOptions: [
		{
			allowlist: {}
		}
	],
	create(context, options) {
		const allowedModules = options[0].allowlist;
		const sourceCode = context.sourceCode;
		const reportedNodes = new Set<string>();
		const imports = new Map<string, { source: string; isNamespaceImport: boolean; importedName: string }>();
		const domAliases = new Map<string, string>(); // Maps variable names to their DOM API names
		let hasUseClientDirective = false;

		function isAllowlistedImport(source: string, importedName: string): boolean {
			// If the module is not in the allowlist, allow it by default
			if (!(source in allowedModules)) {
				return true;
			}

			const allowedExports = allowedModules[source];
			if (allowedExports === true) {
				return true;
			}
			if (Array.isArray(allowedExports)) {
				return allowedExports.includes(importedName) || allowedExports.includes("*");
			}
			return false;
		}

		function reportNode(node: TSESTree.Node, api: string): void {
			if (hasUseClientDirective) {
				return;
			}

			// For member expressions, use the object's location
			const loc = node.type === AST_NODE_TYPES.MemberExpression ? node.object.loc : node.loc;
			const nodeKey = `${String(loc.start.line)}:${String(loc.start.column)}:${api}`;

			if (!reportedNodes.has(nodeKey)) {
				reportedNodes.add(nodeKey);
				context.report({
					node,
					messageId: "missingUseClient",
					data: { api },
					fix: (fixer) => {
						return fixer.insertTextBefore(sourceCode.ast.body[0], "'use client';\n");
					}
				});
			}
		}

		function checkMemberExpression(node: TSESTree.MemberExpression): void {
			if (node.object.type === AST_NODE_TYPES.Identifier) {
				const objectName = node.object.name;
				const importInfo = imports.get(objectName);
				const propertyName = node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;

				if (importInfo && propertyName) {
					if (importInfo.isNamespaceImport) {
						// For namespace imports, first check if the entire namespace is allowlisted
						if (isAllowlistedImport(importInfo.source, "*")) {
							return;
						}

						// Then check if the specific property is allowlisted
						if (isAllowlistedImport(importInfo.source, propertyName)) {
							return;
						}

						// For non-allowlisted namespace imports, report if it's a DOM API
						if (DOM_APIS.has(propertyName) && importInfo.source in allowedModules) {
							reportNode(node, propertyName);
						}
					} else {
						// For named imports, check if the import is allowlisted
						if (!isAllowlistedImport(importInfo.source, importInfo.importedName)) {
							if (DOM_APIS.has(importInfo.importedName)) {
								reportNode(node, importInfo.importedName);
							}
						}
					}
				} else if (DOM_APIS.has(objectName)) {
					reportNode(node.object, objectName);
				}
			} else if (node.object.type === AST_NODE_TYPES.MemberExpression) {
				checkMemberExpression(node.object);
			}
		}

		function checkIdentifier(node: TSESTree.Identifier): void {
			// Skip identifiers that are part of import/export declarations
			if (
				node.parent.type === AST_NODE_TYPES.ImportSpecifier ||
				node.parent.type === AST_NODE_TYPES.ImportDefaultSpecifier ||
				node.parent.type === AST_NODE_TYPES.ImportNamespaceSpecifier ||
				node.parent.type === AST_NODE_TYPES.ExportSpecifier
			) {
				return;
			}

			// Skip identifiers that are part of MemberExpressions as the object
			if (node.parent.type === AST_NODE_TYPES.MemberExpression && node.parent.object === node) {
				return;
			}

			// Skip identifiers that are properties of MemberExpressions
			if (node.parent.type === AST_NODE_TYPES.MemberExpression && node.parent.property === node) {
				return;
			}

			// Skip identifiers that are part of variable declarations
			if (node.parent.type === AST_NODE_TYPES.VariableDeclarator && node.parent.id === node) {
				return;
			}

			const importInfo = imports.get(node.name);
			if (importInfo) {
				if (!isAllowlistedImport(importInfo.source, importInfo.importedName)) {
					if (DOM_APIS.has(importInfo.importedName)) {
						reportNode(node, importInfo.importedName);
					}
				}
			} else if (DOM_APIS.has(node.name)) {
				reportNode(node, node.name);
			}
		}

		return {
			Program(node: TSESTree.Program): void {
				// Check for 'use client' directive
				hasUseClientDirective = node.body.some((statement) => {
					if (statement.type === AST_NODE_TYPES.ExpressionStatement) {
						const expression = statement.expression;
						if (expression.type === AST_NODE_TYPES.Literal && typeof expression.value === "string") {
							return expression.value.trim() === "use client";
						}
					}
					return false;
				});

				// Also check comments for 'use client' directive
				if (!hasUseClientDirective) {
					hasUseClientDirective = sourceCode.getAllComments().some((comment) => {
						return comment.value.trim() === "use client";
					});
				}

				if (hasUseClientDirective) {
					return;
				}

				// Track imports
				node.body.forEach((statement) => {
					if (statement.type === AST_NODE_TYPES.ImportDeclaration) {
						const source = statement.source.value;
						statement.specifiers.forEach((specifier) => {
							if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
								const importedName =
									specifier.imported.type === AST_NODE_TYPES.Identifier
										? specifier.imported.name
										: specifier.imported.value;
								imports.set(specifier.local.name, {
									source,
									importedName,
									isNamespaceImport: false
								});
							} else if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
								imports.set(specifier.local.name, {
									source,
									importedName: "*",
									isNamespaceImport: true
								});
							}
						});
					}
				});
			},

			// Track variable declarations that alias DOM APIs
			VariableDeclarator(node: TSESTree.VariableDeclarator): void {
				if (
					node.init?.type === AST_NODE_TYPES.MemberExpression &&
					node.init.object.type === AST_NODE_TYPES.Identifier &&
					node.init.property.type === AST_NODE_TYPES.Identifier &&
					node.id.type === AST_NODE_TYPES.Identifier
				) {
					const objectName = node.init.object.name;
					const propertyName = node.init.property.name;
					const importInfo = imports.get(objectName);

					if (importInfo?.isNamespaceImport && DOM_APIS.has(propertyName)) {
						domAliases.set(node.id.name, propertyName);
					}
				}
			},

			Identifier: checkIdentifier,
			MemberExpression: checkMemberExpression
		};
	}
});
