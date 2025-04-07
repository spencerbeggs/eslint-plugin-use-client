import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import * as fs from "node:fs";
import { join } from "node:path";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
// Import individual functions for direct testing
import {
	isClientDetectionCondition,
	isHookCall,
	mightBeCompiledClientCode,
	loadModuleCategories,
	getFileAST,
	getClientDependency,
	setClientDependency,
	clearCaches,
	hasFileChanged
} from "../src/utils.js";
// Import everything for constants and spying
import * as utilsModule from "../src/utils.js";
import type { FileAnalysisResult } from "../src/utils.js";
import type { TSESTree } from "@typescript-eslint/utils";

// Save original console.log to restore after tests
const originalConsoleLog = console.log;

// Utility function for test-specific logging that won't be suppressed
// Prefix with underscore to indicate it may be unused
function _testLog(...args: unknown[]) {
	originalConsoleLog.apply(console, args);
}

// Replace console.log during tests to filter logs
if (process.env.VITEST_RUNNING === "true") {
	console.log = function (...args: unknown[]) {
		// Only allow logs that start with [test] prefix or are explicitly for tests
		if (
			args.length > 0 &&
			typeof args[0] === "string" &&
			args[0].startsWith("[test]") &&
			!args[0].startsWith("[rule]")
		) {
			originalConsoleLog.apply(console, args);
		}
		// Otherwise suppress logs during tests
	};
}

// Restore console.log after tests
afterAll(() => {
	console.log = originalConsoleLog;
	process.env.VITEST_RUNNING = undefined;
});

// Access constants through the module import
const {
	clientOnlyPackages,
	serverSafeHooks,
	clientOnlyHooks,
	browserAPIs,
	astCache,
	clientSideDependencyCache,
	fileTimestamps
} = utilsModule;

// Spy on console.info to suppress error messages
vi.spyOn(console, "info").mockImplementation(() => {
	// Empty implementation to suppress error messages during testing
});

vi.mock("node:fs", async () => {
	const actual = await vi.importActual("node:fs");
	const readFileSync = actual.readFileSync as (path: string, encoding?: string) => string;
	return {
		...actual,
		readFileSync: vi.fn((path: string) => {
			if (path.endsWith("problematic.tsx")) {
				throw new Error("Read error");
			}
			return readFileSync(path, "utf8");
		})
	};
});

// Helper type for test nodes that don't need full AST information
type TestNode<T extends TSESTree.Node> = Omit<T, "parent" | "loc"> & {
	parent: T;
	loc: {
		start: { line: number; column: number };
		end: { line: number; column: number };
	};
};

// Helper function to create a test node with minimal required properties
function createTestNode<T extends TSESTree.Node>(base: Partial<T>): TestNode<T> {
	return {
		...base,
		parent: base as T,
		loc: {
			start: { line: 1, column: 1 },
			end: { line: 1, column: 5 }
		},
		range: [0, 0]
	} as TestNode<T>;
}

