import { describe } from "vitest";
import { useClientDirectiveRule } from "../src/rules/use-client-directive.js";
import { TSTester } from "./utils/index.js";

describe("[rule] use-client-directive", () => {
	const rule = TSTester.create();

	rule.run("use-client-directive", useClientDirectiveRule, {
		valid: [
			{
				name: "Component with DOM APIs and use client directive",
				filename: "valid-with-directive.tsx",
				code: "'use client';\nexport function Component() {\n\tdocument.getElementById('root');\n}",
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
				name: "Component without DOM APIs",
				filename: "valid-no-dom-apis.tsx",
				code: "export function Component() {\n\t// No DOM APIs used\n\treturn <div>Hello</div>;\n}",
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
				name: "Component with direct DOM API identifiers",
				filename: "valid-direct-dom-apis.tsx",
				code: "'use client';\nexport function Component() {\n\t// Test direct DOM API identifier\n\tconst doc = document;\n\tconst win = window;\n\tconst nav = navigator;\n\tconst store = localStorage;\n\tconst session = sessionStorage;\n}",
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
				name: "Component using allowlisted React hooks",
				filename: "valid-allowlisted-hooks.tsx",
				code: "import { useMemo, useId } from 'react';\nexport function Component() {\n\tuseMemo(() => {}, []);\n\tuseId();\n}",
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
				name: "Component using fully allowlisted React module",
				filename: "valid-allowlisted-react.tsx",
				code: "import { useMemo, useId } from 'react';\nexport function Component() {\n\tuseMemo(() => {}, []);\n\tuseId();\n}",
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
				name: "Component with various DOM API member expressions",
				filename: "valid-dom-member-expressions.tsx",
				code: "'use client';\nexport function Component() {\n\t// Test member expressions\n\tdocument.getElementById('root');\n\twindow.addEventListener('click', () => {});\n\tnavigator.userAgent;\n\tlocalStorage.setItem('key', 'value');\n}",
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
				name: "Component using namespace import with allowlisted module",
				filename: "valid-namespace-import.tsx",
				code: "import * as React from 'react';\nexport function Component() {\n\tReact.useId();\n\tReact.useMemo(() => {}, []);\n}",
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
				name: "Component with comment before directive",
				filename: "valid-comment-before-directive.tsx",
				code: "// Some comment\n'use client';\nexport function Component() {\n\tdocument.getElementById('root');\n}",
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
				name: "Component with comment after directive",
				filename: "valid-comment-after-directive.tsx",
				code: "'use client';\n// Some comment\nexport function Component() {\n\tdocument.getElementById('root');\n}",
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
				name: "Component using imported document from module",
				filename: "valid-imported-document.tsx",
				code: "import { document } from './mock';\nexport function Component() {\n\tdocument.getElementById('root');\n}",
				options: [
					{
						allowlist: {
							"./mock": true
						}
					}
				]
			},
			{
				name: "Component using namespace import from allowlisted module",
				filename: "valid-namespace-from-allowlisted.tsx",
				code: "import * as DOM from './mock';\nexport function Component() {\n\tDOM.document.getElementById('root');\n}",
				options: [
					{
						allowlist: {
							"./mock": true
						}
					}
				]
			},
			{
				name: "Component using imported document from module with specific allowlist",
				filename: "valid-specific-allowlist.tsx",
				code: "import { document } from './mock';\nexport function Component() {\n\tdocument.getElementById('root');\n}",
				options: [
					{
						allowlist: {
							"./mock": ["document"]
						}
					}
				]
			},
			{
				name: "Component with use client directive in block comment",
				filename: "valid-block-comment-directive.tsx",
				code: "/* use client */\nexport function Component() {\n\tdocument.getElementById('root');\n}",
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
				name: "Component with allowlisted DOM API member expressions",
				filename: "valid-allowlisted-member-expressions.tsx",
				code: "import { document } from 'some-module';\nexport function Component() {\n\t// Test member expressions with allowlisted DOM APIs\n\tdocument.getElementById('root');\n}",
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
				name: "Component with allowlisted namespace import",
				filename: "valid-allowlisted-namespace.tsx",
				code: "import * as DOM from 'some-module';\nexport function Component() {\n\t// Test member expressions with allowlisted namespace import\n\tDOM.document.getElementById('root');\n}",
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
				name: "Component using imported document from non-allowlisted module",
				filename: "valid-non-allowlisted-module.tsx",
				code: "import { document } from 'some-module';\nexport function Component() {\n\tdocument.getElementById('root');\n}",
				options: [
					{
						allowlist: {
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				name: "Component using computed property access",
				filename: "valid-computed-property.tsx",
				code: "const apis = { foo: { getElementById: () => {} } };\nexport function Component() {\n\tapis['foo'].getElementById('root');\n}",
				options: [
					{
						allowlist: {
							"react-dom": ["useId", "useMemo"]
						}
					}
				]
			},
			{
				name: "Component with use client directive using aliased DOM APIs",
				filename: "valid-aliased-dom-apis.tsx",
				code: `'use client';
import * as APIs from 'dom-module';
export function Component() {
	const doc = APIs.document;
	const win = APIs.window;
	doc.getElementById('root');
	win.addEventListener('click', () => {});
}`,
				options: [
					{
						allowlist: {
							"dom-module": ["navigator"]
						}
					}
				]
			}
		],
		invalid: [
			{
				name: "Component using imported document identifier directly",
				filename: "invalid-direct-document-usage.tsx",
				code: `import { document } from './mock';
export function Component() {
	document;  // Direct identifier usage
}`,
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
				output: `'use client';
import { document } from './mock';
export function Component() {
	document;  // Direct identifier usage
}`
			},
			{
				name: "Component using renamed import from module with false allowlist",
				filename: "invalid-renamed-import.tsx",
				code: `import { document as doc } from './mock';
export function Component() {
	doc.getElementById('root');
}`,
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
				output: `'use client';
import { document as doc } from './mock';
export function Component() {
	doc.getElementById('root');
}`
			},
			{
				name: "Component using string literal import name",
				filename: "invalid-string-literal-import.tsx",
				code: `import { "document" as doc } from './mock';
export function Component() {
	doc.getElementById('root');
}`,
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
				output: `'use client';
import { "document" as doc } from './mock';
export function Component() {
	doc.getElementById('root');
}`
			},
			{
				name: "Component using document API without directive",
				filename: "invalid-document-no-directive.tsx",
				code: `export function Component() {
	document.getElementById('root');
}`,
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
				output: `'use client';
export function Component() {
	document.getElementById('root');
}`
			},
			{
				name: "Component using window API without directive",
				filename: "invalid-window-no-directive.tsx",
				code: `export function Component() {
	window.addEventListener('click', () => {});
}`,
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
				output: `'use client';
export function Component() {
	window.addEventListener('click', () => {});
}`
			},
			{
				name: "Component using non-allowlisted DOM API with allowlisted React hook",
				filename: "invalid-mixed-apis.tsx",
				code: `export function Component() {
	useId();
	document.getElementById('root');
}`,
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
				output: `'use client';
export function Component() {
	useId();
	document.getElementById('root');
}`
			},
			{
				name: "Component using navigator API without directive",
				filename: "invalid-navigator-no-directive.tsx",
				code: `export function Component() {
	navigator.userAgent;
}`,
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
				output: `'use client';
export function Component() {
	navigator.userAgent;
}`
			},
			{
				name: "Component using localStorage API without directive",
				filename: "invalid-localStorage-no-directive.tsx",
				code: `export function Component() {
	localStorage.getItem('key');
}`,
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
				output: `'use client';
export function Component() {
	localStorage.getItem('key');
}`
			},
			{
				name: "Component with comment but no directive",
				filename: "invalid-comment-no-directive.tsx",
				code: `// Some comment
export function Component() {
	document.getElementById('root');
}`,
				errors: [{ messageId: "missingUseClient", data: { api: "document" } }],
				output: `// Some comment
'use client';
export function Component() {
	document.getElementById('root');
}`
			},
			{
				name: "Component with different comment but no directive",
				filename: "invalid-different-comment-no-directive.tsx",
				code: `// Different comment
export function Component() {
	document.getElementById('root');
}`,
				errors: [{ messageId: "missingUseClient", data: { api: "document" } }],
				output: `// Different comment
'use client';
export function Component() {
	document.getElementById('root');
}`
			},
			{
				name: "Component using imported document from module with wrong allowlist",
				filename: "invalid-wrong-allowlist.tsx",
				code: `import { document } from './mock';
export function Component() {
	document.getElementById('root');
}`,
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
				output: `'use client';
import { document } from './mock';
export function Component() {
	document.getElementById('root');
}`
			},
			{
				name: "Component with global DOM API member expressions",
				filename: "invalid-global-dom-expressions.tsx",
				code: `export function Component() {
	// Test member expressions with global DOM APIs
	document.getElementById('root');
	window.addEventListener('click', () => {});
	navigator.userAgent;
}`,
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
				output: `'use client';
export function Component() {
	// Test member expressions with global DOM APIs
	document.getElementById('root');
	window.addEventListener('click', () => {});
	navigator.userAgent;
}`
			},
			{
				name: "Component with namespace import and partially allowlisted DOM API properties",
				filename: "invalid-partial-allowlist-namespace.tsx",
				code: `import * as DOM from 'some-module';
export function Component() {
	// Test member expressions with partially allowlisted DOM API properties
	DOM.document.getElementById('root');
	DOM.window.addEventListener('click', () => {});
}`,
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
				output: `'use client';
import * as DOM from 'some-module';
export function Component() {
	// Test member expressions with partially allowlisted DOM API properties
	DOM.document.getElementById('root');
	DOM.window.addEventListener('click', () => {});
}`
			},
			{
				name: "Component with multiple DOM APIs on same line",
				filename: "invalid-multiple-apis-one-line.tsx",
				code: `export function Component() {
	const bad = \`\${window.location}-\${navigator.appName}\`;
	return <div>{bad}</div>;
}`,
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
				output: `'use client';
export function Component() {
	const bad = \`\${window.location}-\${navigator.appName}\`;
	return <div>{bad}</div>;
}`
			},
			{
				name: "Component with multiple DOM APIs",
				filename: "invalid-multiple-dom-apis.tsx",
				code: `export function Component() {
	window.addEventListener('resize', () => {});
	// This is a comment in the middle
	document.querySelector('.class');
}`,
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "window" }
					},
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
				output: `'use client';
export function Component() {
	window.addEventListener('resize', () => {});
	// This is a comment in the middle
	document.querySelector('.class');
}`
			},
			{
				name: "Component using aliased DOM API from namespace import",
				filename: "invalid-aliased-dom-api.tsx",
				code: `import * as DOM from 'some-module';
export function Component() {
	const doc = DOM.document;
	doc.getElementById('root');
}`,
				errors: [
					{
						messageId: "missingUseClient",
						data: { api: "document" }
					}
				],
				options: [
					{
						allowlist: {
							"some-module": ["window"]
						}
					}
				],
				output: `'use client';
import * as DOM from 'some-module';
export function Component() {
	const doc = DOM.document;
	doc.getElementById('root');
}`
			},
			{
				name: "Component with string comment in code but not as an actual comment",
				filename: "invalid-string-not-comment.tsx",
				code: `export function Component() {
	const message = "Some comment"; // This is in code, not a comment
	document.getElementById('root');
}`,
				errors: [{ messageId: "missingUseClient", data: { api: "document" } }],
				output: `'use client';
export function Component() {
	const message = "Some comment"; // This is in code, not a comment
	document.getElementById('root');
}`
			}
		]
	});
});
