import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import type { RuleContext, RuleListener } from "@typescript-eslint/utils/ts-eslint";

/**
 * The type of message id to use.
 */
export type MessageIds = "destructureReact" | "removeUnusedReact";

type RuleOptions = [];

function isReactImport(node: TSESTree.ImportDeclaration | TSESTree.VariableDeclarator): boolean {
	if (node.type === AST_NODE_TYPES.ImportDeclaration) {
		return node.source.value === "react";
	}
	return (
		node.init?.type === AST_NODE_TYPES.CallExpression &&
		node.init.callee.type === AST_NODE_TYPES.Identifier &&
		node.init.callee.name === "require" &&
		node.init.arguments[0]?.type === AST_NODE_TYPES.Literal &&
		node.init.arguments[0].value === "react"
	);
}

/**
 * Gets any type parameters associated with a React hook call or type reference
 */
function getTypeParameters(
	node: TSESTree.MemberExpression | TSESTree.TSTypeReference,
	context: Readonly<RuleContext<MessageIds, RuleOptions>>
): string {
	const parent = node.parent;
	/* v8 ignore start */
	if (parent.type === AST_NODE_TYPES.TSTypeParameterInstantiation) {
		try {
			return context.sourceCode.getText(parent);
		} catch {
			// If anything goes wrong while getting type parameters, return an empty string
			return "";
		}
	}
	return "";
	/* v8 ignore end */
}

/**
 * Gets the full type reference text for a node
 */
function getFullTypeReferenceText(
	node: TSESTree.TSTypeReference,
	context: Readonly<RuleContext<MessageIds, RuleOptions>>
): string {
	/* v8 ignore start */
	try {
		return context.sourceCode.getText(node);
	} catch {
		return "";
	}
	/* v8 ignore end */
}

/**
 * The destructure-react-imports rule.
 * This rule is type-aware and will preserve TypeScript types in the output.
 */
