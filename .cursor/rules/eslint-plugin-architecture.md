# ESLint Plugin Architecture

This document explains the architecture of ESLint plugins, with specific focus on how our "use client" directive plugin is structured.

## ESLint Plugin Structure

An ESLint plugin is essentially a package that exports a collection of rules, configurations, and processors. Here's the typical structure:

```
eslint-plugin-use-client/
├── src/
│   ├── index.ts            # Main entry point
│   ├── rules/              # Individual rule implementations
│   │   ├── rule1.ts
│   │   ├── rule2.ts
│   │   └── ...
│   └── util/               # Shared utilities
├── __test__/                  # Test files
└── package.json            # Package metadata
```

## Core Components

### 1. Plugin Entry Point (index.ts)

The main file that exports the plugin's rules and configurations:

```typescript
// index.ts
import useClientDirective from "./rules/use-client-directive";
import destructureReactImports from "./rules/destructure-react-imports";

export = {
	rules: {
		"use-client-directive": useClientDirective,
		"destructure-react-imports": destructureReactImports
	},
	configs: {
		recommended: {
			plugins: ["use-client"],
			rules: {
				"use-client/use-client-directive": "error",
				"use-client/destructure-react-imports": "warn"
			}
		}
	}
};
```

### 2. Rule Implementation

Each rule is a separate module that exports a rule object. Here is a well-designed reference rule that check the case of function names:

```typescript
// rules/function-case.ts
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
}>((name) => `spencerbeggs.codes/eslint-plugin-use-client/rules${name}`)<RuleOptions, MessageIds>({
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
```

## Rule Development Flow

1. **Identify the Issue**: Determine what code pattern to detect or enforce
2. **Define Rule Metadata**: Set type, documentation, messages, and fix capability
3. **Implement AST Visitors**: Write callbacks for relevant AST node types
4. **Add Error Reporting**: Use `context.report()` to flag issues
5. **Implement Fixes**: Provide auto-fix functions when possible
6. **Write Tests**: Create test cases covering valid and invalid code patterns
7. **Type-Aware**: Rules must be compatible with typescript-eslint. Use the @typescript-eslint/utils and @typescript-eslint/scope-manager packages

## AST Traversal

ESLint uses an Abstract Syntax Tree (AST) to analyze code. The plugin traverses this tree to find patterns that match or violate the rules.

Key node types for the "use client" directive plugin:

- **Program**: Root node, used to check directive presence at file start
- **ExpressionStatement**: Used to identify directive expressions
- **Literal**: Used to check the content of string literals (e.g., "use client")
- **CallExpression**: Used to detect React hook calls
- **JSXAttribute**: Used to find event handlers in JSX
- **ImportDeclaration**: Used to analyze React import statements

## Context Object

The `context` object provides methods for rule implementation:

- `context.report()`: Report issues with optional fix suggestions
- `context.getSourceCode()`: Access the full source code
- `context.options`: Access rule configuration options
- `context.getFilename()`: Get the current file's name

## Autofixing

Rules can provide fixes by including a `fix` function in the report:

```typescript
context.report({
	node,
	messageId: "missingDirective",
	fix: (fixer) => {
		return fixer.insertTextBefore(sourceCode.ast, '"use client";\n\n');
	}
});
```

## Testing Rules

We use `@typescript-eslint/rule-tester` with Vitest to test our rules. Here is an example of testing the rule from the previous section:

```typescript
// __test__/function-case.test.ts
import { describe } from "vitest";
import { functionCaseRule, FunctionCase } from "../src/rules/function-case-rule.js";
import { dedent, TSTester } from "./utils/index.js";

describe("[rule] function-case", () => {
	describe("options", () => {
		const rule = TSTester.create();
		describe("style", () => {
			rule.run("lowercase", functionCaseRule, {
				valid: [
					{
						name: "function name is lowercase",
						code: dedent`
							function foobar() {
								return "foobar";
							}
						`,
						options: [{ style: FunctionCase.SHOULD_BE_LOWER }],
						filename: "lowercase-function-name.tsx"
					}
				],
				invalid: [
					{
						name: "function name is uppercase",
						code: dedent`
							function Foobar() {
								return "Foobar";
							}
						`,
						options: [{ style: FunctionCase.SHOULD_BE_LOWER }],
						errors: [{ messageId: "lowercase" }],
						filename: "uppercase-function-name.tsx"
					}
				]
			});

			rule.run("uppercase", functionCaseRule, {
				valid: [
					{
						name: "function name is uppercase",
						code: dedent`
							function Foobar() {
								return "Foobar";
							}
						`,
						options: [{ style: FunctionCase.SHOULD_BE_UPPER }],
						filename: "uppercase-function-name.tsx"
					}
				],
				invalid: [
					{
						name: "function name is lowercase",
						code: dedent`
							function foobar() {
								return "foobar";
							}
						`,
						options: [{ style: FunctionCase.SHOULD_BE_UPPER }],
						errors: [{ messageId: FunctionCase.SHOULD_BE_UPPER }],
						filename: "lowercase-function-name.tsx"
					}
				]
			});
		});
	});
});
```

Note the usage of the special `dedent` template tag imported from our utils. This function MUST be used on the the tests cases `code` and `output` properties. It's job is to ensure human readability of code sttrings that are hard to read for humans when indented.

## Local Testing

When iterating on the project besure to dilligently fix lint errors before moving on to a next step. This is an important step to ensure that we do not get stuck in a loop. The LLM can run tests from the repo root with the `pnpm test` command

## Continuous Integration

We integrate rule testing into our CI pipeline to ensure rules work correctly before merging changes:

1. **Lint Check**: Ensure the plugin's own code meets quality standards
2. **Unit Tests**: Run rule tests against various code patterns
3. **Integration Tests**: Test the plugin in a real project setting

This architecture provides a robust foundation for developing and maintaining our ESLint rules for enforcing proper use of the "use client" directive.
