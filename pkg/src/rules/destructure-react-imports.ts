import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import type { RuleContext, RuleListener } from "@typescript-eslint/utils/ts-eslint";

/**
 * The type of message id to use.
 */
export type MessageIds = "destructureReact";

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
 * Gets any type parameters associated with a React hook call
 */
function getTypeParameters(
	node: TSESTree.MemberExpression,
	context: Readonly<RuleContext<MessageIds, RuleOptions>>
): string {
	const parent = node.parent;
	// This is a defensive check to ensure that we don't crash if the parent is not a TSTypeParameterInstantiation
	/* v8 ignore next 8 */
	if (parent.type === AST_NODE_TYPES.TSTypeParameterInstantiation) {
		try {
			return context.sourceCode.getText(parent);
		} catch {
			// If anything goes wrong while getting type parameters, return an empty string
			return "";
		}
	}
	return "";
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
			destructureReact: "React imports should be destructured"
		}
	},
	defaultOptions: [],
	create(context: Readonly<RuleContext<MessageIds, RuleOptions>>, _optionsWithDefault: readonly []): RuleListener {
		let defaultImportNode: TSESTree.ImportDefaultSpecifier | TSESTree.VariableDeclarator | null = null;
		let importName: string | null = null;
		const usedReactMembers = new Set<string>();
		const reactUsages: {
			node: TSESTree.MemberExpression;
			typeParams: string;
		}[] = [];

		return {
			ImportDefaultSpecifier(node: TSESTree.ImportDefaultSpecifier) {
				if (isReactImport(node.parent)) {
					defaultImportNode = node;
					importName = node.local.name;
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
			"Program:exit"() {
				if (!defaultImportNode || !importName) {
					return;
				}

				const node = defaultImportNode;

				// Report error for unused React import
				if (usedReactMembers.size === 0) {
					context.report({
						node,
						messageId: "destructureReact",
						fix(fixer) {
							const parent = node.type === AST_NODE_TYPES.ImportDefaultSpecifier ? node.parent : node.parent;
							return fixer.removeRange([parent.range[0], parent.range[1]]);
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
						const sortedMembers = Array.from(usedReactMembers).sort();

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

						return fixes;
					}
				});
			}
		};
	}
});
