import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

// List of known client-only packages
export const clientOnlyPackages = [
	"react-dom",
	"@radix-ui/",
	"@headlessui/",
	"framer-motion",
	"react-spring",
	"react-modal",
	"react-select",
	"react-table",
	"react-hook-form",
	"react-query",
	"swr",
	"react-dnd",
	"react-draggable",
	"react-resizable",
	"react-beautiful-dnd"
];

// Server-safe hooks that don't require 'use client'
export const serverSafeHooks = [
	"useId",
	"useMemo",
	"useCallback",
	"use", // The new use hook for promises
	"useContext",
	"useDebugValue",
	"useReducer",
	"useRef"
];

// Client-only hooks that require 'use client'
export const clientOnlyHooks = [
	"useEffect",
	"useLayoutEffect",
	"useState",
	"useSyncExternalStore",
	"useTransition",
	"useImperativeHandle",
	"useDeferredValue",
	"useInsertionEffect"
];

// DOM APIs that require 'use client'
export const browserAPIs = [
	"window",
	"document",
	"navigator",
	"localStorage",
	"sessionStorage",
	"history",
	"location",
	"alert",
	"confirm",
	"prompt",
	"fetch",
	"XMLHttpRequest",
	"WebSocket",
	"IntersectionObserver",
	"ResizeObserver",
	"MutationObserver"
];

interface ModuleCategories {
	clientModules: string[];
	serverModules: string[];
	sharedModules: string[];
	clientOnlyHooks: string[];
	serverSafeHooks: string[];
}

// Load module categories from config file
export function loadModuleCategories(): ModuleCategories {
	try {
		const configPath = join(process.cwd(), "use-client-config.json");
		if (existsSync(configPath)) {
			return JSON.parse(readFileSync(configPath, "utf8")) as ModuleCategories;
		}
	} catch (_err) {
		console.info("No use-client-config.json file found, using defaults");
		// Fallback to defaults
	}
	return {
		clientModules: [],
		serverModules: [],
		sharedModules: [],
		clientOnlyHooks: [],
		serverSafeHooks: []
	};
}

// Check if a node is a client detection condition (typeof window !== 'undefined')
export function isClientDetectionCondition(node: TSESTree.Node): boolean {
	if (node.type === AST_NODE_TYPES.BinaryExpression && ["!==", "!="].includes(node.operator)) {
		// Check left side: typeof window
		const isLeftTypeofWindow =
			node.left.type === AST_NODE_TYPES.UnaryExpression &&
			node.left.operator === "typeof" &&
			node.left.argument.type === AST_NODE_TYPES.Identifier &&
			node.left.argument.name === "window";

		// Check right side: 'undefined'
		const isRightUndefined = node.right.type === AST_NODE_TYPES.Literal && node.right.value === "undefined";

		return (isLeftTypeofWindow && isRightUndefined) || (isRightUndefined && isLeftTypeofWindow);
	}

	return false;
}

// Check if a node is a hook call (camelCase starting with 'use')
export function isHookCall(node: TSESTree.Node): boolean {
	if (node.type === AST_NODE_TYPES.CallExpression && node.callee.type === AST_NODE_TYPES.Identifier) {
		const name = node.callee.name;
		return name.startsWith("use") && name.length > 3 && name[3] === name[3].toUpperCase();
	}
	return false;
}

// Check if the content might be compiled client code
export function mightBeCompiledClientCode(content: string): boolean {
	// Look for telltale signs of bundled client code
	return (
		/\bwindow\b.*=.*this\b/.test(content) ||
		/\bdocument\b.*=.*this\.\w+/.test(content) ||
		/typeof\s+window\s*!==?\s*['"]undefined['"]/.test(content)
	);
}

// Cache to store AST data for files
// Define a proper type for our AST analysis results
export interface FileAnalysisResult {
	// Whether the file has 'use client' directive
	hasUseClient?: boolean;
	// Whether the file has client-side code (DOM APIs, etc.)
	hasClientCode?: boolean;
	// Whether there was an error analyzing the file
	error?: boolean;
	// When the file was last analyzed (for debugging)
	analyzedAt?: number;
}

// Cache to store AST data for files
const astCache = new Map<string, FileAnalysisResult>();

// Cache of analyzed modules to avoid repeated work
export const clientSideDependencyCache = new Map<string, boolean>();

// Store file modification timestamps
const fileTimestamps = new Map<string, number>();

/**
 * Checks if a file has changed since it was last cached
 */
export function hasFileChanged(filePath: string): boolean {
	try {
		const stats = statSync(filePath);
		const lastMod = stats.mtimeMs;

		if (fileTimestamps.has(filePath) && fileTimestamps.get(filePath) === lastMod) {
			return false;
		}

		fileTimestamps.set(filePath, lastMod);
		return true;
	} catch (err: unknown) {
		console.warn(`Error checking if file ${filePath} has changed:`, err);
		return true; // If we can't check, assume changed
	}
}

// Update the getFileAST function to use the proper type
export function getFileAST(filePath: string): FileAnalysisResult {
	// Return from cache if available and file hasn't changed
	if (astCache.has(filePath) && !hasFileChanged(filePath)) {
		const cached = astCache.get(filePath);
		if (cached) {
			return cached;
		}
	}

	try {
		const content = readFileSync(filePath, "utf8");
		const result: FileAnalysisResult = {
			hasUseClient: false,
			hasClientCode: false,
			analyzedAt: Date.now()
		};

		// Check for use client directive
		if (content.includes("'use client'") || content.includes('"use client"')) {
			result.hasUseClient = true;
			astCache.set(filePath, result);
			return result;
		}

		// Check for compiled client code
		if (mightBeCompiledClientCode(content)) {
			result.hasClientCode = true;
			astCache.set(filePath, result);
			return result;
		}

		// Simple regex checks for DOM APIs
		for (const api of browserAPIs) {
			const regex = new RegExp(`\\b${api}\\b`, "g");
			if (regex.test(content)) {
				result.hasClientCode = true;
				astCache.set(filePath, result);
				return result;
			}
		}

		// Check for client-only hooks
		for (const hook of clientOnlyHooks) {
			const regex = new RegExp(`\\b${hook}\\b`, "g");
			if (regex.test(content)) {
				result.hasClientCode = true;
				astCache.set(filePath, result);
				return result;
			}
		}

		// If no client code detected
		astCache.set(filePath, result);
		return result;
	} catch (_err) {
		const errorResult: FileAnalysisResult = {
			error: true,
			analyzedAt: Date.now()
		};
		// We don't cache errors
		return errorResult;
	}
}

/**
 * Gets cached client dependency analysis or checks file if needed
 */
export function getClientDependency(filePath: string): boolean | null {
	if (clientSideDependencyCache.has(filePath) && !hasFileChanged(filePath)) {
		return clientSideDependencyCache.get(filePath) ?? false;
	}
	return null; // Cache miss, needs fresh analysis
}

/**
 * Sets client dependency analysis result in cache
 */
export function setClientDependency(filePath: string, isClientSide: boolean): void {
	clientSideDependencyCache.set(filePath, isClientSide);
}

/**
 * Clears all analysis caches
 */
export function clearCaches(): void {
	astCache.clear();
	clientSideDependencyCache.clear();
	fileTimestamps.clear();
}
