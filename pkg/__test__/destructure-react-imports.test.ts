import { describe } from "vitest";
import { destructureReactImportsRule } from "../src/rules/destructure-react-imports.js";
import { TSTester } from "./utils/index.js";

describe("[rule] destructure-react-imports", () => {
	const rule = TSTester.create();

	rule.run("destructure-react-imports", destructureReactImportsRule, {
		valid: [
			{
				name: "already destructured React imports",
				code: 'import { useState, useEffect } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = useState(0);\n\tuseEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <div>{count}</div>;\n}',
				filename: "destructured-imports.tsx"
			},
			{
				name: "already destructured React requires",
				code: 'const { useState, useEffect } = require("react");\n\nmodule.exports = function MyComponent() {\n\tconst [count, setCount] = useState(0);\n\tuseEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <div>{count}</div>;\n}',
				filename: "destructured-requires.tsx"
			}
		],
		invalid: [
			{
				name: "non-destructured React imports",
				code: 'import React from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = React.useState(0);\n\tReact.useEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <div>{count}</div>;\n}',
				output: 'import { useEffect, useState } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = useState(0);\n\tuseEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <div>{count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-imports.tsx"
			},
			{
				name: "non-destructured React requires",
				code: 'const React = require("react");\n\nmodule.exports = function MyComponent() {\n\tconst [count, setCount] = React.useState(0);\n\tReact.useEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <div>{count}</div>;\n}',
				output: 'const { useEffect, useState } = require("react");\n\nmodule.exports = function MyComponent() {\n\tconst [count, setCount] = useState(0);\n\tuseEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <div>{count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "commonjs-require.tsx"
			},
			{
				name: "unused React import",
				code: `import React from "react";

export function MyComponent() {
	return <div>Hello</div>;
}`,
				output: `export function MyComponent() {
	return <div>Hello</div>;
}`,
				errors: [{ messageId: "removeUnusedReact" }],
				filename: "unused-react-import.tsx"
			},
			{
				name: "handles unused React import with newline after",
				code: `import React from "react";

export function MyComponent() {
	return <div>Hello</div>;
}`,
				output: `export function MyComponent() {
	return <div>Hello</div>;
}`,
				errors: [{ messageId: "removeUnusedReact" }],
				filename: "unused-react-import-newline-after.tsx"
			},
			{
				name: "handles unused React import with newlines before and after",
				code: 'const x = 1;\nimport React from "react";\nexport function MyComponent() {\n\treturn <div>Hello</div>;\n}',
				output: "const x = 1;\nexport function MyComponent() {\n\treturn <div>Hello</div>;\n}",
				errors: [{ messageId: "removeUnusedReact" }],
				filename: "unused-react-import-newlines-both.tsx"
			},
			{
				name: "mixed destructured and default imports",
				code: 'import React, { Fragment } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = React.useState<number>(0);\n\tReact.useEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <Fragment><div>{count}</div></Fragment>;\n}',
				output: 'import { Fragment, useEffect, useState } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = useState<number>(0);\n\tuseEffect(() => {\n\t\tconsole.log(count);\n\t}, [count]);\n\treturn <Fragment><div>{count}</div></Fragment>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "mixed-imports.tsx"
			},
			{
				name: "type references from React",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC<{ name: string }> = ({ name }) => {\n\tconst [count, setCount] = React.useState<number>(0);\n\treturn <div>{name}: {count}</div>;\n}',
				output: 'import { FC, useState } from "react";\n\nexport const MyComponent: FC<{ name: string }> = ({ name }) => {\n\tconst [count, setCount] = useState<number>(0);\n\treturn <div>{name}: {count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "type-references.tsx"
			},
			{
				name: "handles malformed type parameters gracefully",
				code: 'import React from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = React.useState<>;\n\treturn <div>{count}</div>;\n}',
				output: 'import { useState } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = useState<>;\n\treturn <div>{count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "malformed-type-params.tsx"
			},
			{
				name: "handles malformed type references gracefully",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				output: 'import { FC } from "react";\n\nexport const MyComponent: FC = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "malformed-type-refs.tsx"
			},
			{
				name: "handles complex type parameters gracefully",
				code: `import React from "react";

export function MyComponent() {
	const [count, setCount] = React.useState<{
		value: number;
		metadata: { timestamp: Date }
	}>;
	return <div>{count.value}</div>;
}`,
				output: `import { useState } from "react";

export function MyComponent() {
	const [count, setCount] = useState<{
		value: number;
		metadata: { timestamp: Date }
	}>;
	return <div>{count.value}</div>;
}`,
				errors: [{ messageId: "destructureReact" }],
				filename: "complex-type-params.tsx"
			},
			{
				name: "handles complex type references gracefully",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC<{ name: string }> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				output: 'import { FC } from "react";\n\nexport const MyComponent: FC<{ name: string }> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "complex-type-refs.tsx"
			},
			{
				name: "handles invalid type parameters",
				code: `import React from "react";

export function MyComponent() {
	const [count, setCount] = React.useState<{
		value: number;
		metadata: { timestamp: Date }
	}>;
	return <div>{count.value}</div>;
}`,
				output: `import { useState } from "react";

export function MyComponent() {
	const [count, setCount] = useState<{
		value: number;
		metadata: { timestamp: Date }
	}>;
	return <div>{count.value}</div>;
}`,
				errors: [{ messageId: "destructureReact" }],
				filename: "invalid-type-params.tsx"
			},
			{
				name: "handles invalid type references",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC<{ name: string }> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				output: 'import { FC } from "react";\n\nexport const MyComponent: FC<{ name: string }> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "invalid-type-refs.tsx"
			},
			{
				name: "handles unused React import with no newlines",
				code: 'import React from "react";export function MyComponent() {return <div>Hello</div>;}',
				output: "export function MyComponent() {return <div>Hello</div>;}",
				errors: [{ messageId: "removeUnusedReact" }],
				filename: "unused-react-import-no-newlines.tsx"
			},
			{
				name: "handles error in type parameters",
				code: 'import React from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = React.useState<>;\n\treturn <div>{count}</div>;\n}',
				output: 'import { useState } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = useState<>;\n\treturn <div>{count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-type-params.tsx"
			},
			{
				name: "handles error in type references",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				output: 'import { FC } from "react";\n\nexport const MyComponent: FC = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-type-refs.tsx"
			},
			{
				name: "handles type parameter node errors",
				code: 'import React from "react";\n\n// @ts-expect-error\nfunction Component() {\n\tconst [state] = React.useState<any>();\n\treturn <div>{state}</div>;\n}',
				output: 'import { useState } from "react";\n\n// @ts-expect-error\nfunction Component() {\n\tconst [state] = useState<any>();\n\treturn <div>{state}</div>;\n}',
				errors: [{ messageId: "destructureReact" }]
			},
			{
				name: "handles type reference node errors",
				code: 'import React from "react";\n\n// @ts-expect-error\nconst Component: React.FC = () => {\n\treturn <div>Hello</div>;\n};',
				output: 'import { FC } from "react";\n\n// @ts-expect-error\nconst Component: FC = () => {\n\treturn <div>Hello</div>;\n};',
				errors: [{ messageId: "destructureReact" }]
			},
			{
				name: "handles error in getTypeParameters",
				code: 'import React from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = React.useState<{ value: number; metadata: { timestamp: Date } }>;\n\treturn <div>{count.value}</div>;\n}',
				output: 'import { useState } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = useState<{ value: number; metadata: { timestamp: Date } }>;\n\treturn <div>{count.value}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-type-params.tsx"
			},
			{
				name: "handles error in getFullTypeReferenceText",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC<{ name: string }> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				output: 'import { FC } from "react";\n\nexport const MyComponent: FC<{ name: string }> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-type-refs.tsx"
			},
			{
				name: "handles error in getTypeParameters with invalid node",
				code: 'import React from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = React.useState<>;\n\treturn <div>{count}</div>;\n}',
				output: 'import { useState } from "react";\n\nexport function MyComponent() {\n\tconst [count, setCount] = useState<>;\n\treturn <div>{count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-type-params-invalid.tsx"
			},
			{
				name: "handles error in getFullTypeReferenceText with invalid node",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC<> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				output: 'import { FC } from "react";\n\nexport const MyComponent: FC<> = ({ name }) => {\n\treturn <div>{name}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-type-refs-invalid.tsx"
			},
			{
				name: "handles multiple errors in type handling",
				code: 'import React from "react";\n\nexport const MyComponent: React.FC<> = ({ name }) => {\n\tconst [count, setCount] = React.useState<>;\n\treturn <div>{name} {count}</div>;\n}',
				output: 'import { FC, useState } from "react";\n\nexport const MyComponent: FC<> = ({ name }) => {\n\tconst [count, setCount] = useState<>;\n\treturn <div>{name} {count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-multiple-type-errors.tsx"
			},
			{
				name: "handles error in getTypeParameters with invalid parent node",
				code: 'import React from "react";\n\nexport function MyComponent() {\n\t// @ts-expect-error - Force error in getTypeParameters\n\tconst [count, setCount] = React.useState<keyof typeof React.useState>;\n\treturn <div>{count}</div>;\n}',
				output: 'import { useState } from "react";\n\nexport function MyComponent() {\n\t// @ts-expect-error - Force error in getTypeParameters\n\tconst [count, setCount] = useState<keyof typeof React.useState>;\n\treturn <div>{count}</div>;\n}',
				errors: [{ messageId: "destructureReact" }],
				filename: "error-type-params-invalid-parent.tsx",
				settings: {
					"eslint-plugin-use-client": {
						throwOnGetText: true
					}
				}
			}
		]
	});
});