describe("utils", () => {
	const testDir = join(import.meta.dirname, "__fs__");
	const testFile = join(testDir, "test.tsx");

	beforeEach(() => {
		try {
			mkdirSync(testDir, { recursive: true });
			writeFileSync(testFile, "test content");
		} catch (err) {
			console.error("Error setting up test file:", err);
		}
	});

	afterEach(() => {
		try {
			unlinkSync(testFile);
			rmdirSync(testDir);
		} catch (_) {
			// Ignore if file doesn't exist
		}
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe("constants", () => {
		it("should have correct client-only packages", () => {
			expect(clientOnlyPackages).toContain("react-dom");
			expect(clientOnlyPackages).toContain("@headlessui/");
		});

		it("should have correct server-safe hooks", () => {
			expect(serverSafeHooks).toContain("useId");
			expect(serverSafeHooks).toContain("useMemo");
		});

		it("should have correct client-only hooks", () => {
			expect(clientOnlyHooks).toContain("useState");
			expect(clientOnlyHooks).toContain("useEffect");
		});

		it("should have correct browser APIs", () => {
			expect(browserAPIs).toContain("window");
			expect(browserAPIs).toContain("document");
		});
	});

	describe("loadModuleCategories", () => {
		const testConfigPath = join(process.cwd(), "use-client-config.json");
		const testConfig = {
			clientModules: ["test-client"],
			serverModules: ["test-server"],
			sharedModules: ["test-shared"],
			clientOnlyHooks: ["testHook"],
			serverSafeHooks: ["testSafeHook"]
		};

		beforeEach(() => {
			writeFileSync(testConfigPath, JSON.stringify(testConfig));
		});

		afterEach(() => {
			try {
				unlinkSync(testConfigPath);
			} catch (_) {
				// Ignore if file doesn't exist
			}
		});

		it("should load config from file", () => {
			const result = loadModuleCategories();
			expect(result).toEqual(testConfig);
		});

		it("should return defaults when file doesn't exist", () => {
			unlinkSync(testConfigPath);
			const result = loadModuleCategories();
			expect(result).toEqual({
				clientModules: [],
				serverModules: [],
				sharedModules: [],
				clientOnlyHooks: [],
				serverSafeHooks: []
			});
		});

		it("should handle invalid JSON in config file", () => {
			writeFileSync(testConfigPath, "invalid json content");
			const result = loadModuleCategories();
			expect(result).toEqual({
				clientModules: [],
				serverModules: [],
				sharedModules: [],
				clientOnlyHooks: [],
				serverSafeHooks: []
			});
		});

		it("should handle file read errors", () => {
			unlinkSync(testConfigPath);
			writeFileSync(testConfigPath, "invalid json content");
			unlinkSync(testConfigPath);
			const result = loadModuleCategories();
			expect(result).toEqual({
				clientModules: [],
				serverModules: [],
				sharedModules: [],
				clientOnlyHooks: [],
				serverSafeHooks: []
			});
		});

		it("should handle malformed config object", () => {
			writeFileSync(testConfigPath, JSON.stringify({ invalidKey: true }));
			const result = loadModuleCategories();
			expect(result).toEqual({
				clientModules: [],
				serverModules: [],
				sharedModules: [],
				clientOnlyHooks: [],
				serverSafeHooks: []
			});
		});
	});

	describe("isClientDetectionCondition", () => {
		it("should detect typeof window !== 'undefined'", () => {
			const node = createTestNode<TSESTree.BinaryExpression>({
				type: AST_NODE_TYPES.BinaryExpression,
				operator: "!==",
				left: createTestNode<TSESTree.UnaryExpression>({
					type: AST_NODE_TYPES.UnaryExpression,
					operator: "typeof",
					argument: createTestNode<TSESTree.Identifier>({
						type: AST_NODE_TYPES.Identifier,
						name: "window",
						decorators: [],
						optional: false,
						typeAnnotation: undefined
					})
				}),
				right: createTestNode<TSESTree.StringLiteral>({
					type: AST_NODE_TYPES.Literal,
					value: "undefined",
					raw: "'undefined'"
				})
			});
			expect(isClientDetectionCondition(node)).toBe(true);
		});

		it("should detect typeof window != 'undefined'", () => {
			const node = createTestNode<TSESTree.BinaryExpression>({
				type: AST_NODE_TYPES.BinaryExpression,
				operator: "!=",
				left: createTestNode<TSESTree.UnaryExpression>({
					type: AST_NODE_TYPES.UnaryExpression,
					operator: "typeof",
					argument: createTestNode<TSESTree.Identifier>({
						type: AST_NODE_TYPES.Identifier,
						name: "window",
						decorators: [],
						optional: false,
						typeAnnotation: undefined
					})
				}),
				right: createTestNode<TSESTree.StringLiteral>({
					type: AST_NODE_TYPES.Literal,
					value: "undefined",
					raw: "'undefined'"
				})
			});
			expect(isClientDetectionCondition(node)).toBe(true);
		});

		it("should detect 'undefined' !== typeof window", () => {
			const node = createTestNode<TSESTree.BinaryExpression>({
				type: AST_NODE_TYPES.BinaryExpression,
				operator: "!==",
				left: createTestNode<TSESTree.StringLiteral>({
					type: AST_NODE_TYPES.Literal,
					value: "undefined",
					raw: "'undefined'"
				}),
				right: createTestNode<TSESTree.UnaryExpression>({
					type: AST_NODE_TYPES.UnaryExpression,
					operator: "typeof",
					argument: createTestNode<TSESTree.Identifier>({
						type: AST_NODE_TYPES.Identifier,
						name: "window",
						decorators: [],
						optional: false,
						typeAnnotation: undefined
					})
				})
			});
			expect(isClientDetectionCondition(node)).toBe(true);
		});

		it("should reject non-window typeof checks", () => {
			const node = createTestNode<TSESTree.BinaryExpression>({
				type: AST_NODE_TYPES.BinaryExpression,
				operator: "!==",
				left: createTestNode<TSESTree.UnaryExpression>({
					type: AST_NODE_TYPES.UnaryExpression,
					operator: "typeof",
					argument: createTestNode<TSESTree.Identifier>({
						type: AST_NODE_TYPES.Identifier,
						name: "document",
						decorators: [],
						optional: false,
						typeAnnotation: undefined
					})
				}),
				right: createTestNode<TSESTree.StringLiteral>({
					type: AST_NODE_TYPES.Literal,
					value: "undefined",
					raw: "'undefined'"
				})
			});
			expect(isClientDetectionCondition(node)).toBe(false);
		});

		it("should reject non-equality operators", () => {
			const node = createTestNode<TSESTree.BinaryExpression>({
				type: AST_NODE_TYPES.BinaryExpression,
				operator: "===",
				left: createTestNode<TSESTree.UnaryExpression>({
					type: AST_NODE_TYPES.UnaryExpression,
					operator: "typeof",
					argument: createTestNode<TSESTree.Identifier>({
						type: AST_NODE_TYPES.Identifier,
						name: "window",
						decorators: [],
						optional: false,
						typeAnnotation: undefined
					})
				}),
				right: createTestNode<TSESTree.StringLiteral>({
					type: AST_NODE_TYPES.Literal,
					value: "undefined",
					raw: "'undefined'"
				})
			});
			expect(isClientDetectionCondition(node)).toBe(false);
		});

		it("should reject non-binary expressions", () => {
			const node = createTestNode<TSESTree.UnaryExpression>({
				type: AST_NODE_TYPES.UnaryExpression,
				operator: "typeof",
				argument: createTestNode<TSESTree.Identifier>({
					type: AST_NODE_TYPES.Identifier,
					name: "window",
					decorators: [],
					optional: false,
					typeAnnotation: undefined
				})
			});
			expect(isClientDetectionCondition(node)).toBe(false);
		});
	});

	describe("isHookCall", () => {
		it("should detect valid hook calls", () => {
			const node = createTestNode<TSESTree.CallExpression>({
				type: AST_NODE_TYPES.CallExpression,
				callee: createTestNode<TSESTree.Identifier>({
					type: AST_NODE_TYPES.Identifier,
					name: "useState",
					decorators: [],
					optional: false,
					typeAnnotation: undefined
				}),
				arguments: [],
				optional: false,
				typeArguments: undefined
			});
			expect(isHookCall(node)).toBe(true);
		});

		it("should detect custom hook calls", () => {
			const node = createTestNode<TSESTree.CallExpression>({
				type: AST_NODE_TYPES.CallExpression,
				callee: createTestNode<TSESTree.Identifier>({
					type: AST_NODE_TYPES.Identifier,
					name: "useMyCustomHook",
					decorators: [],
					optional: false,
					typeAnnotation: undefined
				}),
				arguments: [],
				optional: false,
				typeArguments: undefined
			});
			expect(isHookCall(node)).toBe(true);
		});

		it("should reject non-hook function calls", () => {
			const node = createTestNode<TSESTree.CallExpression>({
				type: AST_NODE_TYPES.CallExpression,
				callee: createTestNode<TSESTree.Identifier>({
					type: AST_NODE_TYPES.Identifier,
					name: "regularFunction",
					decorators: [],
					optional: false,
					typeAnnotation: undefined
				}),
				arguments: [],
				optional: false,
				typeArguments: undefined
			});
			expect(isHookCall(node)).toBe(false);
		});

		it("should reject invalid hook names", () => {
			const node = createTestNode<TSESTree.CallExpression>({
				type: AST_NODE_TYPES.CallExpression,
				callee: createTestNode<TSESTree.Identifier>({
					type: AST_NODE_TYPES.Identifier,
					name: "useinvalidhook",
					decorators: [],
					optional: false,
					typeAnnotation: undefined
				}),
				arguments: [],
				optional: false,
				typeArguments: undefined
			});
			expect(isHookCall(node)).toBe(false);
		});

		it("should reject non-identifier callee", () => {
			const node = createTestNode<TSESTree.CallExpression>({
				type: AST_NODE_TYPES.CallExpression,
				callee: createTestNode<TSESTree.MemberExpressionNonComputedName>({
					type: AST_NODE_TYPES.MemberExpression,
					object: createTestNode<TSESTree.Identifier>({
						type: AST_NODE_TYPES.Identifier,
						name: "React",
						decorators: [],
						optional: false,
						typeAnnotation: undefined
					}),
					property: createTestNode<TSESTree.Identifier>({
						type: AST_NODE_TYPES.Identifier,
						name: "useState",
						decorators: [],
						optional: false,
						typeAnnotation: undefined
					}),
					computed: false,
					optional: false
				}),
				arguments: [],
				optional: false,
				typeArguments: undefined
			});
			expect(isHookCall(node)).toBe(false);
		});
	});

	describe("isHookCall function", () => {
		it("should identify hook calls correctly", () => {
			// Create a simple AST node that represents a hook call
			const hookNode = {
				type: AST_NODE_TYPES.CallExpression,
				callee: {
					type: AST_NODE_TYPES.Identifier,
					name: "useState"
				}
			} as TSESTree.CallExpression;

			// Create a non-hook call
			const nonHookNode = {
				type: AST_NODE_TYPES.CallExpression,
				callee: {
					type: AST_NODE_TYPES.Identifier,
					name: "normalFunction"
				}
			} as TSESTree.CallExpression;

			// Test the function
			expect(isHookCall(hookNode)).toBe(true);
			expect(isHookCall(nonHookNode)).toBe(false);

			// This log will be completely suppressed during test runs
			// _testLog("[test] isHookCall direct test passed!");
		});
	});

	describe("mightBeCompiledClientCode", () => {
		it("should detect window assignment", () => {
			expect(mightBeCompiledClientCode("window = this")).toBe(true);
			expect(mightBeCompiledClientCode("window.foo = this.bar")).toBe(true);
		});

		it("should detect document assignment", () => {
			expect(mightBeCompiledClientCode("document = this.doc")).toBe(true);
			expect(mightBeCompiledClientCode("document.body = this.element")).toBe(true);
		});

		it("should detect typeof window checks", () => {
			expect(mightBeCompiledClientCode("typeof window !== 'undefined'")).toBe(true);
			expect(mightBeCompiledClientCode("typeof window != 'undefined'")).toBe(true);
			expect(mightBeCompiledClientCode("'undefined' !== typeof window")).toBe(true);
		});

		it("should reject non-client code", () => {
			expect(mightBeCompiledClientCode("const x = 42")).toBe(false);
			expect(mightBeCompiledClientCode("function foo() { return bar; }")).toBe(false);
		});
	});

	describe("file analysis", () => {
		const testFilePath = join(process.cwd(), "test-file.tsx");

		beforeEach(() => {
			clearCaches();
			writeFileSync(testFilePath, "const x = 1;");
		});

		afterEach(() => {
			try {
				unlinkSync(testFilePath);
			} catch (_) {
				// Ignore if file doesn't exist
			}
		});

		it("should detect 'use client' directive", () => {
			writeFileSync(testFilePath, "'use client';\nconst x = 1;");
			const result = getFileAST(testFilePath);
			expect(result.hasUseClient).toBe(true);
			expect(result.hasClientCode).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should detect compiled client code", () => {
			writeFileSync(testFilePath, "window = this;\nconst x = 1;");
			const result = getFileAST(testFilePath);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should detect DOM APIs", () => {
			writeFileSync(testFilePath, "document.title = 'test';\nconst x = 1;");
			const result = getFileAST(testFilePath);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should detect client-only hooks", () => {
			writeFileSync(testFilePath, "useEffect(() => {});\nconst x = 1;");
			const result = getFileAST(testFilePath);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle file read errors", () => {
			unlinkSync(testFilePath);
			const result = getFileAST(testFilePath);
			expect(result.error).toBe(true);
			expect(result.hasUseClient).toBeUndefined();
			expect(result.hasClientCode).toBeUndefined();
		});

		it("should cache results", () => {
			writeFileSync(testFilePath, "'use client';\nconst x = 1;");
			const result1 = getFileAST(testFilePath);
			const result2 = getFileAST(testFilePath);
			// Compare everything except analyzedAt
			const { analyzedAt: _, ...rest1 } = result1;
			const { analyzedAt: __, ...rest2 } = result2;
			expect(rest1).toStrictEqual(rest2);
		});

		it("should invalidate cache when file changes", () => {
			writeFileSync(testFilePath, "'use client';\nconst x = 1;");
			const result1 = getFileAST(testFilePath);
			writeFileSync(testFilePath, "const x = 1;"); // Remove 'use client'
			const result2 = getFileAST(testFilePath);
			expect(result1.hasUseClient).toBe(true);
			expect(result2.hasUseClient).toBe(false);
		});

		it("should handle multiple client-side features", () => {
			writeFileSync(
				testFilePath,
				`
				useEffect(() => {});
				document.title = 'test';
				window = this;
				const x = 1;
				`
			);
			const result = getFileAST(testFilePath);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should handle empty files", () => {
			writeFileSync(testFilePath, "");
			const result = getFileAST(testFilePath);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(false);
			expect(result.error).toBeUndefined();
		});

		it("should handle file read errors with caching and retries", () => {
			// First, create a valid file and cache its AST
			writeFileSync(testFilePath, "'use client';\nconst x = 1;");
			const result1 = getFileAST(testFilePath);
			expect(result1.error).toBeUndefined();

			// Now delete the file and try to read it again
			unlinkSync(testFilePath);
			// Suppress the expected warning about file read error
			const originalWarn = console.warn;
			console.warn = function suppressWarning() {
				/* suppress warning */
			};
			const result2 = getFileAST(testFilePath);
			console.warn = originalWarn;
			expect(result2.error).toBe(true);

			// Write a new file and verify cache is not used
			writeFileSync(testFilePath, "const x = 1;");
			const result3 = getFileAST(testFilePath);
			expect(result3.error).toBeUndefined();
			expect(result3.hasUseClient).toBe(false);

			// Try to read from cache again
			const result4 = getFileAST(testFilePath);
			expect(result4.error).toBeUndefined();
			expect(result4.hasUseClient).toBe(false);
		});

		it("should handle undefined cache values in getFileAST", () => {
			const testFile = join(process.cwd(), "test-file.tsx");
			writeFileSync(testFile, "'use client';\nexport function Test() {}");

			// First call to populate cache
			const result1 = getFileAST(testFile);
			expect(result1.hasUseClient).toBe(true);
			expect(result1.hasClientCode).toBe(false);

			// Clear the cache and set an undefined value
			clearCaches();
			vi.spyOn(fs, "statSync").mockImplementationOnce(
				() =>
					({
						mtimeMs: 0
					}) as fs.Stats
			);

			// Second call should reanalyze the file
			const result2 = getFileAST(testFile);
			expect(result2.hasUseClient).toBe(true);
			expect(result2.hasClientCode).toBe(false);

			// Clean up
			unlinkSync(testFile);
		});

		it("should handle empty cache entries in getFileAST", () => {
			// Create a test file
			const testFile = join(testDir, "test.tsx");
			writeFileSync(testFile, "'use client';\nexport function Test() {}");

			// First call to populate cache
			const result1 = getFileAST(testFile);
			expect(result1.hasUseClient).toBe(true);
			expect(result1.hasClientCode).toBe(false);

			// Clear the cache and force a cache miss
			clearCaches();
			vi.spyOn(fs, "statSync").mockImplementationOnce(
				() =>
					({
						mtimeMs: 0
					}) as fs.Stats
			);

			// Second call should reanalyze the file
			const result2 = getFileAST(testFile);
			expect(result2.hasUseClient).toBe(true);
			expect(result2.hasClientCode).toBe(false);

			// Clean up
			unlinkSync(testFile);
		});

		it("should handle undefined cache values in getClientDependency", () => {
			// Create a test file
			const testFile = join(testDir, "test.tsx");
			writeFileSync(testFile, "'use client';\nexport function Test() {}");

			// First call to populate cache
			expect(getClientDependency(testFile)).toBe(null);

			// Set dependency and force a cache miss
			setClientDependency(testFile, false);
			vi.spyOn(fs, "existsSync").mockImplementationOnce(() => false);

			// Test with file doesn't exist
			expect(getClientDependency(testFile)).toBe(false);

			// Test with file exists but has changed
			vi.spyOn(fs, "existsSync").mockImplementationOnce(() => true);
			vi.spyOn(fs, "statSync").mockImplementationOnce(
				() =>
					({
						mtimeMs: Date.now() + 1000
					}) as fs.Stats
			);
			expect(getClientDependency(testFile)).toBe(null);

			// Clean up
			unlinkSync(testFile);
		});

		it("should handle client dependency caching", () => {
			// Create a test file
			writeFileSync(testFile, "'use client';\nexport function Test() {}");

			// Mock statSync to return a consistent timestamp
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);

			// Initial value should be null
			expect(getClientDependency(testFile)).toBe(null);

			// Set dependency
			setClientDependency(testFile, true);
			expect(getClientDependency(testFile)).toBe(true);

			// Update dependency
			setClientDependency(testFile, false);
			expect(getClientDependency(testFile)).toBe(false);

			// Clear caches
			clearCaches();
			expect(getClientDependency(testFile)).toBe(null);

			// Clean up
			unlinkSync(testFile);
		});

		it("should handle multiple files", () => {
			const file1 = join(testDir, "file1.tsx");
			const file2 = join(testDir, "file2.tsx");

			setClientDependency(file1, true);
			setClientDependency(file2, false);

			expect(getClientDependency(file1)).toBe(true);
			expect(getClientDependency(file2)).toBe(false);

			clearCaches();

			expect(getClientDependency(file1)).toBe(null);
			expect(getClientDependency(file2)).toBe(null);
		});
	});

	describe("getFileAST", () => {
		it("should detect use client directive", () => {
			writeFileSync(testFile, "'use client';\nexport function Test() {}");
			const result = getFileAST(testFile);
			expect(result.hasUseClient).toBe(true);
			expect(result.hasClientCode).toBe(false);
		});

		it("should detect compiled client code", () => {
			writeFileSync(testFile, "window = this;\nexport function Test() {}");
			const result = getFileAST(testFile);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(true);
		});

		it("should detect browser APIs", () => {
			writeFileSync(testFile, "document.body.style.color = 'red';\nexport function Test() {}");
			const result = getFileAST(testFile);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(true);
		});

		it("should detect client-only hooks", () => {
			writeFileSync(testFile, "const [state, setState] = useState();\nexport function Test() {}");
			const result = getFileAST(testFile);
			expect(result.hasUseClient).toBe(false);
			expect(result.hasClientCode).toBe(true);
		});

		it("should handle file read errors", () => {
			// Create a test file
			const fileContent = "'use client';\nexport function Test() {}";
			writeFileSync(testFile, fileContent);

			// Mock fs functions
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(true);
			vi.spyOn(fs, "readFileSync").mockImplementation(() => {
				throw new Error("Failed to read file");
			});

			// Clear caches before test
			astCache.clear();
			clientSideDependencyCache.clear();
			fileTimestamps.clear();

			// Check error result
			const result = getFileAST(testFile);
			expect(result.error).toBe(true);
			expect(result.hasUseClient).toBeUndefined();
			expect(result.hasClientCode).toBeUndefined();
		});

		it("should handle readFileSync errors", () => {
			// Create a file that will cause a read error
			const problematicFile = join(testDir, "problematic.tsx");
			writeFileSync(problematicFile, "test content");

			const result = getFileAST(problematicFile);
			expect(result.error).toBe(true);
			expect(result.hasUseClient).toBeUndefined();
			expect(result.hasClientCode).toBeUndefined();

			// Clean up
			unlinkSync(problematicFile);
		});

		it("should use cache for unchanged files", () => {
			// Create a test file
			const fileContent = "'use client';\nexport function Test() {}";
			writeFileSync(testFile, fileContent);

			// Mock fs functions
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(true);
			vi.spyOn(fs, "readFileSync").mockReturnValue(fileContent);

			// First call should read file
			const result1 = getFileAST(testFile);
			expect(result1.hasUseClient).toBe(true);
			expect(result1.hasClientCode).toBe(false);

			// Second call should use cache
			const result2 = getFileAST(testFile);
			expect(result2.hasUseClient).toBe(true);
			expect(result2.hasClientCode).toBe(false);
		});

		it("should handle file read errors", () => {
			// Create a test file
			const fileContent = "'use client';\nexport function Test() {}";
			writeFileSync(testFile, fileContent);

			// Mock fs functions
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(true);
			vi.spyOn(fs, "readFileSync").mockImplementation(() => {
				throw new Error("Failed to read file");
			});

			// Clear caches before test
			astCache.clear();
			clientSideDependencyCache.clear();
			fileTimestamps.clear();

			// Check error result
			const result = getFileAST(testFile);
			expect(result.error).toBe(true);
			expect(result.hasUseClient).toBeUndefined();
			expect(result.hasClientCode).toBeUndefined();
		});

		it("should handle stat errors", () => {
			// Create a problematic file that will trigger a stat error
			const problematicFile = join(testDir, "problematic.tsx");
			writeFileSync(problematicFile, "test content");

			// Mock statSync to throw an error
			vi.spyOn(fs, "statSync").mockImplementationOnce(() => {
				throw new Error("Stat error");
			});

			// Should return true when stat fails
			expect(hasFileChanged(problematicFile)).toBe(true);

			// Clean up
			unlinkSync(problematicFile);
		});

		it("should handle undefined cache entry in getFileAST", () => {
			// Create a test file
			const fileContent = "'use client';\nexport function Test() {}";
			writeFileSync(testFile, fileContent);

			// Mock fs functions
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(true);
			vi.spyOn(fs, "readFileSync").mockReturnValue(fileContent);

			// Set undefined in cache and verify it's handled correctly
			astCache.set(testFile, undefined as unknown as FileAnalysisResult);
			const result = getFileAST(testFile);
			expect(result.hasUseClient).toBe(true);
			expect(result.hasClientCode).toBe(false);

			// Set null in cache and verify it's handled correctly
			astCache.set(testFile, null as unknown as FileAnalysisResult);
			const result2 = getFileAST(testFile);
			expect(result2.hasUseClient).toBe(true);
			expect(result2.hasClientCode).toBe(false);
		});

		it("should handle undefined cache value in getClientDependency", () => {
			// Create a test file
			const fileContent = "'use client';\nexport function Test() {}";
			writeFileSync(testFile, fileContent);

			// Mock fs functions
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(false);

			// Set undefined in cache
			clientSideDependencyCache.set(testFile, null as unknown as boolean);

			// Should handle undefined cache value
			expect(getClientDependency(testFile)).toBe(false);
		});

		it("should handle stat errors in setClientDependency", () => {
			// Create a test file
			const fileContent = "'use client';\nexport function Test() {}";
			writeFileSync(testFile, fileContent);

			// Clear caches before test
			clearCaches();

			// Set an initial timestamp
			const initialTimestamp = Date.now();
			fileTimestamps.set(testFile, initialTimestamp);

			// Mock fs functions to simulate stat error
			vi.spyOn(fs, "existsSync").mockReturnValue(true);
			const statError = new Error("Stat error");
			const statSyncMock = vi.spyOn(fs, "statSync").mockImplementation(() => {
				throw statError;
			});

			// Spy on console.info
			const consoleSpy = vi.spyOn(console, "info");

			// Set client dependency and verify error handling
			setClientDependency(testFile, true);

			// Verify the error path was taken
			expect(statSyncMock).toHaveBeenCalledWith(testFile);
			expect(consoleSpy).toHaveBeenCalledWith("Error setting timestamp for file", testFile);
			expect(clientSideDependencyCache.get(testFile)).toBe(true);
			expect(fileTimestamps.has(testFile)).toBe(false);

			// Clear spies and try again with false
			consoleSpy.mockClear();
			statSyncMock.mockClear();

			// Set an initial timestamp again
			fileTimestamps.set(testFile, initialTimestamp);

			// Set client dependency to false and verify error handling
			setClientDependency(testFile, false);

			// Verify the error path was taken again
			expect(statSyncMock).toHaveBeenCalledWith(testFile);
			expect(consoleSpy).toHaveBeenCalledWith("Error setting timestamp for file", testFile);
			expect(clientSideDependencyCache.get(testFile)).toBe(false);
			expect(fileTimestamps.has(testFile)).toBe(false);

			// Verify that the timestamp was deleted in both cases
			expect(fileTimestamps.get(testFile)).toBeUndefined();
		});
	});

	describe("client dependency cache", () => {
		beforeEach(() => {
			clearCaches();
			vi.spyOn(fs, "existsSync").mockReturnValue(false);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should return null for uncached files", () => {
			expect(getClientDependency(testFile)).toBeNull();
		});

		it("should cache and return client dependency status", () => {
			// Mock statSync to return a consistent timestamp
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(true);

			// Set initial dependency
			setClientDependency(testFile, true);
			expect(getClientDependency(testFile)).toBe(true);
		});

		it("should invalidate cache when file changes", () => {
			// Mock statSync to return a consistent timestamp
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(true);

			// Set initial dependency
			setClientDependency(testFile, true);
			expect(getClientDependency(testFile)).toBe(true);

			// Modify file and force cache invalidation
			writeFileSync(testFile, "const y = 2;");
			vi.spyOn(fs, "statSync").mockImplementationOnce(
				() =>
					({
						mtimeMs: timestamp + 1000
					}) as fs.Stats
			);
			expect(getClientDependency(testFile)).toBeNull();
		});

		it("should handle file read errors", () => {
			// Create a test file
			writeFileSync(testFile, "'use client';\nexport function Test() {}");

			// Mock statSync to return a consistent timestamp
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(true);

			// Set initial dependency
			setClientDependency(testFile, true);
			expect(getClientDependency(testFile)).toBe(true);

			// Delete file and check cache returns cached value
			unlinkSync(testFile);
			vi.spyOn(fs, "existsSync").mockReturnValue(false);
			expect(getClientDependency(testFile)).toBe(true);
		});

		it("should handle undefined cache values", () => {
			// Mock statSync to return a consistent timestamp
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(false);

			// For non-existent files with no cache entry, should return null
			expect(getClientDependency(testFile)).toBeNull();

			// After clearing cache, should return null
			clearCaches();
			expect(getClientDependency(testFile)).toBeNull();
		});

		it("should handle undefined cache values in getClientDependency", () => {
			// Mock statSync to return a consistent timestamp
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);
			vi.spyOn(fs, "existsSync").mockReturnValue(false);

			// For non-existent files with no cache entry, should return null
			expect(getClientDependency(testFile)).toBeNull();

			// After setting cache to true, should return true
			setClientDependency(testFile, true);
			expect(getClientDependency(testFile)).toBe(true);
		});

		it("should handle stat errors", () => {
			// Create a problematic file that will trigger a stat error
			const problematicFile = join(testDir, "problematic.tsx");
			writeFileSync(problematicFile, "test content");

			// Mock statSync to throw an error
			vi.spyOn(fs, "statSync").mockImplementationOnce(() => {
				throw new Error("Stat error");
			});

			// Should return true when stat fails
			expect(hasFileChanged(problematicFile)).toBe(true);

			// Clean up
			unlinkSync(problematicFile);
		});

		it("should clear all caches", () => {
			setClientDependency(testFile, true);
			clearCaches();
			expect(getClientDependency(testFile)).toBeNull();
		});

		it("should handle client dependency caching", () => {
			// Create a test file
			writeFileSync(testFile, "'use client';\nexport function Test() {}");

			// Mock statSync to return a consistent timestamp
			const timestamp = Date.now();
			vi.spyOn(fs, "statSync").mockImplementation(
				() =>
					({
						mtimeMs: timestamp
					}) as fs.Stats
			);

			// Initial value should be null
			expect(getClientDependency(testFile)).toBe(null);

			// Set dependency
			setClientDependency(testFile, true);
			expect(getClientDependency(testFile)).toBe(true);

			// Update dependency
			setClientDependency(testFile, false);
			expect(getClientDependency(testFile)).toBe(false);

			// Clear caches
			clearCaches();
			expect(getClientDependency(testFile)).toBe(null);

			// Clean up
			unlinkSync(testFile);
		});

		it("should handle multiple files", () => {
			const file1 = join(testDir, "file1.tsx");
			const file2 = join(testDir, "file2.tsx");

			setClientDependency(file1, true);
			setClientDependency(file2, false);

			expect(getClientDependency(file1)).toBe(true);
			expect(getClientDependency(file2)).toBe(false);

			clearCaches();

			expect(getClientDependency(file1)).toBe(null);
			expect(getClientDependency(file2)).toBe(null);
		});
	});
});
