# React 19's "use client" Directive Overview

## Introduction

React 19 introduces a powerful "use client" directive that helps distinguish between client-side and server-side components in React applications. This directive is part of React's ongoing work to optimize rendering strategies and simplify the developer experience in hybrid rendering environments.

## Purpose

The "use client" directive serves as an explicit declaration at the top of a file to indicate that the component should be rendered on the client side. It acts as a boundary marker that separates client-rendered components from server components.

```jsx
"use client";

// This component will be rendered on the client
function ClientComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

## When to Use the Directive

You should add the "use client" directive to files that:

1. Use browser-only APIs (like `window`, `document`, etc.)
2. Utilize React hooks (`useState`, `useEffect`, etc.)
3. Attach event handlers (like `onClick`, `onChange`)
4. Need access to browser-specific features
5. Depend on client-side state management

## Optimization Benefits

- **Reduced Bundle Size**: Server components don't get included in the JavaScript bundle sent to the client
- **Improved Performance**: Less JavaScript to parse, compile, and execute on the client
- **Better Code Organization**: Clear boundaries between server and client logic
- **Progressive Enhancement**: Better support for gradual loading strategies

## Common Patterns

### Component Splitting

Often, you'll split functionality between server and client components:

```jsx
// ServerComponent.jsx
// No "use client" directive needed

export default function ServerComponent({ children }) {
  return (
    <div className="server-component">
      <h1>Server Rendered</h1>
      {children}
    </div>
  );
}
```

```jsx
// ClientInteraction.jsx
"use client";

import { useState } from "react";

export default function ClientInteraction() {
  const [isActive, setIsActive] = useState(false);
  
  return (
    <button 
      className={isActive ? "active" : ""}
      onClick={() => setIsActive(!isActive)}
    >
      Toggle Active State
    </button>
  );
}
```

### Directive Inheritance

Components imported into a client component are treated as client components, even if they don't have the directive. However, it's still a best practice to explicitly mark client components with the directive.

## ESLint Plugin Purpose

The ESLint plugin we're developing helps enforce consistent and correct usage of the "use client" directive by:

1. Ensuring client-side code is properly marked with the directive
2. Preventing unnecessary use of the directive where it's not needed
3. Helping developers understand when and where to use the directive
4. Providing automatic fixes for common issues

By using this ESLint plugin, developers can avoid common pitfalls and maintain a clear separation between server and client components, resulting in better performance and maintainability.
