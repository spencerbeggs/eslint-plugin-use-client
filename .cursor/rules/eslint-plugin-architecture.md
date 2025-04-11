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
├── tests/                  # Test files
└── package.json            # Package metadata
```

## Core Components

### 1. Plugin Entry Point (index.ts)

The main file that exports the plugin's rules and configurations:

```typescript
// index.ts
import useClientDirective from './rules/use-client-directive';
import destructureReactImports from './rules/destructure-react-imports';

export = {
  rules: {
    'use-client-directive': useClientDirective,
    'destructure-react-imports': destructureReactImports,
  },
  configs: {
    recommended: {
      plugins: ['use-client'],
      rules: {
        'use-client/use-client-directive': 'error',
        'use-client/destructure-react-imports': 'warn',
      },
    },
  },
};
```

### 2. Rule Implementation

Each rule is a separate module that exports a rule object:

```typescript
// rules/use-client-directive.ts
import { Rule } from 'eslint';
import { AST } from 'estree';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce proper use of the "use client" directive',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: 'code',
    schema: [], // No options
    messages: {
      missingDirective: 'Client component must have "use client" directive',
      incorrectPosition: '"use client" directive must be at the top of the file',
      // more message types...
    },
  },
  
  create(context) {
    // Implementation logic
    return {
      // AST node visitors
      Program(node: AST.Node) {
        // Check for directive presence/position
      },
      
      CallExpression(node: AST.Node) {
        // Check for React hooks usage
      },
      
      JSXElement(node: AST.Node) {
        // Check for event handlers in JSX
      },
      
      // Additional node visitors...
    };
  },
};

export default rule;
```

## Rule Development Flow

1. **Identify the Issue**: Determine what code pattern to detect or enforce
2. **Define Rule Metadata**: Set type, documentation, messages, and fix capability
3. **Implement AST Visitors**: Write callbacks for relevant AST node types
4. **Add Error Reporting**: Use `context.report()` to flag issues
5. **Implement Fixes**: Provide auto-fix functions when possible
6. **Write Tests**: Create test cases covering valid and invalid code patterns

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
  messageId: 'missingDirective',
  fix: (fixer) => {
    return fixer.insertTextBefore(
      sourceCode.ast,
      '"use client";\n\n'
    );
  },
});
```

## Testing Rules

We use `@typescript-eslint/rule-tester` with Vitest to test our rules:

```typescript
import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from '../src/rules/use-client-directive';

const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
});

ruleTester.run('use-client-directive', rule, {
  valid: [
    // Valid code examples
    {
      code: `"use client";\nimport { useState } from 'react';\n`,
      filename: 'component.tsx',
    },
  ],
  invalid: [
    // Invalid code examples with expected errors
    {
      code: `import { useState } from 'react';\nconst Component = () => { const [s, setS] = useState(); }`,
      filename: 'component.tsx',
      errors: [{ messageId: 'missingDirective' }],
      output: `"use client";\n\nimport { useState } from 'react';\nconst Component = () => { const [s, setS] = useState(); }`,
    },
  ],
});
```

## Continuous Integration

We integrate rule testing into our CI pipeline to ensure rules work correctly before merging changes:

1. **Lint Check**: Ensure the plugin's own code meets quality standards
2. **Unit Tests**: Run rule tests against various code patterns
3. **Integration Tests**: Test the plugin in a real project setting

This architecture provides a robust foundation for developing and maintaining our ESLint rules for enforcing proper use of the "use client" directive.