export const destructureReactImportsRule = ESLintUtils.RuleCreator<{
	recommended: boolean;
}>((name) => `https://spencerbeg.gs/rule/${name}`)<RuleOptions, MessageIds>({
	name: "destructure-react-imports",
	meta: {
		type: "suggestion",
		docs: {
			description: "Enforce destructuring React imports",
			recommended: true
		},
		fixable: "code",
		schema: [],
		messages: {
			destructureReact: "React imports should be destructured",
			removeUnusedReact: "Unused React import should be removed"
		}
	},
	defaultOptions: [],
	create(context: Readonly<RuleContext<MessageIds, RuleOptions>>, _optionsWithDefault: readonly []): RuleListener {
		let defaultImportNode: TSESTree.ImportDefaultSpecifier | TSESTree.VariableDeclarator | null = null;
		let importName: string | null = null;
		const usedReactMembers = new Set<string>();
		const existingNamedImports = new Set<string>();
		const reactUsages: {
			node: TSESTree.MemberExpression;
			typeParams: string;
		}[] = [];
		const typeReferences: {
			node: TSESTree.TSTypeReference;
			typeName: string;
			fullText: string;
		}[] = [];

		return {
			ImportDefaultSpecifier(node: TSESTree.ImportDefaultSpecifier) {
				if (isReactImport(node.parent)) {
					defaultImportNode = node;
					importName = node.local.name;

					// Collect any existing named imports
					const parent = node.parent;
					parent.specifiers.forEach((specifier) => {
						if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
							const imported = specifier.imported;
							if (imported.type === AST_NODE_TYPES.Identifier) {
								existingNamedImports.add(imported.name);
							}
						}
					});
				}
			},
			VariableDeclarator(node: TSESTree.VariableDeclarator) {
				if (isReactImport(node)) {
					defaultImportNode = node;
					importName = node.id.type === AST_NODE_TYPES.Identifier ? node.id.name : null;
				}
			},
			MemberExpression(node: TSESTree.MemberExpression) {
				if (
					node.object.type === AST_NODE_TYPES.Identifier &&
					importName !== null &&
					node.object.name === importName &&
					node.property.type === AST_NODE_TYPES.Identifier
				) {
					usedReactMembers.add(node.property.name);
					// Get any type parameters from the parent node
					const typeParams = getTypeParameters(node, context);
					reactUsages.push({ node, typeParams });
				}
			},
			TSTypeReference(node: TSESTree.TSTypeReference) {
				if (
					node.typeName.type === AST_NODE_TYPES.TSQualifiedName &&
					node.typeName.left.type === AST_NODE_TYPES.Identifier &&
					importName !== null &&
					node.typeName.left.name === importName
				) {
					usedReactMembers.add(node.typeName.right.name);
					const fullText = getFullTypeReferenceText(node, context);
					typeReferences.push({ node, typeName: node.typeName.right.name, fullText });
				}
			},
			"Program:exit"() {
				if (!defaultImportNode || !importName) {
					return;
				}

				const node = defaultImportNode;

				// Report error for unused React import
				if (usedReactMembers.size === 0 && existingNamedImports.size === 0) {
					context.report({
						node,
						messageId: "removeUnusedReact",
						fix(fixer) {
							const parent = node.type === AST_NODE_TYPES.ImportDefaultSpecifier ? node.parent : node.parent;
							const sourceCode = context.sourceCode;

							// Prepare to capture the code that comes after the import
							const program = sourceCode.ast;
							let remainingCode = "";

							// Skip the import node and include all other nodes
							let foundImport = false;
							for (const programNode of program.body) {
								if (programNode === parent) {
									foundImport = true;
								} else if (foundImport) {
									// Only include code after the import
									remainingCode += sourceCode.getText(programNode);
									if (programNode !== program.body[program.body.length - 1]) {
										remainingCode += "\n";
									}
								}
							}

							// Create a fix that preserves the expected formatting
							if (remainingCode) {
								const startRange = parent.range[0];
								const endRange = sourceCode.text.length;
								return fixer.replaceTextRange([startRange, endRange], remainingCode);
							} else {
								// If there's no remaining code, just remove the import
								return fixer.remove(parent);
							}
						}
					});
					return;
				}

				context.report({
					node,
					messageId: "destructureReact",
					fix(fixer) {
						const fixes: TSESLint.RuleFix[] = [];
						const parent = node.type === AST_NODE_TYPES.ImportDefaultSpecifier ? node.parent : node.parent;
						const startRange = parent.range[0];
						const endRange = parent.range[1];

						// Sort members for consistent output
						const allMembers = new Set([...existingNamedImports, ...usedReactMembers]);
						const sortedMembers = Array.from(allMembers).sort();

						// Create the appropriate import/require statement
						if (node.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
							const newText = `import { ${sortedMembers.join(", ")} } from "react";`;
							fixes.push(fixer.replaceTextRange([startRange, endRange], newText));
						} else {
							const newText = `const { ${sortedMembers.join(", ")} } = require("react");`;
							fixes.push(fixer.replaceTextRange([startRange, endRange], newText));
						}

						// Replace all React.X with just X, preserving type parameters
						reactUsages.forEach(({ node, typeParams }) => {
							if (node.property.type === AST_NODE_TYPES.Identifier) {
								const replacement = node.property.name + typeParams;
								fixes.push(fixer.replaceText(node, replacement));
							}
						});

						// Replace type references
						typeReferences.forEach(({ node, typeName, fullText }) => {
							if (importName === null) return;
							const typeParamsMatch = new RegExp(`${importName}\\.${typeName}(.*)`).exec(fullText);
							const typeParams = typeParamsMatch?.[1] ?? "";
							const replacement = typeName + typeParams;
							fixes.push(fixer.replaceText(node, replacement));
						});

						return fixes;
					}
				});
			}
		};
	}
});
