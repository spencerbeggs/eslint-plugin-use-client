# AST Traversal Patterns

This guide covers common patterns for traversing and analyzing the Abstract Syntax Tree (AST) in ESLint rules, specifically focusing on patterns relevant to our "use client" directive ESLint plugin.

## Understanding AST Basics

An Abstract Syntax Tree (AST) is a tree representation of the syntactic structure of code. ESLint uses the AST to analyze and enforce rules by traversing this tree and checking for specific patterns.

For example, this code:

```jsx
"use client";
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

Is represented as an AST with nodes for:
- The directive (`"use client"`)
- The import declaration
- The function declaration
- Variable declarations
- JSX elements and attributes
- Event handlers

## AST Visitor Pattern

ESLint uses the visitor pattern to traverse the AST. Each rule provides visitors for relevant node types:

```typescript
create(context) {
  return {
    // Node type visitors
    Program(node) { /* ... */ },
    ImportDeclaration(node) { /* ... */ },
    JSXElement(node) { /* ... */ },
    CallExpression(node) { /* ... */ },
    // ...
  };
}
```

## Common AST Node Types

### Program Node

The root node of the AST. Useful for checking file-level properties like directives.

```typescript
Program(node) {
  // Check for directives at the beginning of the file
  const directives = node.body
    .filter(n => 
      n.type === 'ExpressionStatement' && 
      n.expression.type === 'Literal' &&
      typeof n.expression.value === 'string'
    )
    .map(n => n.expression.value);
  
  const hasUseClientDirective = directives.includes('use client');
  // ...
}
```

### Import Declaration

Used to analyze imports, particularly useful for detecting React imports.

```typescript
ImportDeclaration(node) {
  // Check if importing from 'react'
  if (node.source.value === 'react') {
    // Check for specific imported values
    const importedHooks = node.specifiers
      .filter(s => s.type === 'ImportSpecifier')
      .map(s => s.imported.name)
      .filter(name => name.startsWith('use'));
    
    if (importedHooks.length > 0) {
      // React hooks are imported, likely a client component
      // ...
    }
  }
}
```

### Call Expression

Used to detect function calls, particularly React hooks.

```typescript
CallExpression(node) {
  // Check for React hook calls
  if (
    node.callee.type === 'Identifier' &&
    /^use[A-Z]/.test(node.callee.name)
  ) {
    // React hook detected
    clientFeatures.hooks.push(node.callee.name);
  }
  
  // Check for DOM API calls
  if (
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    (node.callee.object.name === 'document' || 
     node.callee.object.name === 'window')
  ) {
    // Browser API detected
    clientFeatures.browserAPIs.push(
      `${node.callee.object.name}.${node.callee.property.name}`
    );
  }
}
```

### JSX Elements and Attributes

Used to analyze React components and detect event handlers.

```typescript
JSXElement(node) {
  // Track JSX usage
  jsxUsage = true;
  
  // Check for event handlers in JSX attributes
  node.openingElement.attributes.forEach(attr => {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      /^on[A-Z]/.test(attr.name.name)
    ) {
      // Event handler detected
      clientFeatures.eventHandlers.push(attr.name.name);
    }
  });
}
```

### Member Expression

Used to detect property access, particularly for browser APIs.

```typescript
MemberExpression(node) {
  // Check for browser globals
  if (
    node.object.type === 'Identifier' &&
    ['window', 'document', 'localStorage', 'navigator'].includes(node.object.name)
  ) {
    // Browser API detected
    clientFeatures.browserAPIs.push(node.object.name);
  }
}
```

## Advanced Traversal Patterns

### Context-Aware Traversal

Maintaining context information as you traverse the AST:

```typescript
create(context) {
  // Track scope and context
  const clientFeatures = {
    hooks: [],
    eventHandlers: [],
    browserAPIs: []
  };
  
  let insideComponent = false;
  
  return {
    FunctionDeclaration(node) {
      // Enter component context
      insideComponent = true;
    },
    'FunctionDeclaration:exit'() {
      // Exit component context
      insideComponent = false;
    },
    CallExpression(node) {
      // Only track hooks inside components
      if (insideComponent && isReactHook(node.callee.name)) {
        clientFeatures.hooks.push(node.callee.name);
      }
    }
  };
}
```

### Selective Traversal

For performance, only traverse into nodes that are relevant to the rule:

```typescript
// Instead of checking every member expression
MemberExpression() { /* ... */ }

// Use selective selectors
'MemberExpression[object.name="document"]'() { /* ... */ }
'MemberExpression[object.name="window"]'() { /* ... */ }
```

### Parent-Child Relationships

Analyzing relationships between parent and child nodes:

```typescript
CallExpression(node) {
  // Check if this call is inside JSX attribute
  let current = node;
  while (current.parent) {
    if (current.parent.type === 'JSXAttribute') {
      // This call is an event handler in JSX
      break;
    }
    current = current.parent;
  }
}
```

## Specific Patterns for "use client" Directive

### Directive Detection

```typescript
// Check for "use client" directive
Program(node) {
  const sourceCode = context.getSourceCode();
  const comments = sourceCode.getAllComments();
  
  // Check first nodes for directives
  const firstNodes = node.body.slice(0, 3);
  
  const hasDirective = firstNodes.some(
    n => 
      n.type === 'ExpressionStatement' && 
      n.expression.type === 'Literal' &&
      n.expression.value === 'use client'
  );
  
  // ...
}
```

### React Feature Detection

```typescript
// Track React features that require client components
const clientFeatures = {
  hooks: new Set(),
  stateUpdaters: new Set(),
  eventHandlers: new Set(),
  browserAPIs: new Set()
};

return {
  // Check React hook usage
  CallExpression(node) {
    if (
      node.callee.type === 'Identifier' &&
      /^use[A-Z]/.test(node.callee.name) &&
      !ALLOWED_SERVER_HOOKS.includes(node.callee.name)
    ) {
      clientFeatures.hooks.add(node.callee.name);
    }
  },
  
  // Check JSX event handlers
  JSXAttribute(node) {
    if (
      node.name.type === 'JSXIdentifier' &&
      /^on[A-Z]/.test(node.name.name)
    ) {
      clientFeatures.eventHandlers.add(node.name.name);
    }
  },
  
  // Check for browser API usage
  'MemberExpression[object.name=/^(document|window|navigator|localStorage)$/]'(node) {
    clientFeatures.browserAPIs.add(node.object.name);
  },
  
  // Final analysis after traversal
  'Program:exit'() {
    const needsClientDirective = 
      clientFeatures.hooks.size > 0 ||
      clientFeatures.eventHandlers.size > 0 ||
      clientFeatures.browserAPIs.size > 0;
    
    if (needsClientDirective && !hasDirective) {
      // Report missing directive with specific details
      const features = [
        ...Array.from(clientFeatures.hooks).map(h => `hook (${h})`),
        ...Array.from(clientFeatures.eventHandlers).map(e => `event (${e})`),
        ...Array.from(clientFeatures.browserAPIs).map(a => `API (${a})`)
      ].join(', ');
      
      context.report({
        node: context.getSourceCode().ast,
        messageId: 'missingDirective',
        data: { features },
        fix: fixer => fixer.insertTextBefore(
          context.getSourceCode().ast,
          '"use client";\n\n'
        )
      });
    }
  }
};
```

## Performance Considerations

- Use specific selectors instead of checking all nodes
- Early returns when conditions are met
- Track context to avoid redundant checks
- Cache intermediate results
- Use sets for efficient lookup of features

By understanding these AST traversal patterns, you can effectively analyze React components to detect when the "use client" directive is required and provide meaningful error messages and automatic fixes.
