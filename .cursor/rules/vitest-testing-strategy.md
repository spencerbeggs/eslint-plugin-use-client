# Vitest Testing Strategy

This document outlines our approach to testing ESLint rules in the "use client" directive plugin using Vitest and `@typescript-eslint/rule-tester`.

## Testing Framework Overview

Our testing approach leverages:

1. **Vitest**: Modern, fast testing framework with ESM support
2. **@typescript-eslint/rule-tester**: TypeScript-aware rule testing utility
3. **Snapshot Testing**: For tracking expected outputs across many test cases

## Test Directory Structure

```
/pkg
  /__tests__
    /__utils__        # Shared test utilities
      index.ts        # Common test helpers
    /rules            # Rule-specific tests
      use-client-directive.test.ts
      destructure-react-imports.test.ts
    /fixtures         # Test fixture files
      valid-cases/    # Valid code examples
      invalid-cases/  # Invalid code examples
```

## Test Setup

We configure Vitest with TypeScript support in `vitest.setup.ts`:

```typescript
import { RuleTester } from '@typescript-eslint/rule-tester';
import { configDefaults } from 'vitest/config';

// Configure rule tester for TypeScript
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

// Configure Vitest
export default {
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: [...configDefaults.exclude],
  },
};
```

## Basic Rule Test Structure

A typical rule test follows this structure:

```typescript
import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, it } from 'vitest';
import rule from '../../src/rules/use-client-directive';

describe('use-client-directive', () => {
  const ruleTester = new RuleTester();

  // Run tests
  ruleTester.run('use-client-directive', rule, {
    valid: [
      // Valid test cases
      {
        code: `"use client";\nimport { useState } from 'react';\n`,
        filename: 'component.tsx',
      },
      // More valid cases...
    ],
    invalid: [
      // Invalid test cases with expected errors
      {
        code: `import { useState } from 'react';\nconst Component = () => { useState(); }`,
        filename: 'component.tsx',
        errors: [{ messageId: 'missingDirective' }],
        output: `"use client";\n\nimport { useState } from 'react';\nconst Component = () => { useState(); }`,
      },
      // More invalid cases...
    ],
  });
});
```

## Testing Categories

We categorize tests into different scenarios:

### 1. Valid Code Tests

Examples that should pass the rule:

```typescript
// Valid cases
{
  // Case 1: Client directive with React hooks
  code: `
    "use client";
    import { useState } from 'react';
    
    function Counter() {
      const [count, setCount] = useState(0);
      return <div>{count}</div>;
    }
  `,
  filename: 'component.tsx',
},
{
  // Case 2: Server component without client features
  code: `
    import React from 'react';
    
    function StaticComponent({ title, text }) {
      return <div><h1>{title}</h1><p>{text}</p></div>;
    }
  `,
  filename: 'component.tsx',
},
```

### 2. Invalid Code Tests

Examples that should fail, with error expectations:

```typescript
// Invalid cases
{
  // Case 1: Missing directive with hooks
  code: `
    import { useState } from 'react';
    
    function Counter() {
      const [count, setCount] = useState(0);
      return <div>{count}</div>;
    }
  `,
  filename: 'component.tsx',
  errors: [{ messageId: 'missingDirective' }],
  output: `"use client";\n\nimport { useState } from 'react';
    
    function Counter() {
      const [count, setCount] = useState(0);
      return <div>{count}</div>;
    }
  `,
},
{
  // Case 2: Incorrect directive position
  code: `
    import { useState } from 'react';
    "use client";
    
    function Counter() {
      const [count, setCount] = useState(0);
      return <div>{count}</div>;
    }
  `,
  filename: 'component.tsx',
  errors: [{ messageId: 'incorrectPosition' }],
  output: `"use client";\n\nimport { useState } from 'react';
    
    
    function Counter() {
      const [count, setCount] = useState(0);
      return <div>{count}</div>;
    }
  `,
},
```

### 3. Edge Case Tests

Special scenarios that require handling:

