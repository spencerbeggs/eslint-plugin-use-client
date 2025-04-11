# eslint-plugin-react-hooks-client

ESLint plugin to ensure the `'use client'` directive is present when client-side features are used in React components. This is especially useful for Next.js applications that use the React Server Components model.

## Features

- Detects React hook imports and requires 'use client' directive
- Identifies DOM API usage (window, document, navigator, etc.)
- Configurable whitelist for server-compatible hooks
- Optional removal of unnecessary 'use client' directives
- TypeScript support
- Auto-fix capability

## Installation

You'll need ESLint 9 installed in your project:

```bash
npm install eslint@^9.0.0 --save-dev
```

Then install this plugin:

```bash
npm install eslint-plugin-react-hooks-client --save-dev
```

## Usage with ESLint v9 Flat Config

### In your `eslint.config.js` file:

```js
import reactHooksClient from "eslint-plugin-react-hooks-client";

export default [
	// Use one of the predefined configurations
	reactHooksClient.configs.recommended,

	// Or customize the plugin configuration
	{
		plugins: {
			"react-hooks-client": reactHooksClient
		},
		rules: {
			"react-hooks-client/require-use-client-with-hooks": [
				"error",
				{
					// Specify hooks that are safe to use in server components
					serverCompatibleHooks: ["useMemo", "useCallback"],
					// Whether to remove unnecessary 'use client' directives
					removeUnneededDirectives: true
				}
			]
		}
	}
];
```

## Predefined Configurations

The plugin provides three predefined configurations:

### 1. `recommended`

Default configuration that treats all hooks as client-only and removes unnecessary 'use client' directives.

```js
import reactHooksClient from "eslint-plugin-react-hooks-client";

export default [reactHooksClient.configs.recommended];
```

### 2. `withServerHooks`

Configuration that whitelists `useMemo`, `useCallback`, and `useId` as server-compatible hooks:

```js
import reactHooksClient from "eslint-plugin-react-hooks-client";

export default [reactHooksClient.configs.withServerHooks];
```

### 3. `preserveDirectives`

Configuration that never removes 'use client' directives, even when they're not needed:

```js
import reactHooksClient from "eslint-plugin-react-hooks-client";

export default [reactHooksClient.configs.preserveDirectives];
```

## Rule Details

### What This Rule Enforces

1. **React Hooks**: Any file that imports React hooks (functions starting with 'use' from 'react') must include the 'use client' directive, unless the hook is in the serverCompatibleHooks list.

2. **Custom Hooks**: Any file that imports from a path containing '/use' or starting with 'use' must include the 'use client' directive.

3. **DOM APIs**: Any file that uses browser-specific APIs such as `window`, `document`, `navigator`, `localStorage`, or `sessionStorage` must include the 'use client' directive.

4. **Namespace and Default Imports**: Detects hooks accessed via default imports (`import React from 'react'; React.useState()`) and namespace imports (`import * as React from 'react'; React.useState()`).

5. **Destructuring Patterns**: Detects hooks accessed via object destructuring (`const { useState } = React`).

6. **Third-Party Hook Libraries**: Identifies hooks from third-party libraries accessed via dot notation (`hookLib.useCustomHook()`).

7. **Transitive Dependencies**: Analyzes imported modules to detect client-only features in dependencies, ensuring that a file importing a module with client-only features is also marked with 'use client'.

8. **Unnecessary Directives**: If enabled, the rule will remove 'use client' directives from files that don't use any client-side features.

### Rule Options

```ts
{
  // Module-specific allowlist of hooks that don't require the 'use client' directive
  // Format: [moduleName, hookNames[]][]
  allowlist?: [string, string[]][];

  // Whether to remove unnecessary 'use client' directives
  removeUnneededDirectives?: boolean;

  // Whether to analyze imported modules for client-only features
  followImports?: boolean;

  // Maximum depth to follow imports (default: 3)
  importDepth?: number;

  // Package names to ignore when following imports
  ignorePackages?: string[];
}
```

By default, React's `useMemo`, `useCallback`, and `useId` hooks are considered server-compatible. If you specify your own allowlist but don't include a React entry, this default allowlist will be preserved. To override the default React allowlist, include a React entry in your custom allowlist.

### Examples

Incorrect Code Examples:

```jsx
// Missing 'use client' directive with named import
import { useState } from "react";

function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

```jsx
// Missing 'use client' directive with default import and dot notation
import React from "react";

function ExpensiveComponent({ data }) {
	const [state, setState] = React.useState(null);
	return <div>{state}</div>;
}
```

```jsx
// Missing 'use client' directive with namespace import and dot notation
import * as React from "react";

function MemoComponent({ data }) {
	const processedData = React.useMemo(() => processData(data), [data]);
	return <div>{processedData}</div>;
}
```

```jsx
// Missing 'use client' directive with object destructuring
import React from "react";

function Component() {
	const { useState, useEffect } = React;
	const [state, setState] = useState(null);
	useEffect(() => {}, []);
	return <div>{state}</div>;
}
```

```jsx
// Missing 'use client' directive with third-party hook library
import hookLib from "hooks-library";

function CustomHookComponent() {
	const result = hookLib.useCustomHook();
	return <div>{result}</div>;
}
```

```jsx
// Missing 'use client' directive with DOM API
function WindowSize() {
	const width = window.innerWidth;
	return <div>Window width: {width}px</div>;
}
```

```jsx
// Unnecessary 'use client' directive
"use client";

function StaticComponent() {
	return <div>This component doesn't use any client features</div>;
}
```

#### Correct Code Examples:

```jsx
// With 'use client' directive for useState
"use client";

import { useState } from "react";

function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

```jsx
// Without 'use client' directive for useMemo when whitelisted
import { useMemo } from "react";

function ExpensiveComponent({ data }) {
	// This is allowed with { serverCompatibleHooks: ['useMemo'] } option
	const processedData = useMemo(() => processData(data), [data]);
	return <div>{processedData}</div>;
}
```

```jsx
// With 'use client' directive for DOM API
"use client";

function WindowSize() {
	const width = window.innerWidth;
	return <div>Window width: {width}px</div>;
}
```

```jsx
// Without unnecessary 'use client' directive
function StaticComponent() {
	return <div>This component doesn't use any client features</div>;
}
```

## Auto Fix

This rule provides two auto-fix capabilities:

1. **Adding 'use client'**: When client-side features are detected without the directive, the rule will add `'use client';` at the top of the file.

2. **Removing unnecessary 'use client'**: When no client-side features are detected but the directive is present, the rule will remove the directive if `removeUnneededDirectives` is enabled.

## TypeScript Support

This plugin is written in TypeScript and includes type definitions. It works with both JavaScript and TypeScript files.

## ESLint v9 Compatibility

This plugin uses the ESLint v9 flat config format. It won't work with ESLint v8 or earlier without modifications.

## License

MIT
