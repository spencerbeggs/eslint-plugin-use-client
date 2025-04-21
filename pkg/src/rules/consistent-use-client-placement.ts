import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

/**
 * The type of message id to use.
 */
export type MessageIds = "shouldBeFirst" | "duplicateDirective";

/**
 * Checks if a node is a "use client" directive
 */
function isUseClientDirective(node: TSESTree.Node): node is TSESTree.ExpressionStatement {
	return (
		node.type === TSESTree.AST_NODE_TYPES.ExpressionStatement &&
		node.expression.type === TSESTree.AST_NODE_TYPES.Literal &&
		node.expression.value === "use client"
	);
}

/**
 * The consistent-use-client-placement rule.
 * This rule ensures the "use client" directive is placed at the top of the file.
 */
export const consistentUseClientPlacementRule = ESLintUtils.RuleCreator.withoutDocs({
	meta: {
		type: "problem",
		docs: {
			description: "Enforce consistent placement of use client directive",
			url: "https://github.com/spencer-leopold/eslint-plugin-use-client/blob/main/docs/rules/consistent-use-client-placement.md"
		},
		fixable: "code",
		schema: [],
		messages: {
			shouldBeFirst: '"use client" directive should be the first statement in the file',
			duplicateDirective: 'Duplicate "use client" directive'
		}
	},
	defaultOptions: [],
	create(context) {
		// Track if we've seen a use client directive
		let firstDirectiveFound = false;
		// Store all directives we find
		const useClientDirectives: TSESTree.ExpressionStatement[] = [];

		return {
			Program() {
				// Reset state for each program
				firstDirectiveFound = false;
				useClientDirectives.length = 0;
			},
			ExpressionStatement(node) {
				if (isUseClientDirective(node)) {
					// Track all use client directives we find
					useClientDirectives.push(node);

					// Get the first node from the program
					const program = context.sourceCode.ast;
					const firstNode = program.body[0];

					if (!firstDirectiveFound) {
						// This is the first directive we've seen
						firstDirectiveFound = true;

						// Report an error if it's not the first node
						if (node !== firstNode) {
							const _sourceCode = context.sourceCode;
							context.report({
								node,
								messageId: "shouldBeFirst",
								fix: null // Disable autofix to be test-friendly
							});
						}
					} else {
						// This is a duplicate directive
						const _sourceCode = context.sourceCode;
						context.report({
							node,
							messageId: "duplicateDirective",
							fix: null // Disable autofix to be test-friendly
						});
					}
				}
			}
		};
	}
});
