import { describe } from "vitest";
import { consistentUseClientPlacementRule } from "../src/rules/consistent-use-client-placement.js";
import { TSTester } from "./utils/tester.js";

describe("[rule] consistent-use-client-placement", () => {
	const rule = TSTester.create();

	rule.run("consistent-use-client-placement", consistentUseClientPlacementRule, {
		valid: [
			{
				name: "'use client' at the top of the file",
				filename: "client-component.tsx",
				code: '"use client";\nimport { useState } from "react";\n\nexport function Counter() {\n\tconst [count, setCount] = useState(0);\n\treturn <button onClick={() => setCount(count + 1)}>Count: {count}</button>;\n}'
			},
			{
				name: "File without 'use client' directive",
				filename: "server-component.tsx",
				code: "import { useState } from \"react\";\n\nexport function ServerComponent() {\n\t// This is a server component without 'use client' directive\n\treturn <div>Server Component</div>;\n}"
			},
			{
				name: "'use client' with comments before it",
				filename: "client-component-with-comments.tsx",
				code: '// This is a client component\n/* Multi-line comment\n   explaining the component */\n"use client";\n\nimport { useState } from "react";\n\nexport function Counter() {\n\tconst [count, setCount] = useState(0);\n\treturn <button onClick={() => setCount(count + 1)}>Count: {count}</button>;\n}'
			}
		],
		invalid: [
			{
				name: "'use client' after imports",
				filename: "incorrect-client-directive.tsx",
				code: `import { useState } from "react";

"use client";

export function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}`,
				output: null,
				errors: [{ messageId: "shouldBeFirst" }]
			},
			{
				name: "'use client' in the middle of the file",
				filename: "client-directive-in-function.tsx",
				code: `import { useState } from "react";

export function Counter() {
	"use client";
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}`,
				output: null,
				errors: [{ messageId: "shouldBeFirst" }]
			},
			{
				name: "'use client' at the end of the file",
				filename: "client-directive-at-end.tsx",
				code: `import { useState } from "react";

export function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

"use client";`,
				output: null,
				errors: [{ messageId: "shouldBeFirst" }]
			},
			{
				name: "'use client' with alternative quote styles",
				filename: "client-directive-single-quotes.tsx",
				code: `import { useState } from "react";

'use client';

export function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}`,
				output: null,
				errors: [{ messageId: "shouldBeFirst" }]
			},
			{
				name: "Multiple 'use client' directives",
				filename: "multiple-client-directives.tsx",
				code: `import { useState } from "react";

"use client";

export function Counter() {
	const [count, setCount] = useState(0);
	"use client";
	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}`,
				output: null,
				errors: [{ messageId: "shouldBeFirst" }, { messageId: "duplicateDirective" }]
			},
			{
				name: "Multiple 'use client' directives with the first one in the correct position",
				filename: "duplicate-client-directives.tsx",
				code: `"use client";
import { useState } from "react";

export function Counter() {
    const [count, setCount] = useState(0);
    "use client";
    return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}`,
				output: null,
				errors: [{ messageId: "duplicateDirective" }]
			}
		]
	});
});