```typescript
// Edge cases
{
  // Case 1: Mix of client and server features
  code: `
    import { useId } from 'react';
    
    function HybridComponent({ staticData }) {
      const id = useId(); // Client-side feature
      
      return (
        <div id={id}>
          {/* Static content */}
          {staticData.map(item => <div key={item.id}>{item.text}</div>)}
        </div>
      );
    }
  `,
  filename: 'component.tsx',
  errors: [{ messageId: 'missingDirective' }],
},
{
  // Case 2: Conditional client features
  code: `
    import { useState } from 'react';
    
    function ConditionalComponent({ isClient }) {
      let state;
      if (isClient) {
        state = useState(0);
      }
      
      return <div>{isClient ? state[0] : 'Server'}</div>;
    }
  `,
  filename: 'component.tsx',
  errors: [{ messageId: 'missingDirective' }],
},
```

## Testing Rule Options

Testing with different rule configurations:

```typescript
// Test rule options
ruleTester.run('use-client-directive with options', rule, {
  valid: [
    {
      code: `
        "use client";
        import { useMemo } from 'react';
        
        function Component() {
          const value = useMemo(() => computeValue(), []);
          return <div>{value}</div>;
        }
      `,
      filename: 'component.tsx',
      options: [{ allowedHooks: ['useMemo'] }],
    },
  ],
  invalid: [
    {
      code: `
        import { useState, useMemo } from 'react';
        
        function Component() {
          const [state] = useState();
          const value = useMemo(() => compute(), []);
          return <div>{state}{value}</div>;
        }
      `,
      filename: 'component.tsx',
      options: [{ allowedHooks: ['useMemo'] }],
      errors: [{ messageId: 'missingDirective' }],
    },
  ],
});
```

## Testing Autofix Functionality

We test that autofixes correctly transform code:

```typescript
// Autofix tests
{
  code: `
    import { useState } from 'react';
    
    function Component() {
      const [state, setState] = useState(0);
      return <button onClick={() => setState(state + 1)}>{state}</button>;
    }
  `,
  filename: 'component.tsx',
  errors: [{ messageId: 'missingDirective' }],
  output: `"use client";\n\n    import { useState } from 'react';
    
    function Component() {
      const [state, setState] = useState(0);
      return <button onClick={() => setState(state + 1)}>{state}</button>;
    }
  `,
},
```

## Integration Tests

Testing rules together in realistic scenarios:

```typescript
// Integration test across multiple rules
describe('integration', () => {
  it('should work with multiple rules', () => {
    const code = `
      import React from 'react';
      
      function Component() {
        const [state, setState] = React.useState(0);
        return <button onClick={() => setState(state + 1)}>{state}</button>;
      }
    `;
    
    // First apply the destructure rule
    const result1 = applyRule(destructureReactImportsRule, code);
    
    // Then apply the use-client rule
    const result2 = applyRule(useClientDirectiveRule, result1);
    
    // Final output should have both fixes
    expect(result2).toMatchInlineSnapshot(`
      "use client";
      
      import { useState } from 'react';
      
      function Component() {
        const [state, setState] = useState(0);
        return <button onClick={() => setState(state + 1)}>{state}</button>;
      }
    `);
  });
});
```

## Test Utilities

We create helper functions to reduce duplication:

```typescript
// __utils__/index.ts
import { RuleTester } from '@typescript-eslint/rule-tester';
import type { Rule } from 'eslint';

// Common test case creation helpers
export function createValidCase(code: string, filename = 'component.tsx', options = {}) {
  return { code, filename, options };
}

export function createInvalidCase(
  code: string, 
  errors: Array<{ messageId: string }>, 
  output?: string,
  filename = 'component.tsx', 
  options = {}
) {
  return { code, errors, output, filename, options };
}

// Test different React hook scenarios
export const hookCases = {
  useState: `
    import { useState } from 'react';
    
    function Component() {
      const [state, setState] = useState(0);
      return <div>{state}</div>;
    }
  `,
  useEffect: `
    import { useEffect } from 'react';
    
    function Component() {
      useEffect(() => {
        document.title = 'New Title';
      }, []);
      return <div>Hello</div>;
    }
  `,
  // More hook examples...
};
```

## Continuous Integration

Our CI workflow executes tests on every pull request:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## Testing Best Practices

1. **Isolation**: Test each rule independently
2. **Coverage**: Test multiple edge cases and common patterns
3. **Maintenance**: Use snapshots for complex test cases
4. **Documentation**: Include comments explaining test cases
5. **Organization**: Group related tests together

By following this testing strategy, we ensure our ESLint rules are robust, correctly identify issues, and provide appropriate fixes for the "use client" directive.
