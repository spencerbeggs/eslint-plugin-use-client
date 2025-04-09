# no-mixed-server-client-apis

This rule prevents mixing server-only APIs with client-side code or client-only APIs with server components.

## Rule Details

In React Server Components, a clear separation between server and client components is essential for proper functioning. This rule helps enforce that separation by detecting when server-only APIs are used in client components or when client-only features are used in server components.

The rule identifies:

1. Usage of server-only APIs (like `cookies()`, `headers()` from Next.js) in client components
2. Usage of client-only APIs (like `useState`, `useEffect`, browser APIs) in server components
3. Importing server components directly in client components without proper boundaries

### Examples of incorrect code for this rule:

```tsx
// Incorrect - Using server-only API in client component
"use client";

import { useState } from "react";
import { cookies } from "next/headers"; // Server-only API

export function ClientComponent() {
	const [count, setCount] = useState(0);
	const cookieStore = cookies(); // This will cause a runtime error

	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

```tsx
// Incorrect - Using client-only hooks in server component
import { useEffect } from "react";

export function ServerComponent() {
	useEffect(() => {
		document.title = "New Page"; // This will cause a runtime error
	}, []);

	return <div>Server Component</div>;
}
```

```tsx
// Incorrect - Directly importing server component in client component
"use client";

import { useState } from "react";
import { ServerComponent } from "./ServerComponent"; // Direct import of server component

export function ClientComponent() {
	const [count, setCount] = useState(0);

	return (
		<div>
			<ServerComponent /> {/* This will cause runtime errors */}
			<button onClick={() => setCount(count + 1)}>Count: {count}</button>
		</div>
	);
}
```

### Examples of correct code for this rule:

```tsx
// Correct - Separating server and client logic
// ServerComponent.tsx
import { cookies } from "next/headers";

export function getServerData() {
	return cookies().get("theme")?.value;
}

// ClientComponent.tsx
("use client");

import { useState, useEffect } from "react";

export function ClientComponent({ initialTheme }) {
	const [theme, setTheme] = useState(initialTheme);

	return <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Toggle Theme</button>;
}

// Page.tsx
import { getServerData } from "./ServerComponent";
import { ClientComponent } from "./ClientComponent";

export default function Page() {
	const theme = getServerData();
	return <ClientComponent initialTheme={theme} />;
}
```

```tsx
// Correct - Using React suspense boundary for server components
// ClientComponent.tsx
"use client";

import { useState, Suspense } from "react";

export function ClientComponent({ children }) {
	const [count, setCount] = useState(0);

	return (
		<div>
			<Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
			<button onClick={() => setCount(count + 1)}>Count: {count}</button>
		</div>
	);
}

// Page.tsx
import { ClientComponent } from "./ClientComponent";
import { ServerComponent } from "./ServerComponent";

export default function Page() {
	return (
		<ClientComponent>
			<ServerComponent />
		</ClientComponent>
	);
}
```

```tsx
// Correct - Using dynamic imports for server components
"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";

// Use dynamic import with ssr: true for server components
const ServerComponentClient = dynamic(() => import("./ServerComponent"), { ssr: true });

export function ClientComponent() {
	const [count, setCount] = useState(0);

	return (
		<div>
			<Suspense fallback={<div>Loading...</div>}>
				<ServerComponentClient />
			</Suspense>
			<button onClick={() => setCount(count + 1)}>Count: {count}</button>
		</div>
	);
}
```

## Common Server-only APIs

The rule identifies usage of these common server-only APIs in client components:

- `cookies()`, `headers()` from "next/headers"
- `fetch` with the `{ cache: 'force-cache' }` option
- `generateStaticParams`
- `generateMetadata`
- File system access methods like `readFile`, `readdir` if imported from node modules
- Database direct access without API routes

## Common Client-only APIs

The rule identifies usage of these common client-only APIs in server components:

- React hooks (`useState`, `useEffect`, `useReducer`, etc.)
- DOM manipulation (`document`, `window`, `navigator`, etc.)
- Browser APIs (`localStorage`, `sessionStorage`, etc.)
- Event handlers (`onClick`, `onChange`, etc.)

## Implementation Notes

The rule should analyze imports and function calls to detect:

1. Import statements that bring server-only or client-only APIs into the wrong context
2. Function/method calls that use server-only or client-only APIs
3. React hooks usage in server components
4. Direct references to browser globals in server components

## When Not To Use It

You can disable this rule if:

1. You're not using React Server Components
2. You're using a different approach to handle client/server boundaries
3. You have implemented custom mechanisms to safely bridge client and server code

## Further Reading

- [React Server Components - Official Documentation](https://react.dev/reference/react/use-client)
- [Next.js - Server and Client Components](https://nextjs.org/docs/getting-started/react-essentials)
- [Understanding Server and Client Components](https://vercel.com/blog/understanding-react-server-components)
