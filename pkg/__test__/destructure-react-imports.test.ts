import { describe } from "vitest";
import { destructureReactImports } from "../src/rules/destructure-react-imports.js";
import { TSTester } from "./utils/tester.js";

describe("[rule] destructure-react-imports", () => {
	const rule = TSTester.create();

	rule.run("destructure-react-imports", destructureReactImports, {
		valid: [
			{
				name: "already destructured React imports",
				code: `
                    import { useState, useEffect } from "react";
                    
                    export function MyComponent() {
                        const [count, setCount] = useState(0);
                        useEffect(() => {
                            console.log(count);
                        }, [count]);
                        return <div>{count}</div>;
                    }
                `,
				filename: "destructured-imports.tsx"
			},
			{
				name: "already destructured React requires",
				code: `
                    const { useState, useEffect } = require("react");
                    
                    module.exports = function MyComponent() {
                        const [count, setCount] = useState(0);
                        useEffect(() => {
                            console.log(count);
                        }, [count]);
                        return <div>{count}</div>;
                    }
                `,
				filename: "destructured-requires.tsx"
			}
		],
		invalid: [
			{
				name: "non-destructured React imports",
				code: `
                    import React from "react";
                    
                    export function MyComponent() {
                        const [count, setCount] = React.useState(0);
                        React.useEffect(() => {
                            console.log(count);
                        }, [count]);
                        return <div>{count}</div>;
                    }
                `,
				output: `
                    import { useEffect, useState } from "react";
                    
                    export function MyComponent() {
                        const [count, setCount] = useState(0);
                        useEffect(() => {
                            console.log(count);
                        }, [count]);
                        return <div>{count}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-imports.tsx"
			},
			{
				name: "non-destructured React requires",
				code: `
                    const React = require("react");
                    
                    module.exports = function MyComponent() {
                        const [count, setCount] = React.useState(0);
                        React.useEffect(() => {
                            console.log(count);
                        }, [count]);
                        return <div>{count}</div>;
                    }
                `,
				output: `
                    const { useEffect, useState } = require("react");
                    
                    module.exports = function MyComponent() {
                        const [count, setCount] = useState(0);
                        useEffect(() => {
                            console.log(count);
                        }, [count]);
                        return <div>{count}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "commonjs-require.tsx"
			},
			{
				name: "unused React import",
				code: `
                    import React from "react";
                    
                    export function MyComponent() {
                        return <div>Hello</div>;
                    }
                `,
				output: `
                    
                    
                    export function MyComponent() {
                        return <div>Hello</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "unused-react-import.tsx"
			},
			{
				name: "unused React require",
				code: `
                    const React = require("react");
                    
                    module.exports = function MyComponent() {
                        return <div>Hello</div>;
                    }
                `,
				output: `
                    
                    
                    module.exports = function MyComponent() {
                        return <div>Hello</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "unused-react-require.tsx"
			},
			{
				name: "non-destructured React imports with type annotations",
				code: `
                    import React from "react";
                    
                    export function MyComponent() {
                        const [count, setCount] = React.useState<number>(0);
                        const ref = React.useRef<HTMLDivElement>(null);
                        React.useEffect<void>(() => {
                            console.log(count);
                        }, [count]);
                        return <div ref={ref}>{count}</div>;
                    }
                `,
				output: `
                    import { useEffect, useRef, useState } from "react";
                    
                    export function MyComponent() {
                        const [count, setCount] = useState<number>(0);
                        const ref = useRef<HTMLDivElement>(null);
                        useEffect<void>(() => {
                            console.log(count);
                        }, [count]);
                        return <div ref={ref}>{count}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-imports-with-types.tsx"
			},
			{
				name: "non-destructured React requires with type annotations",
				code: `
                    const React = require("react");
                    
                    module.exports = function MyComponent() {
                        const [count, setCount] = React.useState<number>(0);
                        const ref = React.useRef<HTMLDivElement>(null);
                        React.useEffect<void>(() => {
                            console.log(count);
                        }, [count]);
                        return <div ref={ref}>{count}</div>;
                    }
                `,
				output: `
                    const { useEffect, useRef, useState } = require("react");
                    
                    module.exports = function MyComponent() {
                        const [count, setCount] = useState<number>(0);
                        const ref = useRef<HTMLDivElement>(null);
                        useEffect<void>(() => {
                            console.log(count);
                        }, [count]);
                        return <div ref={ref}>{count}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-requires-with-types.tsx"
			},
			{
				name: "non-destructured React imports with malformed type annotations",
				code: `
                    import React from "react";
                    
                    export function MyComponent() {
                        const [count, setCount] = React.useState<number>(0);
                        // This should still work even if the type annotation is malformed
                        const ref = React.useRef<HTMLDivElement>(null);
                        React.useEffect<void>(() => {
                            console.log(count);
                        }, [count]);
                        return <div ref={ref}>{count}</div>;
                    }
                `,
				output: `
                    import { useEffect, useRef, useState } from "react";
                    
                    export function MyComponent() {
                        const [count, setCount] = useState<number>(0);
                        // This should still work even if the type annotation is malformed
                        const ref = useRef<HTMLDivElement>(null);
                        useEffect<void>(() => {
                            console.log(count);
                        }, [count]);
                        return <div ref={ref}>{count}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-imports-with-malformed-types.tsx"
			},
			{
				name: "non-destructured React imports with invalid type parameters",
				code: `
                    import React from "react";
                    
                    export function MyComponent() {
                        // This should handle the case where getText throws an error
                        const [count, setCount] = React.useState<{}>(() => {
                            throw new Error("Invalid type parameter");
                        });
                        return <div>{count}</div>;
                    }
                `,
				output: `
                    import { useState } from "react";
                    
                    export function MyComponent() {
                        // This should handle the case where getText throws an error
                        const [count, setCount] = useState<{}>(() => {
                            throw new Error("Invalid type parameter");
                        });
                        return <div>{count}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-imports-with-invalid-types.tsx"
			},
			{
				name: "non-destructured React imports with type parameters that throw on getText",
				code: `
                    import React from "react";
                    
                    export function MyComponent() {
                        // This should handle the case where getText throws an error
                        const [count, setCount] = React.useState<{
                            // Invalid type that will cause getText to throw
                            [Symbol()]: any;
                        }>(0);
                        return <div>{count}</div>;
                    }
                `,
				output: `
                    import { useState } from "react";
                    
                    export function MyComponent() {
                        // This should handle the case where getText throws an error
                        const [count, setCount] = useState<{
                            // Invalid type that will cause getText to throw
                            [Symbol()]: any;
                        }>(0);
                        return <div>{count}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-imports-with-throwing-types.tsx"
			},
			{
				name: "non-destructured React imports with complex type parameters",
				code: `
                    import React from "react";
                    
                    export function MyComponent() {
                        // This should handle various edge cases in type parameters
                        const [state, setState] = React.useState<{
                            a: number;
                            b: string;
                            c: {
                                d: boolean;
                                e: Array<{
                                    f: number;
                                    g: string;
                                }>;
                            };
                        }>({ a: 1, b: "test", c: { d: true, e: [] } });

                        const ref = React.useRef<HTMLDivElement>();
                        
                        React.useEffect<void>(() => {
                            console.log(state);
                        }, [state]);

                        return <div ref={ref}>{state.b}</div>;
                    }
                `,
				output: `
                    import { useEffect, useRef, useState } from "react";
                    
                    export function MyComponent() {
                        // This should handle various edge cases in type parameters
                        const [state, setState] = useState<{
                            a: number;
                            b: string;
                            c: {
                                d: boolean;
                                e: Array<{
                                    f: number;
                                    g: string;
                                }>;
                            };
                        }>({ a: 1, b: "test", c: { d: true, e: [] } });

                        const ref = useRef<HTMLDivElement>();
                        
                        useEffect<void>(() => {
                            console.log(state);
                        }, [state]);

                        return <div ref={ref}>{state.b}</div>;
                    }
                `,
				errors: [{ messageId: "destructureReact" }],
				filename: "non-destructured-imports-with-complex-types.tsx"
			}
		]
	});
});
