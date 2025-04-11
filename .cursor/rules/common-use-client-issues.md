# Common "use client" Directive Issues

This document outlines the most frequent issues and mistakes developers make when working with React 19's "use client" directive.

## Missing "use client" Directive

### Issue

Components that use client-side functionality without the "use client" directive will result in runtime errors.

```jsx
// Missing "use client" directive
import { useState } from 'react';

function Counter() {
  // This will cause a runtime error in a server component
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

### Solution

Add the "use client" directive at the top of the file:

```jsx
"use client";

import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

## Incorrect Directive Placement

### Issue

The directive must be at the beginning of the file before any imports or code.

```jsx
// Invalid placement
import { useState } from 'react';

"use client"; // Too late - this won't work

function Counter() {
  // ...
}
```

### Solution

Move the directive to the very beginning of the file:

```jsx
"use client";

import { useState } from 'react';

function Counter() {
  // ...
}
```

## Unnecessary "use client" Directive

### Issue

Adding the "use client" directive to files that don't need client-side functionality increases bundle size unnecessarily.

```jsx
"use client"; // Unnecessary

// This component doesn't use any client features
function StaticDisplay({ title, description }) {
  return (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
```

### Solution

Remove the "use client" directive from components that don't need client-side functionality:

```jsx
// No "use client" directive needed

function StaticDisplay({ title, description }) {
  return (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
```

## Inconsistent Directives Across Related Components

### Issue

When a set of closely related components have inconsistent use of the directive, it can lead to confusion and bugs.

### Solution

Establish clear patterns for your components:

1. **Client Components**: Use the directive, contain interactive elements
2. **Server Components**: No directive, focus on data fetching and static rendering
3. **Mixed Components**: Consider splitting into separate client and server parts

## Forgetting Client Dependency Propagation

### Issue

Components imported by a client component are automatically treated as client components, regardless of whether they have the directive.

```jsx
// ClientComponent.jsx
"use client";

import { SubComponent } from './SubComponent';

function ClientComponent() {
  // ...
}
```

```jsx
// SubComponent.jsx
// No directive, but will be used on the client when imported by ClientComponent

export function SubComponent() {
  // ...
}
```

### Solution

For clarity, it's better to explicitly mark all client components with the directive:

```jsx
// SubComponent.jsx
"use client";

export function SubComponent() {
  // ...
}
```

## Misunderstanding Server/Client Boundaries

### Issue

Developers sometimes struggle to understand where the boundary between server and client components should be.

### Solution

Follow these guidelines:

- Server components: Data fetching, access to backend resources, static rendering
- Client components: Interactive elements, browser APIs, state management

## ESLint Plugin Benefits

Our ESLint plugin can automatically detect and fix many of these issues:

1. Identify missing "use client" directives when client-side features are used
2. Flag incorrect directive placement
3. Detect unnecessary "use client" directives
4. Ensure consistent patterns across your codebase
5. Provide helpful error messages and auto-fix capabilities

Using the plugin will help maintain a clean separation between client and server components, leading to more maintainable and performant React applications.
