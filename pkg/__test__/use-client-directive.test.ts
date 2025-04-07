// tests/rules/use-client-directive.test.ts
import { join, resolve } from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { describe, it, expect, vi } from "vitest";
import {
	isModuleAllowlisted,
	isExportAllowlisted,
	isKnownClientOnlyPackage,
	checkForClientAPIs,
	enforceRule,
	_checkNodeForClientAPIs,
	_checkDynamicImport,
	_resolveModulePath,
	_isNodeModule,
	_analyzeModuleForClientDependencies,
	_createVisitors,
	checkImport
} from "../src/rules/use-client-directive.js";
import type { TSESTree } from "@typescript-eslint/utils";

const ruleTester = new RuleTester({
	languageOptions: {
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts*"]
			},
			ecmaFeatures: {
				jsx: true
			},
			tsconfigRootDir: resolve(import.meta.dirname, "..")
		}
	}
});

describe("use-client-directive rule", () => {
	const testDir = "/virtual";

	// Group tests by functionality
	describe("core functionality", () => {
		describe("server components", () => {
			it("should allow server components with server-safe hooks", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								import React from 'react';
								import { useId } from 'react';
								
								export function ServerComponent() {
									const id = useId();
									return <div id={id}>Server</div>;
								}
							`,
							filename: join(testDir, "valid-server.tsx")
						}
					],
					invalid: []
				});
			});

			it("should test server component file", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								import React from 'react';
								export function ServerComponent() {
									return <div>Server</div>;
								}
							`,
							filename: join(testDir, "server-component.tsx")
						}
					],
					invalid: []
				});
			});

			it("should allow server components with allowlisted imports", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								import React from 'react';
								import { useRouter } from 'next/router';
								
								export function ServerWithRouter() {
									const router = useRouter();
									return <div>Current path: {router.pathname}</div>;
								}
							`,
							filename: join(testDir, "server-with-router.tsx"),
							options: [
								{
									allowlist: { "next/router": true },
									traceDepth: 1,
									traceDependencies: true
								}
							]
						}
					],
					invalid: []
				});
			});
		});

		describe("client components", () => {
			it("should require 'use client' directive for components with client hooks", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								'use client';
								import React, { useState } from 'react';
								export function ClientComponent() {
									const [state] = useState(0);
									return <div>{state}</div>;
								}
							`,
							filename: join(testDir, "client-component.tsx")
						}
					],
					invalid: [
						{
							code: `
								import React, { useState } from 'react';
								
								export function MissingDirective() {
									const [state, setState] = useState(0);
									return <div>{state}</div>;
								}
							`,
							filename: join(testDir, "missing-directive.tsx"),
							errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
						}
					]
				});
			});

			it("should require 'use client' directive for components using browser APIs", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								'use client';
								import React from 'react';
								
								export function WindowUser() {
									const width = window.innerWidth;
									return <div>Width: {width}</div>;
								}
							`,
							filename: join(testDir, "window-user.tsx")
						}
					],
					invalid: [
						{
							code: `
								import React from 'react';
								
								export function WindowUser() {
									const width = window.innerWidth;
									return <div>Width: {width}</div>;
								}
							`,
							filename: join(testDir, "window-missing-directive.tsx"),
							errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
						}
					]
				});
			});

			it("should detect indirect client dependencies", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								'use client';
								import React from 'react';
								import { ClientComponent } from './client-component';
								
								export function IndirectClient() {
									return <ClientComponent />;
								}
							`,
							filename: join(testDir, "valid-indirect.tsx")
						}
					],
					invalid: [
						{
							code: `
								import React from 'react';
								import { ClientComponent } from './client-component';
								export function IndirectClientComponent() {
									return <ClientComponent />;
								}
							`,
							filename: join(testDir, "indirect-client.tsx"),
							errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
						}
					]
				});
			});

			it("should require 'use client' directive for components with JSX event handlers", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								'use client';
								import React from 'react';
								
								export function ButtonWithHandler() {
									const handleClick = () => {
										console.log('Clicked');
									};
									return <button onClick={handleClick}>Click me</button>;
								}
							`,
							filename: join(testDir, "valid-event-handler.tsx")
						}
					],
					invalid: [
						{
							code: `
								import React from 'react';
								
								export function ButtonWithHandler() {
									const handleClick = () => {
										console.log('Clicked');
									};
									return <button onClick={handleClick}>Click me</button>;
								}
							`,
							filename: join(testDir, "missing-directive-event-handler.tsx"),
							errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
						}
					]
				});
			});

			it("should require 'use client' directive for components with client detection conditions", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								'use client';
								import React from 'react';
								
								export function ClientDetector() {
									if (typeof window !== 'undefined') {
										// Client-side code
										console.log('Running on client');
									}
									return <div>Client detector</div>;
								}
							`,
							filename: join(testDir, "valid-client-detector.tsx")
						}
					],
					invalid: [
						{
							code: `
								import React from 'react';
								
								export function ClientDetector() {
									if (typeof window !== 'undefined') {
										// Client-side code
										console.log('Running on client');
									}
									return <div>Client detector</div>;
								}
							`,
							filename: join(testDir, "missing-directive-client-detector.tsx"),
							errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
						},
						{
							code: `
								import React from 'react';
								
								export function ClientDetectorAlt() {
									if ('undefined' !== typeof window) {
										// Client-side code with alternate syntax
										console.log('Running on client');
									}
									return <div>Client detector alt</div>;
								}
							`,
							filename: join(testDir, "missing-directive-client-detector-alt.tsx"),
							errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
						}
					]
				});
			});

			it("should require 'use client' directive for components with dynamic imports of client modules", () => {
				ruleTester.run("use-client-directive", enforceRule, {
					valid: [
						{
							code: `
								'use client';
								import React from 'react';
								
								export function DynamicImporter() {
									const loadClientModule = () => import('react-dom');
									const handleClick = () => {
										loadClientModule().then(module => {
											console.log(module);
										});
									};
									return <button onClick={handleClick}>Load client module</button>;
								}
							`,
							filename: join(testDir, "valid-dynamic-import.tsx")
						}
					],
					invalid: [
						{
							code: `
								import React from 'react';
								
								export function DynamicImporter() {
									const loadClientModule = () => import('react-dom');
									const handleClick = () => {
										loadClientModule().then(module => {
											console.log(module);
										});
									};
									return <button onClick={handleClick}>Load client module</button>;
								}
							`,
							filename: join(testDir, "missing-directive-dynamic-import.tsx"),
							errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
						}
					]
				});
			});
		});
	});

	describe("configuration options", () => {
		it("supports custom module allowlists", () => {
			ruleTester.run("custom allowlist", enforceRule, {
				valid: [
					{
						code: `
							import React from 'react';
							import { ClientComponent } from 'custom-client-lib';
							
							export function Component() {
								return <ClientComponent />;
							}
						`,
						filename: join(testDir, "custom-allowlist.tsx"),
						options: [
							{
								allowlist: { "custom-client-lib": true },
								traceDepth: 1,
								traceDependencies: true
							}
						]
					}
				],
				invalid: []
			});
		});

		it("supports traceDepth configuration", () => {
			ruleTester.run("trace depth", enforceRule, {
				valid: [],
				invalid: [
					{
						code: `
							import React from 'react';
							import { useState } from 'react';
							
							function useDeepHook() {
								const [state] = useState(0);
								return state;
							}
							
							function useDeeperHook() {
								return useDeepHook();
							}
							
							export function Component() {
								const value = useDeeperHook();
								return <div>{value}</div>;
							}
						`,
						filename: join(testDir, "deep-deps.tsx"),
						options: [
							{
								allowlist: {},
								traceDepth: 3,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});

		it("supports partial allowlists with specific exports", () => {
			ruleTester.run("partial allowlist", enforceRule, {
				valid: [
					{
						code: `
							import React from 'react';
							import { useCallback } from 'react';
							import { allowlistedHook } from 'custom-hooks';
							
							export function Component() {
								const callback = useCallback(() => {}, []);
								const value = allowlistedHook();
								return <div>{value}</div>;
							}
						`,
						filename: join(testDir, "partial-allowlist.tsx"),
						options: [
							{
								allowlist: {
									react: ["useCallback", "useId", "useMemo"],
									"custom-hooks": ["allowlistedHook"]
								},
								traceDepth: 1,
								traceDependencies: true
							}
						]
					}
				],
				invalid: [
					{
						code: `
							import React from 'react';
							import { useCallback, useState } from 'react';
							import { allowlistedHook } from 'custom-hooks';
							
							export function Component() {
								const callback = useCallback(() => {}, []);
								const [state] = useState(0); // Not allowlisted
								const value = allowlistedHook();
								return <div>{state}: {value}</div>;
							}
						`,
						filename: join(testDir, "partial-allowlist-invalid.tsx"),
						options: [
							{
								allowlist: {
									react: ["useCallback", "useId", "useMemo"],
									"custom-hooks": ["allowlistedHook"]
								},
								traceDepth: 1,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});

		it("detects shared components with client dependencies", () => {
			ruleTester.run("shared components", enforceRule, {
				valid: [],
				invalid: [
					{
						code: `
							import React from 'react';
							import { clientModule } from './client-dependency';
							
							export function SharedComponent() {
								// No direct client APIs but imports a client module
								return <div>Shared component using {clientModule}</div>;
							}
						`,
						filename: join(testDir, "shared-component.tsx"),
						errors: [
							{ messageId: "missingUseClient" },
							{ messageId: "detectedClientDep" },
							{ messageId: "sharedComponent" }
						]
					}
				]
			});
		});
	});

	describe("autofix functionality", () => {
		it("should add the 'use client' directive with autofix", () => {
			ruleTester.run("autofix", enforceRule, {
				valid: [],
				invalid: [
					{
						code: `
import React, { useState } from 'react';

export function MissingDirectiveWithFix() {
	const [state, setState] = useState(0);
	return <div>{state}</div>;
}
						`,
						output: `
'use client';

import React, { useState } from 'react';

export function MissingDirectiveWithFix() {
	const [state, setState] = useState(0);
	return <div>{state}</div>;
}
						`,
						filename: join(testDir, "missing-directive-with-fix.tsx"),
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});
	});

	// Unit tests for individual helper functions
	describe("helper functions", () => {
		it("correctly identifies client-only packages", () => {
			expect(isKnownClientOnlyPackage("react-dom")).toBe(true);
			expect(isKnownClientOnlyPackage("@headlessui/react")).toBe(true);
			expect(isKnownClientOnlyPackage("next/router")).toBe(false);
		});

		it("correctly determines if imports are allowlisted", () => {
			const testAllowlist = {
				"next/navigation": true,
				react: ["useState", "useEffect"]
			};

			expect(isModuleAllowlisted("next/navigation", testAllowlist)).toBe(true);
			expect(isModuleAllowlisted("unknown-module", testAllowlist)).toBe(false);
			expect(isExportAllowlisted("useRouter", "next/navigation", testAllowlist)).toBe(true);
			expect(isExportAllowlisted("useState", "react", testAllowlist)).toBe(true);
			expect(isExportAllowlisted("useCallback", "react", testAllowlist)).toBe(false);
		});

		it("correctly detects client APIs in AST nodes", () => {
			const callExprNode = {
				type: AST_NODE_TYPES.CallExpression,
				callee: {
					type: AST_NODE_TYPES.Identifier,
					name: "useState",
					loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 8 } },
					range: [0, 8]
				},
				arguments: [],
				optional: false,
				typeArguments: null,
				parent: null as unknown as TSESTree.Node,
				loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
				range: [0, 10]
			} as unknown as TSESTree.CallExpression;

			const result = checkForClientAPIs(callExprNode);
			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("React hook: useState");
		});
	});

	// Tests for rule.create functionality
	describe("enforceRule.create function", () => {
		it("should handle missing type information gracefully", () => {
			// Create a minimal mock context without parser services
			const mockContext = {
				sourceCode: {
					ast: {
						type: AST_NODE_TYPES.Program,
						body: [],
						comments: [],
						tokens: [],
						sourceType: "module",
						range: [0, 0],
						loc: {
							start: { line: 1, column: 0 },
							end: { line: 1, column: 0 }
						}
					} as TSESTree.Program,
					parserServices: undefined
				},
				filename: "test-file.tsx",
				report: vi.fn(),
				options: [
					{
						allowlist: {},
						traceDepth: 1,
						traceDependencies: true
					}
				]
			};

			// Call the create function with casting
			// @ts-expect-error - using mock context
			const result = enforceRule.create(mockContext);

			// Should return empty object for context without type info
			expect(Object.keys(result)).toHaveLength(0);

			// Verify report was called
			expect(mockContext.report).toHaveBeenCalled();
		});

		it("should create visitor functions with valid context", () => {
			// Create mock context with parser services
			const mockContext = {
				sourceCode: {
					ast: {
						type: AST_NODE_TYPES.Program,
						body: [],
						comments: [],
						tokens: [],
						sourceType: "module",
						range: [0, 0],
						loc: {
							start: { line: 1, column: 0 },
							end: { line: 1, column: 0 }
						}
					} as TSESTree.Program,
					parserServices: {
						program: {
							getTypeChecker: vi.fn().mockReturnValue({
								getSymbolAtLocation: vi.fn().mockReturnValue({
									flags: 1 // Numeric value for SymbolFlags.Value
								})
							})
						},
						esTreeNodeToTSNodeMap: new Map()
					},
					getAllComments: vi.fn().mockReturnValue([])
				},
				filename: "test-file.tsx",
				report: vi.fn(),
				options: [
					{
						allowlist: {},
						traceDepth: 1,
						traceDependencies: true
					}
				]
			};

			// Call the create function with casting
			// @ts-expect-error - using mock context
			const visitors = enforceRule.create(mockContext);

			// Should return visitor functions
			expect(typeof visitors.Program).toBe("function");
			expect(typeof visitors.CallExpression).toBe("function");
			expect(typeof visitors.ImportDeclaration).toBe("function");
			expect(typeof visitors["Program:exit"]).toBe("function");
		});
	});

	// Keep these tests at the end to maintain compatibility with existing tests
	describe("helper functions (additional)", () => {
		it("detects browser APIs in nodes", () => {
			// Test window reference
			const windowNode = {
				type: AST_NODE_TYPES.Identifier,
				name: "window",
				loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 6 } },
				range: [0, 6]
			} as TSESTree.Identifier;

			const windowResult = checkForClientAPIs(windowNode);
			expect(windowResult.isClient).toBe(true);
			expect(windowResult.dependency).toContain("Browser API: window");

			// Test document reference
			const documentNode = {
				type: AST_NODE_TYPES.Identifier,
				name: "document",
				loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 8 } },
				range: [0, 8]
			} as TSESTree.Identifier;

			const documentResult = checkForClientAPIs(documentNode);
			expect(documentResult.isClient).toBe(true);
			expect(documentResult.dependency).toContain("Browser API: document");
		});

		it("detects browser API property access", () => {
			// Test window.location
			const windowPropertyNode = {
				type: AST_NODE_TYPES.MemberExpression,
				object: {
					type: AST_NODE_TYPES.Identifier,
					name: "window",
					loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 6 } },
					range: [0, 6]
				},
				property: {
					type: AST_NODE_TYPES.Identifier,
					name: "location",
					loc: { start: { line: 1, column: 7 }, end: { line: 1, column: 15 } },
					range: [7, 15]
				},
				computed: false,
				optional: false,
				loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 15 } },
				range: [0, 15]
			} as unknown as TSESTree.MemberExpression;

			const result = checkForClientAPIs(windowPropertyNode);
			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("Browser API: window.location");
		});

		it("detects client detection conditions", () => {
			// Test typeof window !== 'undefined'
			const clientConditionNode = {
				type: AST_NODE_TYPES.IfStatement,
				test: {
					type: AST_NODE_TYPES.BinaryExpression,
					operator: "!==",
					left: {
						type: AST_NODE_TYPES.UnaryExpression,
						operator: "typeof",
						prefix: true,
						argument: {
							type: AST_NODE_TYPES.Identifier,
							name: "window"
						}
					},
					right: {
						type: AST_NODE_TYPES.Literal,
						value: "undefined",
						raw: "'undefined'"
					}
				},
				consequent: {
					type: AST_NODE_TYPES.BlockStatement,
					body: []
				},
				alternate: null
			} as unknown as TSESTree.IfStatement;

			const result = checkForClientAPIs(clientConditionNode);
			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("Client detection condition");
		});

		it("detects JSX event handlers", () => {
			// Test onClick JSX attribute
			const jsxAttributeNode = {
				type: AST_NODE_TYPES.JSXAttribute,
				name: {
					type: AST_NODE_TYPES.JSXIdentifier,
					name: "onClick"
				},
				value: {
					type: AST_NODE_TYPES.JSXExpressionContainer,
					expression: {
						type: AST_NODE_TYPES.Identifier,
						name: "handleClick"
					}
				}
			} as unknown as TSESTree.JSXAttribute;

			const result = checkForClientAPIs(jsxAttributeNode);
			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("JSX event handler: onClick");
		});
	});

	// Add these tests after the "module resolution" section to test more edge cases and visitor patterns
	describe("visitor pattern implementation", () => {
		it("should handle Program node visitor correctly", () => {
			// Create a mock for the _createVisitors function
			const mockVisitors = _createVisitors(null, {
				allowlist: { "allowed-module": true },
				traceDepth: 1,
				traceDependencies: true
			});

			// Simulate a Program node visit (setup phase)
			const mockProgram = {
				type: AST_NODE_TYPES.Program,
				body: [],
				sourceType: "module",
				comments: [{ type: "Line", value: " use client" }]
			} as unknown as TSESTree.Program;

			// Call the Program visitor (which should exist)
			expect(mockVisitors.Program).toBeDefined();
			mockVisitors.Program(mockProgram);

			// The test passes if the Program visitor doesn't throw
		});

		it("should handle ExpressionStatement visitor for document access", () => {
			const mockVisitors = _createVisitors(null, {
				allowlist: {},
				traceDepth: 1,
				traceDependencies: true
			});

			// Create a mock document expression
			const mockExprStatement = {
				type: AST_NODE_TYPES.ExpressionStatement,
				expression: {
					type: AST_NODE_TYPES.MemberExpression,
					object: {
						type: AST_NODE_TYPES.Identifier,
						name: "document"
					},
					property: {
						type: AST_NODE_TYPES.Identifier,
						name: "getElementById"
					},
					computed: false
				}
			} as unknown as TSESTree.ExpressionStatement;

			// Verify we can access the ExpressionStatement visitor
			expect(mockVisitors.ExpressionStatement).toBeDefined();

			// Call the visitor
			mockVisitors.ExpressionStatement(mockExprStatement);
		});

		it("should handle various ExpressionStatement types", () => {
			const mockVisitors = _createVisitors(null, {
				allowlist: {},
				traceDepth: 1,
				traceDependencies: true
			});

			// Non-document expression
			const nonDocExpr = {
				type: AST_NODE_TYPES.ExpressionStatement,
				expression: {
					type: AST_NODE_TYPES.MemberExpression,
					object: {
						type: AST_NODE_TYPES.Identifier,
						name: "console"
					},
					property: {
						type: AST_NODE_TYPES.Identifier,
						name: "log"
					},
					computed: false
				}
			} as unknown as TSESTree.ExpressionStatement;

			// Call visitor with non-document expression
			mockVisitors.ExpressionStatement(nonDocExpr);

			// Test with non-member expression
			const nonMemberExpr = {
				type: AST_NODE_TYPES.ExpressionStatement,
				expression: {
					type: AST_NODE_TYPES.CallExpression,
					callee: {
						type: AST_NODE_TYPES.Identifier,
						name: "console"
					},
					arguments: []
				}
			} as unknown as TSESTree.ExpressionStatement;

			mockVisitors.ExpressionStatement(nonMemberExpr);
		});

		it("should handle JSX event handlers using checkForClientAPIs", () => {
			// JSX attribute with event handler
			const jsxAttribute = {
				type: AST_NODE_TYPES.JSXAttribute,
				name: {
					type: AST_NODE_TYPES.JSXIdentifier,
					name: "onClick"
				},
				value: {
					type: AST_NODE_TYPES.JSXExpressionContainer,
					expression: {
						type: AST_NODE_TYPES.Identifier,
						name: "handleClick"
					}
				}
			} as unknown as TSESTree.JSXAttribute;

			// Call the helper function directly
			const result = checkForClientAPIs(jsxAttribute);
			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("JSX event handler");
		});

		it("should handle ImportExpression (dynamic import) visitor", () => {
			const mockVisitors = _createVisitors(null, {
				allowlist: { "allowed-module": true },
				traceDepth: 1,
				traceDependencies: true
			});

			// Dynamic import of client package
			const clientImport = {
				type: AST_NODE_TYPES.ImportExpression,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "react-dom"
				}
			} as unknown as TSESTree.ImportExpression;

			// Verify visitor exists
			expect(mockVisitors.ImportExpression).toBeDefined();

			// Call visitor with client import
			mockVisitors.ImportExpression(clientImport);

			// Dynamic import of allowed module
			const allowedImport = {
				type: AST_NODE_TYPES.ImportExpression,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "allowed-module"
				}
			} as unknown as TSESTree.ImportExpression;

			mockVisitors.ImportExpression(allowedImport);

			// Dynamic import with non-literal source
			const nonLiteralImport = {
				type: AST_NODE_TYPES.ImportExpression,
				source: {
					type: AST_NODE_TYPES.Identifier,
					name: "modulePath"
				}
			} as unknown as TSESTree.ImportExpression;

			mockVisitors.ImportExpression(nonLiteralImport);
		});
	});

	describe("error handling and edge cases", () => {
		it("should handle dynamic import analysis failures", () => {
			// Test _checkDynamicImport with various edge cases

			// Non-import expressions
			const notImport = {
				type: AST_NODE_TYPES.CallExpression
			} as unknown as TSESTree.Node;

			const result1 = _checkDynamicImport(notImport);
			expect(result1.isClient).toBe(false);

			// Import with non-string literal
			const nonStringImport = {
				type: AST_NODE_TYPES.ImportExpression,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: 123
				}
			} as unknown as TSESTree.ImportExpression;

			const result2 = _checkDynamicImport(nonStringImport);
			expect(result2.isClient).toBe(false);

			// Import with non-literal source
			const nonLiteralSource = {
				type: AST_NODE_TYPES.ImportExpression,
				source: {
					type: AST_NODE_TYPES.Identifier,
					name: "dynamicPath"
				}
			} as unknown as TSESTree.ImportExpression;

			const result3 = _checkDynamicImport(nonLiteralSource);
			expect(result3.isClient).toBe(false);
		});
	});

	describe("comprehensive option permutations", () => {
		it("should respect allowlist configurations with different formats", () => {
			ruleTester.run("use-client-directive-allowlist-formats", enforceRule, {
				valid: [
					// Full module allowlisting
					{
						name: "full module allowlisting",
						code: `
							import React from 'react';
							import { useState } from 'react'; // Would normally require 'use client'
							
							export function Component() {
								const [count, setCount] = useState(0);
								return <div>{count}</div>;
							}
						`,
						filename: join(testDir, "allowlist-full-module.tsx"),
						options: [
							{
								allowlist: { react: true },
								traceDepth: 1,
								traceDependencies: true
							}
						]
					},
					// Specific exports allowlisting
					{
						name: "specific exports allowlisting",
						code: `
							import React from 'react';
							import { useState } from 'react'; // Specifically allowlisted
							
							export function Component() {
								const [count, setCount] = useState(0);
								return <div>{count}</div>;
							}
						`,
						filename: join(testDir, "allowlist-specific-exports.tsx"),
						options: [
							{
								allowlist: { react: ["useState"] },
								traceDepth: 1,
								traceDependencies: true
							}
						]
					},
					// Mixed allowlist types
					{
						name: "mixed allowlist types",
						code: `
							import React from 'react';
							import { useState } from 'react'; // Specifically allowlisted
							import { ClientComponent } from 'custom-module'; // Full module allowlisted
							
							export function Component() {
								const [count, setCount] = useState(0);
								return <div><ClientComponent count={count} /></div>;
							}
						`,
						filename: join(testDir, "allowlist-mixed-types.tsx"),
						options: [
							{
								allowlist: {
									react: ["useState", "useRef", "useCallback"],
									"custom-module": true
								},
								traceDepth: 1,
								traceDependencies: true
							}
						]
					},
					// Escape hatch with * allowlisting
					{
						name: "wildcard allowlisting",
						code: `
							import React from 'react';
							import { useState, useEffect, useLayoutEffect } from 'react';
							
							export function Component() {
								const [count, setCount] = useState(0);
								useEffect(() => {
									console.log('mounted');
								}, []);
								return <div>{count}</div>;
							}
						`,
						filename: join(testDir, "allowlist-wildcard.tsx"),
						options: [
							{
								allowlist: { react: ["*"] },
								traceDepth: 1,
								traceDependencies: true
							}
						]
					}
				],
				invalid: [
					// Non-allowlisted export from partially allowlisted module
					{
						name: "non-allowlisted export",
						code: `
							import React from 'react';
							import { useState, useEffect } from 'react'; // useEffect not allowlisted
							
							export function Component() {
								const [count, setCount] = useState(0);
								useEffect(() => {
									console.log('mounted');
								}, []);
								return <div>{count}</div>;
							}
						`,
						filename: join(testDir, "non-allowlisted-export.tsx"),
						options: [
							{
								allowlist: { react: ["useState"] },
								traceDepth: 1,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					},
					// Module not in allowlist
					{
						name: "module not in allowlist",
						code: `
							import React from 'react';
							import { useRouter } from 'next/navigation';
							
							export function Component() {
								const router = useRouter();
								return <div>Current: {router.pathname}</div>;
							}
						`,
						filename: join(testDir, "module-not-in-allowlist.tsx"),
						options: [
							{
								allowlist: { react: true },
								traceDepth: 1,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});

		it("should respect traceDepth option correctly", () => {
			ruleTester.run("use-client-directive-trace-depth", enforceRule, {
				valid: [
					// No trace with traceDepth: 0
					{
						name: "no trace with depth 0",
						code: `
							import React from 'react';
							import { useClientHook } from './client-module';
							
							export function Component() {
								// useClientHook would be detected with traceDepth > 0
								return <div>No trace</div>;
							}
						`,
						filename: join(testDir, "trace-depth-zero.tsx"),
						options: [
							{
								allowlist: {},
								traceDepth: 0,
								traceDependencies: false
							}
						]
					},
					// Shallow trace with traceDepth: 1 (default)
					{
						name: "shallow trace with allowlisted module",
						code: `
							import React from 'react';
							import { useClientHook } from 'allowlisted-module';
							
							export function Component() {
								useClientHook();
								return <div>Shallow trace</div>;
							}
						`,
						filename: join(testDir, "trace-depth-one-allowlisted.tsx"),
						options: [
							{
								allowlist: { "allowlisted-module": true },
								traceDepth: 1,
								traceDependencies: true
							}
						]
					}
				],
				invalid: [
					// Deep trace with traceDepth: 3
					{
						name: "deep trace",
						code: `
							import React from 'react';
							import { useDeepHook } from './deep-module';
							
							// Assume useDeepHook imports useAnotherHook which imports useState
							export function Component() {
								useDeepHook();
								return <div>Deep trace</div>;
							}
						`,
						filename: join(testDir, "trace-depth-three.tsx"),
						options: [
							{
								allowlist: {},
								traceDepth: 3,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					},
					// Maximum trace with high value
					{
						name: "maximum trace",
						code: `
							import React from 'react';
							import { useVeryDeepHook } from './very-deep-module';
							
							// Assume this has very deep nesting, but still trackable
							export function Component() {
								useVeryDeepHook();
								return <div>Max trace</div>;
							}
						`,
						filename: join(testDir, "trace-depth-max.tsx"),
						options: [
							{
								allowlist: {},
								traceDepth: 10,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});

		it("should respect traceDependencies option correctly", () => {
			ruleTester.run("use-client-directive-trace-dependencies", enforceRule, {
				valid: [
					// No dependency tracing
					{
						name: "no dependency tracing",
						code: `
							import React from 'react';
							import { ClientComponent } from './client-component';
							
							export function Component() {
								// With traceDependencies: false, won't recognize client dependency
								return <div><ClientComponent /></div>;
							}
						`,
						filename: join(testDir, "no-dependency-tracing.tsx"),
						options: [
							{
								allowlist: {},
								traceDepth: 1,
								traceDependencies: false
							}
						]
					}
				],
				invalid: [
					// With dependency tracing enabled
					{
						name: "with dependency tracing",
						code: `
							import React from 'react';
							import { ClientComponent } from './client-component';
							
							export function Component() {
								// With traceDependencies: true, will recognize client dependency
								return <div><ClientComponent /></div>;
							}
						`,
						filename: join(testDir, "with-dependency-tracing.tsx"),
						options: [
							{
								allowlist: {},
								traceDepth: 1,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});

		it("should handle combined option permutations", () => {
			ruleTester.run("use-client-directive-combined-options", enforceRule, {
				valid: [
					// High trace depth + allowlisted module
					{
						name: "high trace depth with allowlist",
						code: `
							import React from 'react';
							import { useNestedHook } from 'allowlisted-module';
							
							export function Component() {
								useNestedHook(); // Would cause error without allowlist
								return <div>High trace with allowlist</div>;
							}
						`,
						filename: join(testDir, "high-trace-allowlisted.tsx"),
						options: [
							{
								allowlist: { "allowlisted-module": true },
								traceDepth: 5,
								traceDependencies: true
							}
						]
					},
					// No trace + specific export allowlist
					{
						name: "no trace with specific export allowlist",
						code: `
							import React from 'react';
							import { useState, useCallback } from 'react';
							
							export function Component() {
								const [count, setCount] = useState(0);
								const increment = useCallback(() => setCount(c => c + 1), []);
								return <div onClick={increment}>{count}</div>;
							}
						`,
						filename: join(testDir, "no-trace-specific-exports.tsx"),
						options: [
							{
								allowlist: {
									react: ["useState", "useCallback"]
								},
								traceDepth: 0,
								traceDependencies: false
							}
						]
					}
				],
				invalid: [
					// Partial allowlist + high trace depth
					{
						name: "partial allowlist with high trace",
						code: `
							import React from 'react';
							import { useState, useEffect } from 'react';
							
							export function Component() {
								const [count, setCount] = useState(0); // allowlisted
								useEffect(() => { // not allowlisted
									document.title = \`Count: \${count}\`;
								}, [count]);
								return <div>{count}</div>;
							}
						`,
						filename: join(testDir, "partial-allowlist-high-trace.tsx"),
						options: [
							{
								allowlist: { react: ["useState"] },
								traceDepth: 5,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});

		it("should check file extensions correctly", () => {
			ruleTester.run("use-client-directive-file-extensions", enforceRule, {
				valid: [
					// JS file with client code (testing filename handling internally)
					{
						name: "js file",
						code: `
							import React from 'react';
							import { useState } from 'react';
							
							export function Component() {
								const [count, setCount] = useState(0);
								return React.createElement('div', null, count);
							}
						`,
						filename: join(testDir, "component.js"),
						options: [
							{
								allowlist: {},
								traceDepth: 1,
								traceDependencies: true
							}
						]
					}
				],
				invalid: [
					// JSX file requiring use client directive
					{
						name: "jsx file",
						code: `
							import React from 'react';
							import { useState } from 'react';
							
							export function Component() {
								const [count, setCount] = useState(0);
								return <div>{count}</div>;
							}
						`,
						filename: join(testDir, "component.jsx"),
						options: [
							{
								allowlist: {},
								traceDepth: 1,
								traceDependencies: true
							}
						],
						errors: [{ messageId: "missingUseClient" }, { messageId: "detectedClientDep" }]
					}
				]
			});
		});
	});

	describe("advanced module resolution", () => {
		it("detects node modules correctly with _isNodeModule", () => {
			// Test node_modules paths
			expect(_isNodeModule("node_modules/react")).toBe(true);
			expect(_isNodeModule("/usr/local/node_modules/react")).toBe(true);
			expect(_isNodeModule("./project/node_modules/package")).toBe(true);

			// Test non-node_modules paths
			expect(_isNodeModule("./src/components")).toBe(false);
			expect(_isNodeModule("/absolute/path/to/file")).toBe(false);
			expect(_isNodeModule("relative/path")).toBe(false);
		});

		it("resolves module paths correctly with _resolveModulePath", () => {
			// Test relative paths
			expect(_resolveModulePath("./relative-module", "/test/file.ts")).toBe("resolved-./relative-module");

			// Test absolute paths
			expect(_resolveModulePath("/absolute/path", "/test/file.ts")).toBe("/absolute/path");

			// Test node modules
			expect(_resolveModulePath("react", "/test/file.ts")).toBe("node_modules/react");

			// Mock implementation should handle these cases as defined in the function
		});
	});

	describe("visitor pattern implementation (advanced)", () => {
		it("handles ImportDeclaration visitor for client packages", () => {
			// Create mock visitors with client modules
			const mockVisitors = _createVisitors(null, {
				allowlist: {},
				traceDepth: 1,
				traceDependencies: true,
				moduleCategories: {
					clientModules: ["react-dom", "custom-client-package"]
				}
			});

			// Test ImportDeclaration with client package
			const clientImport = {
				type: AST_NODE_TYPES.ImportDeclaration,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "react-dom"
				},
				specifiers: []
			} as unknown as TSESTree.ImportDeclaration;

			expect(mockVisitors.ImportDeclaration).toBeDefined();
			mockVisitors.ImportDeclaration(clientImport);

			// Test with allowlisted module
			const allowlistedVisitors = _createVisitors(null, {
				allowlist: { "allowed-module": true },
				traceDepth: 1,
				traceDependencies: true
			});

			const allowlistedImport = {
				type: AST_NODE_TYPES.ImportDeclaration,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "allowed-module"
				},
				specifiers: []
			} as unknown as TSESTree.ImportDeclaration;

			allowlistedVisitors.ImportDeclaration(allowlistedImport);
		});

		it("handles VariableDeclarator visitor for window access", () => {
			const mockVisitors = _createVisitors(null, {
				allowlist: {},
				traceDepth: 1,
				traceDependencies: true
			});

			// Test VariableDeclarator with window access
			const windowAccess = {
				type: AST_NODE_TYPES.VariableDeclarator,
				id: {
					type: AST_NODE_TYPES.Identifier,
					name: "width"
				},
				init: {
					type: AST_NODE_TYPES.MemberExpression,
					object: {
						type: AST_NODE_TYPES.Identifier,
						name: "window"
					},
					property: {
						type: AST_NODE_TYPES.Identifier,
						name: "innerWidth"
					},
					computed: false
				}
			} as unknown as TSESTree.VariableDeclarator;

			expect(mockVisitors.VariableDeclarator).toBeDefined();
			mockVisitors.VariableDeclarator(windowAccess);

			// Test with non-window access
			const nonWindowAccess = {
				type: AST_NODE_TYPES.VariableDeclarator,
				id: {
					type: AST_NODE_TYPES.Identifier,
					name: "data"
				},
				init: {
					type: AST_NODE_TYPES.ObjectExpression,
					properties: []
				}
			} as unknown as TSESTree.VariableDeclarator;

			mockVisitors.VariableDeclarator(nonWindowAccess);

			// Test with null init
			const nullInit = {
				type: AST_NODE_TYPES.VariableDeclarator,
				id: {
					type: AST_NODE_TYPES.Identifier,
					name: "data"
				},
				init: null
			} as unknown as TSESTree.VariableDeclarator;

			mockVisitors.VariableDeclarator(nullInit);
		});

		it("handles export declarations to track exports", () => {
			const mockVisitors = _createVisitors(null, {
				allowlist: {},
				traceDepth: 1,
				traceDependencies: true
			});

			// Test ExportNamedDeclaration
			const _namedExport = {
				type: AST_NODE_TYPES.ExportNamedDeclaration
			} as unknown as TSESTree.ExportNamedDeclaration;

			expect(mockVisitors.ExportNamedDeclaration).toBeDefined();
			// The implementation takes no arguments as it only sets a flag
			mockVisitors.ExportNamedDeclaration(_namedExport);

			// Test ExportDefaultDeclaration
			const _defaultExport = {
				type: AST_NODE_TYPES.ExportDefaultDeclaration
			} as unknown as TSESTree.ExportDefaultDeclaration;

			expect(mockVisitors.ExportDefaultDeclaration).toBeDefined();
			// The implementation takes no arguments as it only sets a flag
			mockVisitors.ExportDefaultDeclaration(_defaultExport);
		});
	});

	describe("hook detection and testing utilities", () => {
		// Test for React hook detection
		it("detects React hooks correctly", () => {
			// Test with a hook call
			const hookNode = {
				type: AST_NODE_TYPES.CallExpression,
				callee: {
					type: AST_NODE_TYPES.Identifier,
					name: "useState"
				}
			} as unknown as TSESTree.CallExpression;

			const result = checkForClientAPIs(hookNode);
			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("useState");
		});

		it("analyzes modules for client dependencies recursively", () => {
			// Test with a module path containing 'client'
			const clientResult = _analyzeModuleForClientDependencies("src/components/client-button.tsx", 2);
			expect(clientResult).toBe(true);

			// Test with a module path containing 'browser'
			const browserResult = _analyzeModuleForClientDependencies("src/utils/browser-utils.ts", 2);
			expect(browserResult).toBe(true);

			// Test with a normal module path
			const normalResult = _analyzeModuleForClientDependencies("src/utils/formatter.ts", 2);
			expect(normalResult).toBe(false);

			// Test with zero depth
			const zeroDepthResult = _analyzeModuleForClientDependencies("src/components/client-button.tsx", 0);
			expect(zeroDepthResult).toBe(false);

			// Test with visited files set to prevent infinite recursion
			const visitedFiles = new Set<string>(["src/utils/circular-dep.ts"]);
			const circularResult = _analyzeModuleForClientDependencies("src/utils/circular-dep.ts", 2, visitedFiles);
			expect(circularResult).toBe(false);
		});
	});

	describe("import checking functionality", () => {
		it("detects client-only packages with checkImport", () => {
			// Create client-only package import node
			const clientImport = {
				type: AST_NODE_TYPES.ImportDeclaration,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "react-dom"
				},
				specifiers: [],
				importKind: "value"
			} as unknown as TSESTree.ImportDeclaration;

			// Test with the checkImport function
			const result = checkImport(clientImport, {
				allowlist: {},
				isClientOnlyPackage: (pkg) => pkg === "react-dom"
			});

			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("client-only package");
		});

		it("respects allowlists in checkImport", () => {
			// Create import from an allowlisted module
			const allowlistedImport = {
				type: AST_NODE_TYPES.ImportDeclaration,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "allowlisted-module"
				},
				specifiers: [],
				importKind: "value"
			} as unknown as TSESTree.ImportDeclaration;

			// Test with allowlist
			const result = checkImport(allowlistedImport, {
				allowlist: { "allowlisted-module": true },
				isClientOnlyPackage: () => false
			});

			expect(result.isClient).toBe(false);
		});

		it("distinguishes between type and value imports", () => {
			// Create a type-only import
			const typeImport = {
				type: AST_NODE_TYPES.ImportDeclaration,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "some-module"
				},
				specifiers: [
					{
						type: AST_NODE_TYPES.ImportSpecifier,
						imported: {
							type: AST_NODE_TYPES.Identifier,
							name: "SomeType"
						},
						local: {
							type: AST_NODE_TYPES.Identifier,
							name: "SomeType"
						},
						importKind: "type"
					}
				],
				importKind: "type"
			} as unknown as TSESTree.ImportDeclaration;

			// Test with type import
			const typeResult = checkImport(typeImport, {
				allowlist: {},
				isClientOnlyPackage: () => false
			});

			expect(typeResult.isClient).toBe(false);

			// Create a value import with named specifiers
			const valueImport = {
				type: AST_NODE_TYPES.ImportDeclaration,
				source: {
					type: AST_NODE_TYPES.Literal,
					value: "some-module"
				},
				specifiers: [
					{
						type: AST_NODE_TYPES.ImportSpecifier,
						imported: {
							type: AST_NODE_TYPES.Identifier,
							name: "someFunction"
						},
						local: {
							type: AST_NODE_TYPES.Identifier,
							name: "someFunction"
						}
					}
				],
				importKind: "value"
			} as unknown as TSESTree.ImportDeclaration;

			// Test with value import
			const valueResult = checkImport(valueImport, {
				allowlist: {},
				isClientOnlyPackage: () => false
			});

			expect(valueResult.isClient).toBe(true);
			expect(valueResult.dependency).toContain("Potentially client import");
		});

		it("handles non-ImportDeclaration nodes safely", () => {
			// Test with a non-import node
			const nonImportNode = {
				type: AST_NODE_TYPES.VariableDeclaration,
				declarations: []
			} as unknown as TSESTree.Node;

			const result = checkImport(nonImportNode, {
				allowlist: {},
				isClientOnlyPackage: () => false
			});

			expect(result.isClient).toBe(false);
		});
	});

	describe("JSX attribute handling", () => {
		it("detects various JSX event handlers", () => {
			// Test for onClick handler
			const onClickAttr = {
				type: AST_NODE_TYPES.JSXAttribute,
				name: {
					type: AST_NODE_TYPES.JSXIdentifier,
					name: "onClick"
				},
				value: {
					type: AST_NODE_TYPES.JSXExpressionContainer,
					expression: {
						type: AST_NODE_TYPES.ArrowFunctionExpression
					}
				}
			} as unknown as TSESTree.JSXAttribute;

			const onClickResult = checkForClientAPIs(onClickAttr);
			expect(onClickResult.isClient).toBe(true);
			expect(onClickResult.dependency).toContain("onClick");

			// Test for onMouseOver handler
			const onMouseOverAttr = {
				type: AST_NODE_TYPES.JSXAttribute,
				name: {
					type: AST_NODE_TYPES.JSXIdentifier,
					name: "onMouseOver"
				},
				value: {
					type: AST_NODE_TYPES.JSXExpressionContainer,
					expression: {
						type: AST_NODE_TYPES.ArrowFunctionExpression
					}
				}
			} as unknown as TSESTree.JSXAttribute;

			const onMouseOverResult = checkForClientAPIs(onMouseOverAttr);
			expect(onMouseOverResult.isClient).toBe(true);
			expect(onMouseOverResult.dependency).toContain("onMouseOver");

			// Test for non-event handler attribute
			const regularAttr = {
				type: AST_NODE_TYPES.JSXAttribute,
				name: {
					type: AST_NODE_TYPES.JSXIdentifier,
					name: "className"
				},
				value: {
					type: AST_NODE_TYPES.Literal,
					value: "some-class"
				}
			} as unknown as TSESTree.JSXAttribute;

			const regularAttrResult = checkForClientAPIs(regularAttr);
			expect(regularAttrResult.isClient).toBe(false);

			// Test for attribute with non-string name
			const nonStringNameAttr = {
				type: AST_NODE_TYPES.JSXAttribute,
				name: {
					type: AST_NODE_TYPES.JSXNamespacedName,
					namespace: {
						type: AST_NODE_TYPES.JSXIdentifier,
						name: "xml"
					},
					name: {
						type: AST_NODE_TYPES.JSXIdentifier,
						name: "space"
					}
				},
				value: null
			} as unknown as TSESTree.JSXAttribute;

			const nonStringNameResult = checkForClientAPIs(nonStringNameAttr);
			expect(nonStringNameResult.isClient).toBe(false);
		});

		it("handles client detection conditions in if statements", () => {
			// Test for typeof window !== 'undefined' check
			const ifWindowCheck = {
				type: AST_NODE_TYPES.IfStatement,
				test: {
					type: AST_NODE_TYPES.BinaryExpression,
					operator: "!==",
					left: {
						type: AST_NODE_TYPES.UnaryExpression,
						operator: "typeof",
						prefix: true,
						argument: {
							type: AST_NODE_TYPES.Identifier,
							name: "window"
						}
					},
					right: {
						type: AST_NODE_TYPES.Literal,
						value: "undefined"
					}
				},
				consequent: {
					type: AST_NODE_TYPES.BlockStatement,
					body: []
				},
				alternate: null
			} as unknown as TSESTree.IfStatement;

			const ifWindowResult = checkForClientAPIs(ifWindowCheck);
			expect(ifWindowResult.isClient).toBe(true);
			expect(ifWindowResult.dependency).toContain("Client detection condition");

			// Test for non-client detection condition
			const regularIf = {
				type: AST_NODE_TYPES.IfStatement,
				test: {
					type: AST_NODE_TYPES.BinaryExpression,
					operator: "===",
					left: {
						type: AST_NODE_TYPES.Identifier,
						name: "variable"
					},
					right: {
						type: AST_NODE_TYPES.Literal,
						value: true
					}
				},
				consequent: {
					type: AST_NODE_TYPES.BlockStatement,
					body: []
				},
				alternate: null
			} as unknown as TSESTree.IfStatement;

			const regularIfResult = checkForClientAPIs(regularIf);
			expect(regularIfResult.isClient).toBe(false);
		});
	});

	describe("edge cases and branch coverage", () => {
		it("handles specific exports in allowlists", () => {
			// Test with specific export allowlist
			const specificAllowlist = {
				react: ["useState", "useEffect"]
			};

			// Specific exports should be allowlisted
			expect(isExportAllowlisted("useState", "react", specificAllowlist)).toBe(true);
			expect(isExportAllowlisted("useEffect", "react", specificAllowlist)).toBe(true);
			expect(isExportAllowlisted("useCallback", "react", specificAllowlist)).toBe(false);
		});

		it("handles non-string JSX attribute names correctly", () => {
			// Create a JSX attribute with a namespaced name (non-string name)
			const namespacedAttr = {
				type: AST_NODE_TYPES.JSXAttribute,
				name: {
					type: AST_NODE_TYPES.JSXNamespacedName,
					namespace: {
						type: AST_NODE_TYPES.JSXIdentifier,
						name: "xml"
					},
					name: {
						type: AST_NODE_TYPES.JSXIdentifier,
						name: "space"
					}
				},
				value: null
			} as unknown as TSESTree.JSXAttribute;

			const result = checkForClientAPIs(namespacedAttr);
			expect(result.isClient).toBe(false);
		});

		it("handles non-identifier MemberExpression objects", () => {
			// Test with non-identifier object in MemberExpression
			const complexMemberExpr = {
				type: AST_NODE_TYPES.MemberExpression,
				object: {
					type: AST_NODE_TYPES.CallExpression,
					callee: {
						type: AST_NODE_TYPES.Identifier,
						name: "getObject"
					},
					arguments: []
				},
				property: {
					type: AST_NODE_TYPES.Identifier,
					name: "property"
				},
				computed: false
			} as unknown as TSESTree.MemberExpression;

			const result = checkForClientAPIs(complexMemberExpr);
			expect(result.isClient).toBe(false);
		});

		it("handles non-identifier property in MemberExpression", () => {
			// Test with computed property
			const computedPropertyExpr = {
				type: AST_NODE_TYPES.MemberExpression,
				object: {
					type: AST_NODE_TYPES.Identifier,
					name: "window"
				},
				property: {
					type: AST_NODE_TYPES.Literal,
					value: "location"
				},
				computed: true
			} as unknown as TSESTree.MemberExpression;

			const result = checkForClientAPIs(computedPropertyExpr);
			expect(result.isClient).toBe(true);
			expect(result.dependency).toContain("window.?");
		});

		it("correctly identifies client-only packages with prefixes", () => {
			// Check package with exact match
			expect(isKnownClientOnlyPackage("react-dom")).toBe(true);

			// Check package with prefix
			expect(isKnownClientOnlyPackage("react-dom/client")).toBe(true);

			// Check with custom module categories
			expect(isKnownClientOnlyPackage("custom-client", { clientModules: ["custom-client"] })).toBe(true);
			expect(isKnownClientOnlyPackage("not-client", { clientModules: ["custom-client"] })).toBe(false);
		});
	});
});
