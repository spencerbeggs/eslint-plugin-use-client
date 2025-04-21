import { describe } from "vitest";
import { noMixedServerClientAPIsRule } from "../src/rules/no-mixed-server-client-apis.js";
import { TSTester } from "./utils/index.js";

describe("[rule] no-mixed-server-client-apis", () => {
	const rule = TSTester.create();

	rule.run("no-mixed-server-client-apis", noMixedServerClientAPIsRule, {
		valid: [
			{
				name: "Server-only APIs in server component",
				filename: "server-component.tsx",
				code: `
      import { cookies } from 'next/headers';
      
      export function ServerComponent() {
        const cookieStore = cookies();
        return <div>{cookieStore.get('theme')?.value}</div>;
      }
    `
			},
			{
				name: "Client-only APIs in client component",
				filename: "client-component.tsx",
				code: `
      'use client';
      
      import { useState } from 'react';
      
      export function ClientComponent() {
        const [count, setCount] = useState(0);
        return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
      }
    `
			},
			{
				name: "Passing data from server to client component",
				filename: "server-wrapper.tsx",
				code: `
      // ServerWrapper.tsx
      import { cookies } from 'next/headers';
      import { ClientComponent } from './ClientComponent';
      
      export function ServerWrapper() {
        const theme = cookies().get('theme')?.value;
        return <ClientComponent initialTheme={theme} />;
      }
    `
			},
			{
				name: "Using browser APIs in client component",
				filename: "client-with-browser-apis.tsx",
				code: `
      'use client';
      
      export function ClientComponent() {
        function handleClick() {
          document.title = 'New Title';
        }
        
        return <button onClick={handleClick}>Change Title</button>;
      }
    `
			},
			{
				name: "Client component with 'use client' directive in a comment",
				filename: "client-with-comment-directive.tsx",
				code: `
      // use client
      
      import { useState } from 'react';
      
      export function ClientComponent() {
        const [count, setCount] = useState(0);
        return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
      }
    `
			},
			{
				name: "Import with a default import",
				filename: "client-with-default-import.tsx",
				code: `
      'use client';
      
      import React from 'react';
      
      export function ClientComponent() {
        const [count, setCount] = React.useState(0);
        return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
      }
    `
			},
			{
				name: "Import with a namespace import",
				filename: "client-with-namespace-import.tsx",
				code: `
      'use client';
      
      import * as React from 'react';
      
      export function ClientComponent() {
        const [count, setCount] = React.useState(0);
        return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
      }
    `
			},
			{
				name: "Using external non-relative imports in client component",
				filename: "client-with-external-imports.tsx",
				code: `
      'use client';
      
      import { useState } from 'react';
      import { ExternalComponent } from 'some-external-library';
      
      export function ClientComponent() {
        const [count, setCount] = useState(0);
        return (
          <div>
            <ExternalComponent />
            <button onClick={() => setCount(count + 1)}>Count: {count}</button>
          </div>
        );
      }
    `
			},
			{
				name: "Client component with complex nested member expressions",
				filename: "client-with-complex-nesting.tsx",
				code: `
      'use client';
      
      export function ClientComponent() {
        // This is valid in a client component, but has deep nested member expressions
        const deeplyNested = window.navigator.userAgent.toLowerCase().includes('chrome');
        return <div>{deeplyNested ? 'Chrome' : 'Not Chrome'}</div>;
      }
    `
			}
		],
		invalid: [
			{
				name: "Using server-only API in client component",
				filename: "invalid-server-api-in-client.tsx",
				code: `
        'use client';
        
        import { cookies } from 'next/headers';
        
        export function ClientComponent() {
          const cookieStore = cookies();
          return <div>{cookieStore.get('theme')?.value}</div>;
        }
      `,
				errors: [
					{
						messageId: "serverInClient",
						data: {
							api: "cookies",
							source: "next/headers"
						}
					}
				]
			},
			{
				name: "Using client-only hook in server component",
				filename: "invalid-client-hook-in-server.tsx",
				code: `
        import { useState } from 'react';
        
        export function ServerComponent() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "useState"
						}
					}
				]
			},
			{
				name: "Using browser global in server component",
				filename: "invalid-browser-global-in-server.tsx",
				code: `
        export function ServerComponent() {
          const title = document.title;
          return <div>{title}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "document"
						}
					}
				]
			},
			{
				name: "Using client-side event handler in server component",
				filename: "invalid-event-handler-in-server.tsx",
				code: `
        export function ServerComponent() {
          return <button onClick={() => console.log('clicked')}>Click Me</button>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "onClick"
						}
					}
				]
			},
			{
				name: "Using server-only API method calls in client component",
				filename: "invalid-server-api-method-in-client.tsx",
				code: `
        'use client';
        
        import { cookies } from 'next/headers';
        
        export function ClientComponent() {
          const theme = cookies().get('theme')?.value;
          return <div>Theme: {theme}</div>;
        }
      `,
				errors: [
					{
						messageId: "serverInClient",
						data: {
							api: "cookies",
							source: "next/headers"
						}
					}
				]
			},
			{
				name: "Using client-only API in server component",
				filename: "invalid-client-api-in-server.tsx",
				code: `
        import { useRouter } from 'next/router';
        
        export function ServerComponent() {
          const router = useRouter();
          return <div>Current path: {router.pathname}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "useRouter"
						}
					}
				]
			},
			{
				name: "Using nested browser global property in server component",
				filename: "invalid-nested-browser-global-in-server.tsx",
				code: `
        export function ServerComponent() {
          const currentUrl = window.location.href;
          return <div>Current URL: {currentUrl}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "window"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "location"
						}
					}
				]
			},
			{
				name: "Using deeply nested browser global property in server component",
				filename: "invalid-deeply-nested-browser-global-in-server.tsx",
				code: `
        export function ServerComponent() {
          const userAgent = window.navigator.userAgent;
          return <div>User Agent: {userAgent}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "window"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "navigator"
						}
					}
				]
			},
			{
				name: "Using very deeply nested browser global property in server component",
				filename: "invalid-very-deeply-nested-global-in-server.tsx",
				code: `
        export function ServerComponent() {
          const storage = window.localStorage.getItem('key');
          const history = window.history.state.nested.value;
          return <div>{storage} - {history}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "window"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "localStorage"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "history"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "window"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "history"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "history"
						}
					}
				]
			},
			{
				name: "Using triple-nested member expression in server component",
				filename: "invalid-triple-nested-member-expression-in-server.tsx",
				code: `
        export function ServerComponent() {
          // First access is window.navigator, second is navigator.userAgent, third is userAgent.toLowerCase
          const browser = window.navigator.userAgent.toLowerCase();
          return <div>Browser: {browser}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "window"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "navigator"
						}
					}
				]
			},
			{
				name: "Recursive member expressions in server component",
				filename: "invalid-recursive-member-expressions-in-server.tsx",
				code: `
        export function ServerComponent() {
          // This expression has multiple nesting levels and will test recursive member expression handling
          let value = window.parent.location.href;
          if (value.includes('test')) {
            value = window.top.document.location.href;
          }
          return <div>{value}</div>;
        }
      `,
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "window"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "location"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "window"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "document"
						}
					},
					{
						messageId: "clientInServer",
						data: {
							api: "location"
						}
					}
				]
			}
		]
	});

	// Test with custom options
	rule.run("no-mixed-server-client-apis with custom options", noMixedServerClientAPIsRule, {
		valid: [
			{
				name: "Valid with custom clientHooks options that don't include useState",
				filename: "valid-custom-client-hooks.tsx",
				code: `
        import { useState } from 'react';
        
        export function ServerComponent() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `,
				options: [
					{
						clientHooks: ["useEffect", "useLayoutEffect"] // useState is not in this list
					}
				]
			}
		],
		invalid: [
			{
				name: "Test with custom serverOnlyAPIs",
				filename: "invalid-custom-server-only-apis.tsx",
				code: `
        'use client';
        
        import { customServerFunction } from 'custom-server-module';
        
        export function ClientComponent() {
          const data = customServerFunction();
          return <div>{data}</div>;
        }
      `,
				options: [
					{
						serverOnlyAPIs: {
							"custom-server-module": ["customServerFunction"]
						}
					}
				],
				errors: [
					{
						messageId: "serverInClient",
						data: {
							api: "customServerFunction",
							source: "custom-server-module"
						}
					}
				]
			},
			{
				name: "Test with custom browserGlobals",
				filename: "invalid-custom-browser-globals.tsx",
				code: `
        export function ServerComponent() {
          const value = customGlobal.getValue();
          return <div>{value}</div>;
        }
      `,
				options: [
					{
						browserGlobals: ["customGlobal"]
					}
				],
				errors: [
					{
						messageId: "clientInServer",
						data: {
							api: "customGlobal"
						}
					}
				]
			}
		]
	});
});
