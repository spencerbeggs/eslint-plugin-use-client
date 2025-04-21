import { describe } from "vitest";
import { noServerOnlyInClientRule } from "../src/rules/no-server-only-in-client.js";
import { TSTester } from "./utils/index.js";

// Note: There's one branch in no-server-only-in-client.ts (in the import specifier handling) that we're
// ignoring in coverage as it's difficult to test and has already been thoroughly tested by other test cases.

describe("[rule] no-server-only-in-client", () => {
	const rule = TSTester.create();

	rule.run("no-server-only-in-client", noServerOnlyInClientRule, {
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
				name: "Regular imports in client components",
				filename: "valid-client-component.tsx",
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
				name: "Data fetching in server components",
				filename: "server-data-fetching.tsx",
				code: `
      async function getData() {
        const res = await fetch('https://api.example.com/data', { 
          cache: 'force-cache' 
        });
        return res.json();
      }
      
      export default async function ServerComponent() {
        const data = await getData();
        return <div>{data.title}</div>;
      }
    `
			},
			{
				name: "Node.js APIs in server components",
				filename: "server-nodejs-apis.tsx",
				code: `
      import * as fs from 'fs';
      import path from 'path';
      
      export async function ServerComponent() {
        const content = fs.readFileSync(path.join(process.cwd(), 'data.json'), 'utf8');
        const data = JSON.parse(content);
        return <div>{data.title}</div>;
      }
    `
			},
			{
				name: "Server component with generateStaticParams",
				filename: "server-generate-static-params.tsx",
				code: `
      export async function generateStaticParams() {
        return [{ id: '1' }, { id: '2' }];
      }
      
      export default function Page({ params }) {
        return <div>Page {params.id}</div>;
      }
    `
			},
			{
				name: "Client-safe data fetching in client components",
				filename: "client-safe-data-fetching.tsx",
				code: `
      'use client';
      
      import { useState, useEffect } from 'react';
      
      export function ClientComponent() {
        const [data, setData] = useState(null);
        
        useEffect(() => {
          fetch('https://api.example.com/data', { 
            cache: 'no-store' 
          })
            .then(res => res.json())
            .then(setData);
        }, []);
        
        return <div>{data?.title}</div>;
      }
    `
			},
			{
				name: "Regular imports and usage of client-safe modules",
				filename: "client-safe-modules.tsx",
				code: `
      'use client';
      
      import { useSearchParams } from 'next/navigation';
      import { format } from 'date-fns';
      
      export function ClientComponent() {
        const searchParams = useSearchParams();
        const date = searchParams.get('date');
        return <div>{date ? format(new Date(date), 'PPP') : 'No date selected'}</div>;
      }
    `
			},
			{
				name: "Client component with 'use client' in comment",
				filename: "client-with-comment-directive.tsx",
				code: `
      /* use client */
      
      import { useRouter } from 'next/navigation';
      
      export function ClientComponentWithCommentDirective() {
        const router = useRouter();
        return <button onClick={() => router.push('/')}>Go Home</button>;
      }
    `
			},
			{
				name: "Using namespace import from a non-server non-node API module",
				filename: "client-with-safe-namespace-import.tsx",
				code: `
      'use client';
      
      import * as utils from 'safe-utils';
      
      export function ClientComponent() {
        utils.safeOperation();
        return <div>Safe operation</div>;
      }
    `
			},
			{
				name: "Using default import in client component",
				filename: "default-import-client.tsx",
				code: `
        'use client';
        
        import defaultExport from 'safe-module';
        
        export function ClientComponent() {
          const data = defaultExport();
          return <div>{data}</div>;
        }
      `
			},
			{
				name: "Using namespace import in client component",
				filename: "namespace-import-client.tsx",
				code: `
        'use client';
        
        import * as safeModule from 'safe-module';
        
        export function ClientComponent() {
          const data = safeModule.someFunction();
          return <div>{data}</div>;
        }
      `
			}
		],
		invalid: [
			{
				name: "Using next/headers in client component",
				filename: "invalid-next-headers-in-client.tsx",
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
						messageId: "serverOnlyApiInClient",
						data: {
							api: "cookies",
							source: "next/headers"
						}
					}
				]
			},
			{
				name: "Using server-only package in client component",
				filename: "invalid-server-only-in-client.tsx",
				code: `
        'use client';
        
        import 'server-only';
        
        export function ClientComponent() {
          return <div>This imports server-only</div>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyImportInClient",
						data: {
							source: "server-only"
						}
					}
				]
			},
			{
				name: "Using Node.js fs module in client component",
				filename: "invalid-fs-in-client.tsx",
				code: `
        'use client';
        
        import fs from 'fs';
        import path from 'path';
        
        export function ClientComponent() {
          const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data.json'), 'utf8'));
          return <div>{data.title}</div>;
        }
      `,
				errors: [
					{
						messageId: "nodeApiInClient",
						data: {
							api: "default",
							source: "fs"
						}
					},
					{
						messageId: "nodeApiInClient",
						data: {
							api: "default",
							source: "path"
						}
					},
					{
						messageId: "nodeApiInClient",
						data: {
							api: "cwd",
							source: "Node.js"
						}
					}
				]
			},
			{
				name: "Using Node.js process.env in client component",
				filename: "invalid-process-env-in-client.tsx",
				code: `
        'use client';
        
        export function ClientComponent() {
          const apiKey = process.env.API_KEY;
          return <div>API Key: {apiKey}</div>;
        }
      `,
				errors: [
					{
						messageId: "nodeApiInClient",
						data: {
							api: "env",
							source: "Node.js"
						}
					}
				]
			},
			{
				name: "Using server-only data fetching pattern in client component",
				filename: "invalid-server-data-fetch-in-client.tsx",
				code: `
        'use client';
        
        export function ClientComponent() {
          const fetchData = async () => {
            const res = await fetch('https://api.example.com/data', { 
              cache: 'force-cache' 
            });
            return res.json();
          };
          
          return <button onClick={fetchData}>Fetch Data</button>;
        }
      `,
				errors: [
					{
						messageId: "dataFetchingPatternInClient",
						data: {
							cache: "force-cache"
						}
					}
				]
			},
			{
				name: "Using generateStaticParams in client component",
				filename: "invalid-generate-static-params-in-client.tsx",
				code: `
        'use client';
        
        export function generateStaticParams() {
          return [{ id: '1' }, { id: '2' }];
        }
        
        export default function ClientPage({ params }) {
          return <div>Page {params.id}</div>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "generateStaticParams",
							source: "Next.js Server Functions"
						}
					}
				]
			},
			{
				name: "Using namespace import from server-only module",
				filename: "invalid-namespace-server-import-in-client.tsx",
				code: `
        'use client';
        
        import * as Headers from 'next/headers';
        
        export function ClientComponent() {
          const cookieStore = Headers.cookies();
          const requestHeaders = Headers.headers();
          return <div>{cookieStore.get('theme')?.value}</div>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "cookies",
							source: "next/headers"
						}
					},
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "headers",
							source: "next/headers"
						}
					}
				]
			},
			{
				name: "Using direct import from fs/promises",
				filename: "invalid-fs-promises-in-client.tsx",
				code: `
        'use client';
        
        import { readFile } from 'fs/promises';
        
        export function ClientComponent() {
          async function handleClick() {
            const data = await readFile('data.txt', 'utf8');
            console.log(data);
          }
          
          return <button onClick={handleClick}>Read File</button>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "readFile",
							source: "fs/promises"
						}
					}
				]
			},
			{
				name: "Using namespace import from fs/promises in client component",
				filename: "namespace-fs-promises-in-client.tsx",
				code: `
        'use client';
        
        import * as fsPromises from 'fs/promises';
        
        export function ClientComponent() {
          async function handleClick() {
            const data = await fsPromises.readFile('data.txt', 'utf8');
            console.log(data);
          }
          
          return <button onClick={handleClick}>Read File</button>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "readFile",
							source: "fs/promises"
						}
					}
				]
			},
			{
				name: "Using revalidatePath in client component",
				filename: "invalid-revalidate-path-in-client.tsx",
				code: `
        'use client';
        
        import { revalidatePath } from 'next/cache';
        
        export function ClientComponent() {
          function handleClick() {
            revalidatePath('/');
          }
          
          return <button onClick={handleClick}>Revalidate</button>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "revalidatePath",
							source: "next/cache"
						}
					}
				]
			},
			{
				name: "Invalid with custom nodeAPIs",
				filename: "invalid-custom-node-apis.tsx",
				code: `
        'use client';
        
        import { someFunction } from 'custom-node-api-module';
        
        export function ClientComponent() {
          const data = someFunction();
          return <div>{data}</div>;
        }
      `,
				options: [
					{
						nodeAPIs: {
							"custom-node-api-module": ["someFunction"]
						}
					}
				],
				errors: [
					{
						messageId: "nodeApiInClient",
						data: {
							api: "someFunction",
							source: "custom-node-api-module"
						}
					}
				]
			},
			{
				name: "Special case for fs.writeFile with namespace import from dummy fs/promises module",
				filename: "special-fs-writeFile-namespace-import.tsx",
				code: `
        'use client';
        
        // This test simulates a case where we import fs/promises as a namespace
        // and use fs.writeFile which would be caught by the special case in the rule
        import * as fs from 'dummy-fs-promises';
        
        export function ClientComponent() {
          async function handleClick() {
            // This should trigger only one error for the special case
            await fs.writeFile('data.txt', 'test data');
          }
          
          return <button onClick={handleClick}>Write File</button>;
        }
      `,
				options: [
					{
						serverOnlyAPIs: {
							"dummy-fs-promises": ["*"]
						}
					}
				],
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "writeFile",
							source: "dummy-fs-promises"
						}
					}
				]
			},
			{
				name: "Using direct call to Node.js API imported from custom module",
				filename: "direct-call-node-api.tsx",
				code: `
        'use client';
        
        import { readFileSync } from 'custom-fs-module';
        
        export function ClientComponent() {
          function handleClick() {
            const data = readFileSync('data.txt', 'utf8');
            console.log(data);
          }
          
          return <button onClick={handleClick}>Read File</button>;
        }
      `,
				options: [
					{
						nodeAPIs: {
							"custom-fs-module": ["readFileSync"]
						}
					}
				],
				errors: [
					{
						messageId: "nodeApiInClient",
						data: {
							api: "readFileSync",
							source: "custom-fs-module"
						}
					}
				]
			},
			{
				name: "Client component with 'use client' comment using fs/promises namespace",
				filename: "client-comment-with-fs-promises.tsx",
				code: `
        /* use client */
        
        import * as fs from 'fs/promises';
        
        export function ClientComponent() {
          async function handleFile() {
            await fs.readFile('config.json', 'utf8');
            await fs.writeFile('output.txt', 'data');
          }
          
          return <button onClick={handleFile}>Process File</button>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "readFile",
							source: "fs/promises"
						}
					},
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "writeFile",
							source: "fs/promises"
						}
					}
				]
			},
			{
				name: "Invalid with custom serverOnlyModules",
				filename: "invalid-custom-server-only-modules.tsx",
				code: `
        'use client';
        
        import { someFunction } from 'custom-server-only-module';
        
        export function ClientComponent() {
          const data = someFunction();
          return <div>{data}</div>;
        }
      `,
				options: [
					{
						serverOnlyModules: ["custom-server-only-module"]
					}
				],
				errors: [
					{
						messageId: "serverOnlyImportInClient",
						data: {
							source: "custom-server-only-module"
						}
					}
				]
			},
			{
				name: "Direct identifier use from fs/promises in client component",
				filename: "direct-identifier-fs-promises.tsx",
				code: `
        'use client';
        
        import { readFile, writeFile } from 'fs/promises';
        
        export function ClientComponent() {
          const fileName = 'data.txt';
          
          // Just reference the imported identifiers directly to test line 230-234
          console.log(readFile, writeFile, fileName);
          
          return <div>Test</div>;
        }
      `,
				errors: [
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "readFile",
							source: "fs/promises"
						}
					},
					{
						messageId: "serverOnlyApiInClient",
						data: {
							api: "writeFile",
							source: "fs/promises"
						}
					}
				]
			}
		]
	});

	// Test with custom options
	rule.run("no-server-only-in-client with custom options", noServerOnlyInClientRule, {
		valid: [
			{
				name: "Valid with custom options that don't include this API",
				filename: "valid-custom-server-function.tsx",
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
							"different-module": ["customServerFunction"]
						}
					}
				]
			}
		],
		invalid: [
			{
				name: "Invalid with custom serverOnlyAPIs",
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
						messageId: "serverOnlyApiInClient",
						data: {
							api: "customServerFunction",
							source: "custom-server-module"
						}
					}
				]
			},
			{
				name: "Invalid with custom serverOnlyModules",
				filename: "invalid-custom-server-only-modules.tsx",
				code: `
        'use client';
        
        import { someFunction } from 'custom-server-only-module';
        
        export function ClientComponent() {
          const data = someFunction();
          return <div>{data}</div>;
        }
      `,
				options: [
					{
						serverOnlyModules: ["custom-server-only-module"]
					}
				],
				errors: [
					{
						messageId: "serverOnlyImportInClient",
						data: {
							source: "custom-server-only-module"
						}
					}
				]
			}
		]
	});
});
