import { statSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import { SymbolFlags } from "typescript";
import {
	serverSafeHooks,
	clientOnlyHooks,
	browserAPIs,
	loadModuleCategories,
	isClientDetectionCondition,
	isHookCall,
	getFileAST,
	getClientDependency,
	setClientDependency,
	clientOnlyPackages,
	clientSideDependencyCache,
	hasFileChanged
} from "../utils.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type AllowlistType = Record<string, boolean | string[]>;

const createRule = ESLintUtils.RuleCreator((name) => `https://spencerbeg.gs/rule/${name}`);

export const enforceRule = createRule({
	name: "enforce-use-client",
	meta: {
		type: "problem",
		fixable: "code",
		docs: {
			description: 'Enforce the use of "use client" directive in components with client-side dependencies'
		},
		messages: {
			missingUseClient: 'Component with client-side dependencies is missing "use client" directive',
			detectedClientDep: "Detected client-side dependency: {{ dependency }}",
			sharedComponent:
				"This appears to be a shared component. Consider creating separate client/server versions or using dynamic imports"
		},
		schema: [
			{
				type: "object",
				properties: {
					allowlist: {
						type: "object",
						additionalProperties: {
							oneOf: [
								{ type: "boolean" },
								{
									type: "array",
									items: { type: "string" }
								}
							]
						}
					},
					traceDepth: {
						type: "integer",
						minimum: 0
					},
					traceDependencies: {
						type: "boolean"
					}
				},
				additionalProperties: false
			}
		]
	},
	defaultOptions: [
		{
			allowlist: {
				react: true,
				"react-dom": true,
				next: true,
				"next/image": true,
				"next/link": true,
				"next/router": true
			} as AllowlistType,
			traceDepth: 1,
			traceDependencies: true
		}
	],
	create(context): TSESLint.RuleListener {
		const options = context.options[0] as {
			allowlist: AllowlistType;
			traceDepth: number;
			traceDependencies: boolean;
		};
		const { allowlist, traceDepth, traceDependencies } = options;

		// Skip analysis if no type information available
		const services = context.sourceCode.parserServices;

		if (!services?.program) {
			return {};
		}

		const checker = services.program.getTypeChecker();
		const fileName = context.filename;
		const sourceCode = context.sourceCode;

		// Try to load module categories from config file
		const moduleCategories = loadModuleCategories();

		// Extend with configured hooks
		const serverSafeHooksExtended = [...serverSafeHooks, ...moduleCategories.serverSafeHooks];
		const clientOnlyHooksExtended = [...clientOnlyHooks, ...moduleCategories.clientOnlyHooks];

		// Track if 'use client' directive exists in the file
		let hasUseClientDirective = false;

		// Track detected client dependencies
		const clientDependencies: string[] = [];

		// Track current trace depth for dependency resolution
		let currentTraceDepth = 0;

		// Set of files checked in this run to avoid circular dependencies
		const filesCheckedInThisRun = new Set<string>();

		// Track exports to detect shared components
		let hasExports = false;
		let hasDirectClientAPIs = false;

		// Check if a module is allowlisted
		function isModuleAllowlisted(moduleName: string): boolean {
			if (allowlist[moduleName] === true) {
				return true;
			}

			// Check against loaded module categories
			if (moduleCategories.serverModules.includes(moduleName)) {
				return true;
			}

			return false;
		}

		// Check if a specific export from a module is allowlisted
		function isExportAllowlisted(moduleName: string, exportName: string): boolean {
			const allowlistValue = allowlist[moduleName];

			if (allowlistValue === true) {
				return true;
			}

			if (Array.isArray(allowlistValue)) {
				return allowlistValue.includes(exportName) || allowlistValue.includes("*");
			}

			return false;
		}

		// Check if a package is known to be client-only
		function isKnownClientOnlyPackage(packageName: string): boolean {
			// Check against configured client modules
			if (moduleCategories.clientModules.includes(packageName)) {
				return true;
			}

			// Check against hardcoded list
			return clientOnlyPackages.some((prefix) => packageName === prefix || packageName.startsWith(prefix));
		}

		// Function to check if a node uses client-side APIs
		function checkNodeForClientAPIs(node: TSESTree.Node): boolean {
			// Check for React hook usage
			if (isHookCall(node)) {
				const callExpr = node as TSESTree.CallExpression;
				const callee = callExpr.callee;
				const hookName = callee.type === AST_NODE_TYPES.Identifier ? callee.name : "";

				// Check if it's a client-only hook
				if (clientOnlyHooksExtended.includes(hookName)) {
					clientDependencies.push(`React hook: ${hookName}`);
					hasDirectClientAPIs = true;
					return true;
				}

				// If it's a server-safe hook, we can ignore it
				if (serverSafeHooksExtended.includes(hookName)) {
					return false;
				}

				// Unknown hooks should be treated conservatively
				clientDependencies.push(`Unknown hook call: ${hookName}`);
				hasDirectClientAPIs = true;
				return true;
			}

			// Check for DOM globals
			if (node.type === AST_NODE_TYPES.Identifier) {
				const name = node.name;

				if (browserAPIs.includes(name)) {
					// Get the TS node to verify it's a global
					const tsNode = services?.esTreeNodeToTSNodeMap?.get(node);
					const symbol = tsNode ? checker.getSymbolAtLocation(tsNode) : undefined;

					// Check if it's actually the global object and not a local variable
					if (symbol && symbol.flags & SymbolFlags.Value) {
						clientDependencies.push(`Browser API: ${name}`);
						hasDirectClientAPIs = true;
						return true;
					}
				}
			}

			// Check for window/document property access
			if (node.type === AST_NODE_TYPES.MemberExpression) {
				if (node.object.type === AST_NODE_TYPES.Identifier) {
					const objectName = node.object.name;
					if (browserAPIs.includes(objectName)) {
						const propName = node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : "?";
						clientDependencies.push(`Browser API: ${objectName}.${propName}`);
						hasDirectClientAPIs = true;
						return true;
					}
				}
			}

			// Check for event handlers in JSX attributes
			if (node.type === AST_NODE_TYPES.JSXAttribute) {
				const attrName = node.name.name;
				if (typeof attrName === "string" && attrName.startsWith("on") && attrName.length > 2) {
					// Check if the second character is uppercase (like onClick, onChange)
					const secondChar = attrName.charAt(2);
					if (secondChar === secondChar.toUpperCase()) {
						clientDependencies.push(`JSX event handler: ${attrName}`);
						hasDirectClientAPIs = true;
						return true;
					}
				}
			}

			// Check if statements for client detection pattern
			if (node.type === AST_NODE_TYPES.IfStatement) {
				if (isClientDetectionCondition(node.test)) {
					clientDependencies.push("Client detection condition (typeof window check)");
					hasDirectClientAPIs = true;
					return true;
				}
			}

			return false;
		}

		// Function to check imports for client dependencies
		function checkImportForClientDependencies(node: TSESTree.Node): boolean {
			if (node.type !== AST_NODE_TYPES.ImportDeclaration) {
				return false;
			}

			const moduleSpecifier = node.source.value;

			// Skip completely allowlisted modules
			if (isModuleAllowlisted(moduleSpecifier)) {
				return false;
			}

			// Check if it's a known client-only package
			if (isKnownClientOnlyPackage(moduleSpecifier)) {
				clientDependencies.push(`Import from client-only package: ${moduleSpecifier}`);
				hasDirectClientAPIs = true;
				return true;
			}

			// Skip type-only imports
			if (node.importKind === "type") {
				return false;
			}

			// Check if any specific named imports are allowlisted
			let hasClientDependency = false;

			for (const specifier of node.specifiers) {
				// Skip type-only imports
				if (specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === "type") {
					continue;
				}

				if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
					const importedName =
						specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : "";

					// If this specific import is allowlisted, skip it
					if (isExportAllowlisted(moduleSpecifier, importedName)) {
						continue;
					}

					// Trace dependencies if needed and within depth limit
					if (traceDependencies && traceDepth > currentTraceDepth) {
						try {
							// Resolve the module path
							const resolvedPath = resolveModulePath(moduleSpecifier);

							// Skip node_modules or ensure path exists
							if (resolvedPath && !isNodeModule(resolvedPath)) {
								// Check if this module is in our cache and hasn't been checked in this run
								if (!filesCheckedInThisRun.has(resolvedPath)) {
									if (clientSideDependencyCache.has(resolvedPath) && !hasFileChanged(resolvedPath)) {
										if (clientSideDependencyCache.get(resolvedPath)) {
											clientDependencies.push(
												`Import from client module: ${moduleSpecifier}.${importedName}`
											);
											hasClientDependency = true;
										}
									} else {
										// Analyze the dependency if not cached
										const depHasClientSide = analyzeModuleForClientDependencies(resolvedPath);
										if (depHasClientSide) {
											clientDependencies.push(
												`Import from client module: ${moduleSpecifier}.${importedName}`
											);
											hasClientDependency = true;
										}
									}
								}
							}
						} catch (_err: unknown) {
							// Continue with other attempts
						}
					}
				}
			}

			return hasClientDependency;
		}

		// Function to check dynamic imports
		function checkDynamicImport(node: TSESTree.Node): boolean {
			if (node.type !== AST_NODE_TYPES.ImportExpression) {
				return false;
			}

			// Check the source of the dynamic import
			if (node.source.type === AST_NODE_TYPES.Literal && typeof node.source.value === "string") {
				const moduleSpecifier = node.source.value;

				// Skip allowlisted modules
				if (isModuleAllowlisted(moduleSpecifier)) {
					return false;
				}

				// Check if it's a known client-only package
				if (isKnownClientOnlyPackage(moduleSpecifier)) {
					clientDependencies.push(`Dynamic import from client-only package: ${moduleSpecifier}`);
					hasDirectClientAPIs = true;
					return true;
				}

				// Trace dependencies if needed and within depth limit
				if (traceDependencies && traceDepth > currentTraceDepth) {
					try {
						// Resolve the module path
						const resolvedPath = resolveModulePath(moduleSpecifier);

						// Skip node_modules or ensure path exists
						if (resolvedPath && !isNodeModule(resolvedPath)) {
							// Check if this module is in our cache
							if (!filesCheckedInThisRun.has(resolvedPath)) {
								if (clientSideDependencyCache.has(resolvedPath) && !hasFileChanged(resolvedPath)) {
									if (clientSideDependencyCache.get(resolvedPath)) {
										clientDependencies.push(`Dynamic import from client module: ${moduleSpecifier}`);
										hasDirectClientAPIs = true;
										return true;
									}
								} else {
									// Analyze the dependency if not cached
									const depHasClientSide = analyzeModuleForClientDependencies(resolvedPath);
									if (depHasClientSide) {
										clientDependencies.push(`Dynamic import from client module: ${moduleSpecifier}`);
										hasDirectClientAPIs = true;
										return true;
									}
								}
							}
						}
					} catch (_err: unknown) {
						// Module resolution failed
					}
				}
			}

			return false;
		}

		// Function to check re-exports
		function checkExportFrom(node: TSESTree.Node): boolean {
			if (
				node.type !== AST_NODE_TYPES.ExportAllDeclaration &&
				!(node.type === AST_NODE_TYPES.ExportNamedDeclaration && node.source)
			) {
				return false;
			}

			const sourceValue = node.source.value;

			// Skip allowlisted modules
			if (isModuleAllowlisted(sourceValue)) {
				return false;
			}

			// Check if it's a known client-only package
			if (isKnownClientOnlyPackage(sourceValue)) {
				clientDependencies.push(`Re-export from client-only package: ${sourceValue}`);
				hasDirectClientAPIs = true;
				return true;
			}

			// Trace dependencies if needed and within depth limit
			if (traceDependencies && traceDepth > currentTraceDepth) {
				try {
					// Resolve the module path
					const resolvedPath = resolveModulePath(sourceValue);

					// Skip node_modules or ensure path exists
					if (resolvedPath && !isNodeModule(resolvedPath)) {
						// Check if this module is in our cache
						if (!filesCheckedInThisRun.has(resolvedPath)) {
							if (clientSideDependencyCache.has(resolvedPath) && !hasFileChanged(resolvedPath)) {
								if (clientSideDependencyCache.get(resolvedPath)) {
									clientDependencies.push(`Re-export from client module: ${sourceValue}`);
									hasDirectClientAPIs = true;
									return true;
								}
							} else {
								// Analyze the dependency if not cached
								const depHasClientSide = analyzeModuleForClientDependencies(resolvedPath);
								if (depHasClientSide) {
									clientDependencies.push(`Re-export from client module: ${sourceValue}`);
									hasDirectClientAPIs = true;
									return true;
								}
							}
						}
					}
				} catch (_err: unknown) {
					// Module resolution failed
				}
			}

			return false;
		}

		// Helper to resolve a module path
		function resolveModulePath(moduleSpecifier: string): string | null {
			// Simple relative path resolution
			if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
				const basedir = dirname(fileName);
				const extensions = [".ts", ".tsx", ".js", ".jsx"];

				// Try with the exact path first
				try {
					const exactPath = resolve(basedir, moduleSpecifier);
					if (existsSync(exactPath) && statSync(exactPath).isFile()) {
						return exactPath;
					}
				} catch (_err: unknown) {
					// Continue with other attempts
				}

				// Try with extensions
				for (const ext of extensions) {
					const fullPath = resolve(basedir, moduleSpecifier + ext);
					try {
						if (existsSync(fullPath)) {
							return fullPath;
						}
					} catch (_err: unknown) {
						// Try next extension
					}
				}

				// Try index files in directories
				try {
					const dirPath = resolve(basedir, moduleSpecifier);
					if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
						for (const ext of extensions) {
							const indexPath = join(dirPath, `index${ext}`);
							if (existsSync(indexPath)) {
								return indexPath;
							}
						}
					}
				} catch (_err: unknown) {
					// Failed to resolve as directory
				}
			}

			return null;
		}

		// Check if a path is a node_module
		function isNodeModule(modulePath: string): boolean {
			return modulePath.includes("node_modules");
		}

		// Analyze a module file for client dependencies
		function analyzeModuleForClientDependencies(filePath: string): boolean {
			// Avoid circular dependencies
			if (filesCheckedInThisRun.has(filePath)) {
				const cachedResult = getClientDependency(filePath);
				return cachedResult ?? false;
			}

			filesCheckedInThisRun.add(filePath);

			// Check cache first
			const cachedResult = getClientDependency(filePath);
			if (cachedResult !== null) {
				return cachedResult;
			}

			// Increment trace depth for recursive calls
			currentTraceDepth++;

			try {
				const ast = getFileAST(filePath);

				// If it has 'use client', it's definitely a client component
				if (ast.hasUseClient) {
					setClientDependency(filePath, true);
					currentTraceDepth--;
					return true;
				}

				// If we detected client code through regex
				if (ast.hasClientCode) {
					setClientDependency(filePath, true);
					currentTraceDepth--;
					return true;
				}

				// If there was an error parsing, be conservative
				if (ast.error) {
					// We don't cache errors since they might be temporary
					currentTraceDepth--;
					return false;
				}

				// If we got here, no client code was detected
				setClientDependency(filePath, false);
				currentTraceDepth--;
				return false;
			} catch (e) {
				// Error analyzing file
				console.error(`Error analyzing ${filePath}:`, e);
				currentTraceDepth--;
				return false;
			}
		}

		// Check if a component might be shared between client and server
		function isLikelySharedComponent(): boolean {
			// Has exports but no direct client APIs
			return hasExports && !hasDirectClientAPIs && clientDependencies.length === 0;
		}

		return {
			Program() {
				// Reset tracking state
				hasUseClientDirective = false;
				clientDependencies.length = 0;
				currentTraceDepth = 0;
				hasExports = false;
				hasDirectClientAPIs = false;
				filesCheckedInThisRun.clear();
			},

			// Check for 'use client' directive
			ExpressionStatement(node) {
				if (
					node.directive === "use client" ||
					(node.expression.type === AST_NODE_TYPES.Literal &&
						typeof node.expression.value === "string" &&
						node.expression.value === "use client")
				) {
					hasUseClientDirective = true;
				}
			},

			// Track exports for shared component detection
			ExportNamedDeclaration() {
				hasExports = true;
			},

			ExportDefaultDeclaration() {
				hasExports = true;
			},

			// Check React hooks and DOM APIs
			CallExpression(node) {
				checkNodeForClientAPIs(node);
			},

			// Check identifiers for DOM globals
			Identifier(node) {
				checkNodeForClientAPIs(node);
			},

			// Check member expressions for DOM APIs
			MemberExpression(node) {
				checkNodeForClientAPIs(node);
			},

			// Check JSX attributes for event handlers
			JSXAttribute(node) {
				checkNodeForClientAPIs(node);
			},

			// Check imports
			ImportDeclaration(node) {
				checkImportForClientDependencies(node);
			},

			// Check dynamic imports
			ImportExpression(node) {
				checkDynamicImport(node);
			},

			// Check if statements for client detection
			IfStatement(node) {
				checkNodeForClientAPIs(node);
			},

			// Check re-exports from other modules
			ExportAllDeclaration(node) {
				checkExportFrom(node);
			},

			// Report at the end of the file
			"Program:exit"() {
				// Cache this file's result for other files to use
				const needsUseClient = clientDependencies.length > 0;
				clientSideDependencyCache.set(fileName, needsUseClient);

				// Check for ESLint directive comments
				const comments = sourceCode.getAllComments();
				const hasDisableDirective = comments.some((comment) =>
					comment.value.trim().includes("check-use-client-disable")
				);

				// Check if this might be a shared component
				const isShared = isLikelySharedComponent();

				if (needsUseClient && !hasUseClientDirective && !hasDisableDirective) {
					context.report({
						node: sourceCode.ast,
						messageId: "missingUseClient",
						fix: (fixer) => {
							// Add 'use client'; at the beginning of the file
							return fixer.insertTextBefore(sourceCode.ast, "'use client';\n\n");
						}
					});

					// Report each individual dependency for better feedback
					for (const dep of clientDependencies) {
						context.report({
							node: sourceCode.ast,
							messageId: "detectedClientDep",
							data: {
								dependency: dep
							}
						});
					}
				} else if (isShared) {
					// If it looks like a shared component, suggest creating separate versions
					context.report({
						node: sourceCode.ast,
						messageId: "sharedComponent"
					});
				}
			},

			// Additional check for named exports with source
			"ExportNamedDeclaration:exit"(node) {
				if (node.source) {
					checkExportFrom(node);
				}
			}
		};
	}
});
