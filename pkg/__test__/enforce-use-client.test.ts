// tests/rules/enforce-use-client.test.ts
import { RuleTester } from "@typescript-eslint/rule-tester";
import tseslint from "typescript-eslint";
import { describe, beforeEach, it } from "vitest";
import { enforceRule } from "../src/rules/enforce-use-client-advanced.js";

// Configure @typescript-eslint/rule-tester to use vitest
RuleTester.afterAll = () => {
	console.log("afterAll");
};
RuleTester.describe = describe;
RuleTester.it = it;

describe("enforce-use-client rule", () => {
	let ruleTester: RuleTester;

	beforeEach(() => {
		// Configure rule tester for ESLint v9
		ruleTester = new RuleTester({
			languageOptions: {
				parser: tseslint.parser,
				parserOptions: {
					ecmaVersion: 2021,
					sourceType: "module",
					ecmaFeatures: { jsx: true },
					project: "./tsconfig.json"
				}
			}
		});
	});

	it("validates all test cases correctly", () => {
		ruleTester.run("enforce-use-client", enforceRule, {
			valid: [
				// Server component with server-safe hooks doesn't need 'use client'
				{
					code: `
            import React, { useMemo, useId } from 'react';
            
            export default function ServerComponent() {
              const id = useId();
              const computed = useMemo(() => calculateSomething(), []);
              return <div id={id}>{computed}</div>;
            }
          `,
					filename: "server-component.tsx"
				},

				// Component with 'use client' directive can use client-side features
				{
					code: `
            'use client';
            
            import React, { useState, useEffect } from 'react';
            
            export default function ClientComponent() {
              const [count, setCount] = useState(0);
              
              useEffect(() => {
                document.title = \`Count: \${count}\`;
              }, [count]);
              
              return <button onClick={() => setCount(count + 1)}>{count}</button>;
            }
          `,
					filename: "client-component.tsx"
				},

				// Allowlisted imports are permitted without 'use client'
				{
					code: `
            import React from 'react';
            import { headers } from 'next/headers';
            
            export default function ServerComponent() {
              const headersList = headers();
              return <div>{headersList.get('user-agent')}</div>;
            }
          `,
					filename: "allowlisted-import.tsx",
					options: [
						{
							allowlist: {
								"next/headers": true
							},
							traceDepth: 0,
							traceDependencies: false
						}
					]
				},

				// ESLint directive to disable check
				{
					code: `
            // check-use-client-disable
            import React, { useState } from 'react';
            
            export default function SpecialComponent() {
              const [count, setCount] = useState(0);
              return <div>{count}</div>;
            }
          `,
					filename: "special-case.tsx"
				},

				// Type-only imports are allowed
				{
					code: `
            import React from 'react';
            import type { ClientComponent } from './client-component';
            
            type Props = {
              client: ClientComponent;
            };
            
            export default function ServerComponent({ client }: Props) {
              return <div>Server renders: {client.name}</div>;
            }
          `,
					filename: "type-only-import.tsx"
				}
			],
			invalid: [
				// Missing 'use client' with useState
				{
					code: `
            import React, { useState } from 'react';
            
            export default function MissingDirective() {
              const [state, setState] = useState(0);
              return <div>{state}</div>;
            }
          `,
					filename: "missing-directive.tsx",
					errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }],
					output: `'use client';

            import React, { useState } from 'react';
            
            export default function MissingDirective() {
              const [state, setState] = useState(0);
              return <div>{state}</div>;
            }
          `
				},

				// Missing 'use client' with DOM API
				{
					code: `
            import React from 'react';
            
            export default function DomApiUsage() {
              function handleClick() {
                document.title = 'Clicked';
              }
              
              return <button onClick={handleClick}>Click me</button>;
            }
          `,
					filename: "dom-api.tsx",
					errors: [
						{ messageId: "missingUseClient" },
						{ messageId: "detectedClientDep" },
						{ messageId: "detectedClientDep" }
					],
					output: `'use client';

            import React from 'react';
            
            export default function DomApiUsage() {
              function handleClick() {
                document.title = 'Clicked';
              }
              
              return <button onClick={handleClick}>Click me</button>;
            }
          `
				},

				// Event handler requires 'use client'
				{
					code: `
            import React from 'react';
            
            export default function EventHandler() {
              return <button onClick={() => console.log('clicked')}>Click me</button>;
            }
          `,
					filename: "event-handler.tsx",
					errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }],
					output: `'use client';

            import React from 'react';
            
            export default function EventHandler() {
              return <button onClick={() => console.log('clicked')}>Click me</button>;
            }
          `
				},

				// Client detection condition requires 'use client'
				{
					code: `
            import React from 'react';
            
            export default function ClientCheck() {
              if (typeof window !== 'undefined') {
                console.log('Running in browser');
              }
              
              return <div>Hello</div>;
            }
          `,
					filename: "client-check.tsx",
					errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
				},

				// Known client-only package imports
				{
					code: `
            import React from 'react';
            import { Dialog } from '@headlessui/react';
            
            export default function WithDialog() {
              return <Dialog>Content</Dialog>;
            }
          `,
					filename: "headlessui-usage.tsx",
					errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
				},

				// Likely shared component detection
				{
					code: `
            import React from 'react';
            
            export function SharedComponent({ data }) {
              return <div>{data.map(item => <span key={item.id}>{item.name}</span>)}</div>;
            }
          `,
					filename: "shared-component.tsx",
					errors: [{ messageId: "sharedComponent" }]
				}
			]
		});
	});
});
