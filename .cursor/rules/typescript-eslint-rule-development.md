# TypeScript ESLint Rule Development

This guide covers best practices for developing ESLint rules with TypeScript, particularly for our "use client" directive plugin.

## TypeScript Integration with ESLint

Our plugin uses TypeScript for both implementation and parsing target files, providing:

1. **Type Safety**: Reducing errors in rule implementation
2. **Better AST Understanding**: TypeScript-aware AST analysis
3. **Advanced Pattern Matching**: Leverage TypeScript's type system for more precise rule checks

## Setup and Dependencies

Key dependencies for TypeScript ESLint rule development:

```json
{
  "dependencies": {
    "eslint": "^8.49.0"
  },
  "devDependencies": {
    "@types/eslint": "^8.44.2",
    "@types/estree": "^1.0.1",
    "@typescript-eslint/eslint-plugin": "^6.7.0",
    "@typescript-eslint/parser": "^6.7.0",
    "@typescript-eslint/rule-tester": "^6.7.0",
    "typescript": "^5.2.2"
  }
}
```

## TypeScript Rule Structure

A TypeScript ESLint rule follows this basic structure:

```typescript
import { Rule } from 'eslint';
import { TSESTree } from '@typescript-eslint/utils';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Rule description',
      recommended: false,
    },
    fixable: 'code',
    schema: [], // rule options schema
    messages: {
      errorMessageId: 'Error message text',
    },
  },

  create(context: Rule.RuleContext) {
    return {
      // Type-safe node selectors
      Program(node: TSESTree.Program) {
        // Implementation
      },
      
      // Other visitors...
    };
  },
};

export default rule;
```

## Type-Safe AST Navigation

The `@typescript-eslint` tools provide type-safe interfaces for AST navigation:

```typescript
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

// Type checking
if (node.type === AST_NODE_TYPES.Identifier) {
  // TypeScript knows node is an Identifier here
  const name = node.name;
}

// Type assertion (when needed)
const identifier = node as TSESTree.Identifier;
```

## Typed Rule Options

For configurable rules, define a type for the options:

```typescript
type Options = [
  {
    enforceForAllComponents?: boolean;
    allowedHooks?: string[];
  }
];

// In rule creation
create(context: Rule.RuleContext<MessageIds, Options>) {
  const options = context.options[0] || {};
  const enforceForAllComponents = options.enforceForAllComponents ?? false;
  // ...
}
```

## Parser Configuration for TypeScript

Our rule tester is configured to properly parse TypeScript files:

```typescript
import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from '../src/rules/use-client-directive';

RuleTester.setDefaultConfig({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

const ruleTester = new RuleTester();

// Tests here...
```

## Working with TypeScript-Specific Nodes

When analyzing TypeScript files, you may need to handle TS-specific AST nodes:

```typescript
// Handling TypeScript type annotations
if (node.type === AST_NODE_TYPES.TSTypeAnnotation) {
  // Work with TypeScript types
}

// Handling typed imports
if (
  node.type === AST_NODE_TYPES.ImportDeclaration &&
  node.importKind === 'type'
) {
  // Handle type-only imports
}
```

## Type Inference Support

For more advanced rules, we can leverage TypeScript's type system to analyze React components:

```typescript
// Example: Checking if a function is a React component
function isReactComponent(node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression) {
  // Check return type
  const returnType = context.parserServices.getTypeAtLocation(node);
  
  // Check if it returns JSX.Element or React.ReactNode
  const returnTypeString = context.parserServices.typeToString(returnType);
  
  return (
    returnTypeString.includes('JSX.Element') || 
    returnTypeString.includes('React.ReactNode')
  );
}
```

## Autofixing with TypeScript

When providing autofix capabilities, ensure fixes maintain proper TypeScript syntax:

```typescript
context.report({
  node,
  messageId: 'missingDirective',
  fix: (fixer) => {
    // Add directive at the top of the file
    return fixer.insertTextBefore(
      context.getSourceCode().ast,
      '"use client";\n\n'
    );
  },
});
```

## Testing TypeScript Rules

Our testing approach for TypeScript rules:

```typescript
ruleTester.run('use-client-directive', rule, {
  valid: [
    // TypeScript code with JSX
    {
      code: `
        "use client";
        import { useState } from 'react';
        
        function Component(): JSX.Element {
          const [state, setState] = useState<string>("");
          return <div>{state}</div>;
        }
      `,
      filename: 'component.tsx',
    },
    // More valid cases...
  ],
  invalid: [
    // Invalid cases...
  ],
});
```

## Performance Considerations

TypeScript analysis can be more CPU-intensive, so we follow these practices:

1. **Selective Node Targeting**: Only analyze relevant node types
2. **Early Returns**: Exit checks as soon as possible
3. **Caching Results**: Store intermediate results rather than recomputing
4. **Reuse Existing Information**: Use context and existing type information

## Error Handling

For robust TypeScript rules, include error handling for parsing issues:

```typescript
try {
  // TypeScript-specific analysis
  const type = context.parserServices.getTypeAtLocation(node);
  // ...
} catch (error) {
  // Fallback to simpler analysis
  // ...
}
```

## Conclusion

Developing ESLint rules with TypeScript provides stronger guarantees about rule correctness and enables more sophisticated analysis capabilities. Following these best practices ensures our "use client" directive plugin will be robust, maintainable, and effective.
