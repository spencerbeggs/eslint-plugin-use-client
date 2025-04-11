# Plugin Rules Design

This document outlines the design principles and patterns for the specific rules in our ESLint plugin for React 19's "use client" directive.

## Rule Design Principles

Our rules are designed with the following principles in mind:

1. **Accuracy**: Minimize false positives and negatives
2. **Performance**: Efficient AST traversal and analysis
3. **Actionability**: Clear error messages that guide resolution
4. **Fixability**: Provide automatic fixes when possible
5. **Configurability**: Allow customization for different project needs

## Primary Rules

### 1. `use-client-directive`

Enforces proper usage of the "use client" directive in React components.

#### Detection Strategy

The rule analyzes files to detect:

1. **Client-side Feature Usage**:
   - React hook calls (`useState`, `useEffect`, etc.)
   - Event handlers in JSX (`onClick`, `onChange`, etc.)
   - Browser API references (`window`, `document`, etc.)
   - Client-side libraries usage

2. **Directive Presence and Position**:
   - Check if "use client" directive exists
   - Verify it's at the beginning of the file
   - Ensure correct directive format

#### Rule Configuration

```javascript
{
  "rules": {
    "use-client/use-client-directive": ["error", {
      // Configuration options
      "enforceForAllComponents": false,
      "allowedHooks": ["useCallback", "useMemo"],
      "checkEventHandlers": true,
      "checkBrowserAPIs": true
    }]
  }
}
```

#### Implementation Pattern

```typescript
create(context) {
  // Track if we found client-side features
  let hasClientFeatures = false;
  let hasDirective = false;
  let directivePosition = -1;

  // Helper functions
  const isReactHook = (name) => /^use[A-Z]/.test(name);
  const isEventHandler = (name) => /^on[A-Z]/.test(name);
  // ...

  return {
    Program(node) {
      // Check for directive at beginning
      const directiveComments = node.body
        .filter(n => n.type === 'ExpressionStatement' && 
                     n.expression.type === 'Literal' &&
                     typeof n.expression.value === 'string')
        .map(n => n.expression.value);
      
      hasDirective = directiveComments.includes('use client');
      // ...
    },
    
    CallExpression(node) {
      // Check for React hooks
      if (node.callee.type === 'Identifier' && isReactHook(node.callee.name)) {
        hasClientFeatures = true;
      }
      // ...
    },
    
    // Additional visitors
    
    'Program:exit'() {
      // Report based on findings
      if (hasClientFeatures && !hasDirective) {
        context.report({
          node: context.getSourceCode().ast,
          messageId: 'missingDirective',
          fix: fixer => fixer.insertTextBefore(
            context.getSourceCode().ast,
            '"use client";\n\n'
          )
        });
      }
      // ...
    }
  };
}
```

### 2. `destructure-react-imports`

Enforces destructured imports from React to improve clarity and maintainability.

#### Detection Strategy

Analyzes import declarations to ensure React imports are properly destructured.

#### Rule Configuration

```javascript
{
  "rules": {
    "use-client/destructure-react-imports": ["warn", {
      "allowNamespaceImports": false,
      "preferDestructuring": true
    }]
  }
}
```

#### Implementation Pattern

```typescript
create(context) {
  return {
    ImportDeclaration(node) {
      // Check if it's a React import
      if (node.source.value === 'react') {
        // Check import specifiers
        const defaultImport = node.specifiers.find(
          s => s.type === 'ImportDefaultSpecifier'
        );
        
        // Report if default import is used instead of destructuring
        if (defaultImport && preferDestructuring) {
          context.report({
            node,
            messageId: 'preferDestructuredImport',
            // Fix logic...
          });
        }
        // ...
      }
    }
  };
}
```

## Rule Synergies

Our rules are designed to work together and complement each other:

1. **Directive + Imports**: The `use-client-directive` rule can use import analysis from `destructure-react-imports` to determine if React features are being used

2. **Component Analysis**: Rules can share utilities for detecting component patterns and React feature usage

3. **Progressive Enhancement**: Rules can be applied incrementally, starting with detection and warnings before enforcing errors

## Error Message Design

We follow these principles for error messages:

1. **Clear Problem Statement**: What's wrong?
2. **Context Information**: Where is the issue?
3. **Resolution Guidance**: How to fix it?
4. **Educational Component**: Why is this important?

Example messages:

- "Client-side features detected (useState) but 'use client' directive is missing"
- "React should be imported with destructured imports for better maintainability"
- "'use client' directive must be at the top of the file, before any imports"

## Test Case Design

Each rule includes comprehensive test cases that cover:

1. **Valid Cases**: Properly formatted code that passes the rule
2. **Invalid Cases**: Common errors and edge cases
3. **Autofix Verification**: Tests that confirm fixes work correctly
4. **Configuration Options**: Tests for different rule configurations

## Future Rule Extensions

We plan to expand the plugin with these additional rules:

1. **`consistent-component-boundaries`**: Ensure clear separation between client and server components
2. **`avoid-unnecessary-client-components`**: Detect when a component can be converted to a server component
3. **`client-side-api-detection`**: More sophisticated detection of browser API usage

These design principles ensure our ESLint plugin provides maximum value for developers working with React 19's "use client" directive.
