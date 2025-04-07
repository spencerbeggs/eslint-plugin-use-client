import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

/**
 *  The type of function case to enforce.
 */
export enum FunctionCase {
	SHOULD_BE_UPPER = "uppercase",
	SHOULD_BE_LOWER = "lowercase"
}

/**
 * The type of message id to use.
 */
type MessageIds = `${FunctionCase}`;

type RuleOptions = [
	{
		style: MessageIds;
	}
];

/**
 * The function case rule.
 */
export const functionCaseRule = ESLintUtils.RuleCreator<{
	recommended: boolean;
}>((name) => `https://spencerbeg.gs/rule/${name}`)<RuleOptions, MessageIds>({
	name: "function-case",
	meta: {
		docs: {
			description: "Controls how functions names are written.",
			recommended: true
		},
		messages: {
			uppercase: "Start the function name with an uppercase letter.",
			lowercase: "Start the function name with a lowercase letter."
		},
		type: "suggestion",
		schema: [
			{
				type: "object",
				properties: {
					style: {
						type: "string",
						enum: Object.values(FunctionCase)
					}
				},
				additionalProperties: false
			}
		]
	},
	defaultOptions: [{ style: FunctionCase.SHOULD_BE_UPPER }],
	create(context, options) {
		const { style } = options[0];
		return {
			FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
				if (node.id !== null) {
					const isLowercase = /^[a-z]/.test(node.id.name);
					const isUppercase = /^[A-Z]/.test(node.id.name);

					if (isLowercase && style === FunctionCase.SHOULD_BE_UPPER) {
						context.report({
							messageId: FunctionCase.SHOULD_BE_UPPER,
							node: node.id
						});
					} else if (isUppercase && style === FunctionCase.SHOULD_BE_LOWER) {
						context.report({
							messageId: FunctionCase.SHOULD_BE_LOWER,
							node: node.id
						});
					}
				}
			}
		};
	}
});
