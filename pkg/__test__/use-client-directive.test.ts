import { describe } from "vitest";
import { useClientDirectiveRule } from "../src/rules/use-client-directive.js";
import { dedent, TSTester } from "./utils/index.js";

describe("[rule] use-client-directive", () => {
	const rule = TSTester.create();

	rule.run("use-client-directive", useClientDirectiveRule, {
		valid: [
			{
				code: dedent`
					'use client';
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component with DOM APIs and use client directive",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					export function Component() {
						// No DOM APIs used
						return <div>Hello</div>;
					}
				`,
				filename: "valid.tsx",
				name: "component without DOM APIs",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					'use client';
					export function Component() {
						// Test direct DOM API identifier
						const doc = document;
						const win = window;
						const nav = navigator;
						const store = localStorage;
						const session = sessionStorage;
					}
				`,
				filename: "valid.tsx",
				name: "component with direct DOM API identifiers",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					import { useMemo, useId } from 'react';
					export function Component() {
						useMemo(() => {}, []);
						useId();
					}
				`,
				filename: "valid.tsx",
				name: "component using allowlisted React hooks",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					import { useMemo, useId } from 'react';
					export function Component() {
						useMemo(() => {}, []);
						useId();
					}
				`,
				filename: "valid.tsx",
				name: "component using fully allowlisted React module",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					'use client';
					export function Component() {
						// Test member expressions
						document.getElementById('root');
						window.addEventListener('click', () => {});
						navigator.userAgent;
						localStorage.getItem('key');
						sessionStorage.setItem('key', 'value');
					}
				`,
				filename: "valid.tsx",
				name: "component with various DOM API member expressions",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					import * as React from 'react';
					export function Component() {
						React.useId();
						React.useMemo(() => {}, []);
					}
				`,
				filename: "valid.tsx",
				name: "component using namespace import with allowlisted module",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					// Some comment
					'use client';
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component with comment before directive",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					'use client';
					// Some comment
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component with comment after directive",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					import { document } from './mock';
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component using imported document from module",
				options: [
					{
						allowlist: {
							"./mock": true
						}
					}
				]
			},
			{
				code: dedent`
					import * as DOM from './mock';
					export function Component() {
						DOM.document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component using namespace import from allowlisted module",
				options: [
					{
						allowlist: {
							"./mock": true
						}
					}
				]
			},
			{
				code: dedent`
					import { document } from './mock';
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component using imported document from module with specific allowlist",
				options: [
					{
						allowlist: {
							"./mock": ["document"]
						}
					}
				]
			},
			{
				code: dedent`
					/* use client */
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component with use client directive in block comment",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					import { document } from 'some-module';
					export function Component() {
						// Test member expressions with allowlisted DOM APIs
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component with allowlisted DOM API member expressions",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"],
							"some-module": true
						}
					}
				]
			},
			{
				code: dedent`
					import * as DOM from 'some-module';
					export function Component() {
						// Test member expressions with allowlisted namespace import
						DOM.document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component with allowlisted namespace import",
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"],
							"some-module": true
						}
					}
				]
			},
			{
				code: dedent`
					import { document } from 'some-module';
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component using imported document from non-allowlisted module",
				options: [
					{
						allowlist: {
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				code: dedent`
					const apis = { foo: { getElementById: () => {} } };
					export function Component() {
						apis['foo'].getElementById('root');
					}
				`,
				filename: "valid.tsx",
				name: "component using computed property access",
				options: [
					{
						allowlist: {
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			}
		],
		invalid: [
			{
				code: dedent`
					import { document } from './mock';
					export function Component() {
						document;  // Direct identifier usage
					}
				`,
				filename: "invalid.tsx",
				name: "component using imported document identifier directly",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							"./mock": ["window"]
						}
					}
				],
				output: dedent`
					'use client';
					import { document } from './mock';
					export function Component() {
						document;  // Direct identifier usage
					}
				`
			},
			{
				code: dedent`
					import { document as doc } from './mock';
					export function Component() {
						doc.getElementById('root');
					}
				`,
				filename: "invalid.tsx",
				name: "component using renamed import from module with false allowlist",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							"./mock": false
						}
					}
				],
				output: dedent`
					'use client';
					import { document as doc } from './mock';
					export function Component() {
						doc.getElementById('root');
					}
				`
			},
			{
				code: dedent`
					import { "document" as doc } from './mock';
					export function Component() {
						doc.getElementById('root');
					}
				`,
				filename: "invalid.tsx",
				name: "component using string literal import name",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							"./mock": ["window"]
						}
					}
				],
				output: dedent`
					'use client';
					import { "document" as doc } from './mock';
					export function Component() {
						doc.getElementById('root');
					}
				`
			},
			{
				code: dedent`
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "invalid.tsx",
				name: "component using document API without directive",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					'use client';
					export function Component() {
						document.getElementById('root');
					}
				`
			},
			{
				code: dedent`
					export function Component() {
						window.addEventListener('click', () => {});
					}
				`,
				filename: "invalid.tsx",
				name: "component using window API without directive",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "window" }
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					'use client';
					export function Component() {
						window.addEventListener('click', () => {});
					}
				`
			},
			{
				code: dedent`
					export function Component() {
						useId();
						document.getElementById('root');
					}
				`,
				filename: "invalid.tsx",
				name: "component using non-allowlisted DOM API with allowlisted React hook",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					'use client';
					export function Component() {
						useId();
						document.getElementById('root');
					}
				`
			},
			{
				code: dedent`
					export function Component() {
						navigator.userAgent;
					}
				`,
				filename: "invalid.tsx",
				name: "component using navigator API without directive",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "navigator" }
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					'use client';
					export function Component() {
						navigator.userAgent;
					}
				`
			},
			{
				code: dedent`
					export function Component() {
						localStorage.getItem('key');
					}
				`,
				filename: "invalid.tsx",
				name: "component using localStorage API without directive",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "localStorage" }
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					'use client';
					export function Component() {
						localStorage.getItem('key');
					}
				`
			},
			{
				code: dedent`
					// Some comment
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "invalid.tsx",
				name: "component with comment but no directive",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					// Some comment
					'use client';
					export function Component() {
						document.getElementById('root');
					}
				`
			},
			{
				code: dedent`
					import { document } from './mock';
					export function Component() {
						document.getElementById('root');
					}
				`,
				filename: "invalid.tsx",
				name: "component using imported document from module with wrong allowlist",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							"./mock": ["window"]
						}
					}
				],
				output: dedent`
					'use client';
					import { document } from './mock';
					export function Component() {
						document.getElementById('root');
					}
				`
			},
			{
				code: dedent`
					export function Component() {
						// Test member expressions with global DOM APIs
						document.getElementById('root');
						window.addEventListener('click', () => {});
						navigator.userAgent;
					}
				`,
				filename: "invalid.tsx",
				name: "component with global DOM API member expressions",
				errors: [
					{
						messageId: "missingUseClient",
						line: 3,
						column: 2
					},
					{
						messageId: "missingUseClient",
						line: 4,
						column: 2
					},
					{
						messageId: "missingUseClient",
						line: 5,
						column: 2
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					'use client';
					export function Component() {
						// Test member expressions with global DOM APIs
						document.getElementById('root');
						window.addEventListener('click', () => {});
						navigator.userAgent;
					}
				`
			},
			{
				code: dedent`
					import * as DOM from 'some-module';
					export function Component() {
						// Test member expressions with partially allowlisted namespace import
						const doc = DOM.document;
						doc.getElementById('root');
					}
				`,
				filename: "invalid.tsx",
				name: "component with partially allowlisted namespace import",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" },
						line: 4
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"],
							"some-module": ["window"]
						}
					}
				],
				output: dedent`
					'use client';
					import * as DOM from 'some-module';
					export function Component() {
						// Test member expressions with partially allowlisted namespace import
						const doc = DOM.document;
						doc.getElementById('root');
					}
				`
			},
			{
				code: dedent`
					export function Component() {
						const bad = \`\${window.location}-\${navigator.appName}\`;
						return <div>{bad}</div>;
					}
				`,
				filename: "invalid.tsx",
				name: "component with multiple DOM APIs on same line",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "window" }
					},
					{
						messageId: "missingUseClient",
						data: { api: "navigator" }
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"]
						}
					}
				],
				output: dedent`
					'use client';
					export function Component() {
						const bad = \`\${window.location}-\${navigator.appName}\`;
						return <div>{bad}</div>;
					}
				`
			},
			{
				code: dedent`
					import * as DOM from 'some-module';
					export function Component() {
						// Test member expressions with partially allowlisted DOM API properties
						DOM.document.getElementById('root');
						DOM.window.addEventListener('click', () => {});
					}
				`,
				filename: "invalid.tsx",
				name: "component with namespace import and partially allowlisted DOM API properties",
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" },
						line: 4
					}
				],
				options: [
					{
						allowlist: {
							react: true,
							"react-dom": ["useId", "useMemo"],
							"some-module": ["window"]
						}
					}
				],
				output: dedent`
					'use client';
					import * as DOM from 'some-module';
					export function Component() {
						// Test member expressions with partially allowlisted DOM API properties
						DOM.document.getElementById('root');
						DOM.window.addEventListener('click', () => {});
					}
				`
			}
		]
	});
});
