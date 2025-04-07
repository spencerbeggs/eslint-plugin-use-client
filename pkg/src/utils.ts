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
	const defaultConfig: ModuleCategories = {
		clientModules: [],
		serverModules: [],
		sharedModules: [],
		clientOnlyHooks: [],
		serverSafeHooks: []
	};

	try {
		const configPath = join(process.cwd(), "use-client-config.json");
		if (existsSync(configPath)) {
			const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
			// Validate the shape of the config object
			if (
				typeof parsed === "object" &&
				parsed !== null &&
				"clientModules" in parsed &&
				"serverModules" in parsed &&
				"sharedModules" in parsed &&
				"clientOnlyHooks" in parsed &&
				"serverSafeHooks" in parsed &&
				Array.isArray((parsed as ModuleCategories).clientModules) &&
				Array.isArray((parsed as ModuleCategories).serverModules) &&
				Array.isArray((parsed as ModuleCategories).sharedModules) &&
				Array.isArray((parsed as ModuleCategories).clientOnlyHooks) &&
				Array.isArray((parsed as ModuleCategories).serverSafeHooks)
			) {
				return parsed as ModuleCategories;
			}
			// If validation fails, return defaults
			return defaultConfig;
		}
	} catch (_err) {
		console.info("No use-client-config.json file found, using defaults");
		// Fallback to defaults
	}
	return defaultConfig;
}

// Check if a node is a client detection condition (typeof window !== 'undefined')
export function isClientDetectionCondition(node: TSESTree.Node): boolean {
	if (node.type === AST_NODE_TYPES.BinaryExpression && ["!==", "!="].includes(node.operator)) {
		// Check for typeof window
		const isTypeofWindow = (node: TSESTree.Node): boolean =>
			node.type === AST_NODE_TYPES.UnaryExpression &&
			node.operator === "typeof" &&
			node.argument.type === AST_NODE_TYPES.Identifier &&
			node.argument.name === "window";

		// Check for 'undefined' literal
		const isUndefinedLiteral = (node: TSESTree.Node): boolean =>
			node.type === AST_NODE_TYPES.Literal && node.value === "undefined";

		// Check both orders: typeof window !== 'undefined' and 'undefined' !== typeof window
		return (
			(isTypeofWindow(node.left) && isUndefinedLiteral(node.right)) ||
			(isUndefinedLiteral(node.left) && isTypeofWindow(node.right))
		);
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
		/typeof\s+window\s*!==?\s*['"]undefined['"]/.test(content) ||
		/['"]undefined['"]\s*!==?\s*typeof\s+window/.test(content)
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

// Cache for file ASTs
export const astCache = new Map<string, FileAnalysisResult>();

// Cache for client-side dependency analysis
export const clientSideDependencyCache = new Map<string, boolean>();

// Cache for file timestamps
export const fileTimestamps = new Map<string, number>();

/**
 * Check if a file has been modified since last check
 */
export function hasFileChanged(filePath: string): boolean {
	try {
		// If file doesn't exist or there's an error, consider it changed
		if (!existsSync(filePath)) {
			return true;
		}

		const stats = statSync(filePath);
		const lastModified = stats.mtimeMs;
		const lastKnownModified = fileTimestamps.get(filePath);

		if (lastKnownModified === undefined || lastModified > lastKnownModified) {
			fileTimestamps.set(filePath, lastModified);
			return true;
		}

		return false;
	} catch (_err) {
		// If there's an error checking the file, consider it changed
		return true;
	}
}

/**
 * Gets AST for a file with caching
 */
export function getFileAST(filePath: string): FileAnalysisResult {
	// Return from cache if available and file hasn't changed
	if (astCache.has(filePath) && !hasFileChanged(filePath)) {
		const cached = astCache.get(filePath);
		if (cached) {
			return cached;
		}
	}

	try {
		// If file doesn't exist, return error result
		if (!existsSync(filePath)) {
			return {
				error: true,
				hasUseClient: undefined,
				hasClientCode: undefined
			};
		}

		const fileContent = readFileSync(filePath, "utf8");
		const result: FileAnalysisResult = {
			hasUseClient: fileContent.includes("'use client'") || fileContent.includes('"use client"'),
			hasClientCode: false
		};

		// Check for compiled client code
		if (mightBeCompiledClientCode(fileContent)) {
			result.hasClientCode = true;
			astCache.set(filePath, result);
			return result;
		}

		// Check for browser APIs
		for (const api of browserAPIs) {
			const regex = new RegExp(`\\b${api}\\b`, "g");
			if (regex.test(fileContent)) {
				result.hasClientCode = true;
				astCache.set(filePath, result);
				return result;
			}
		}

		// Check for client-only hooks
		for (const hook of clientOnlyHooks) {
			const regex = new RegExp(`\\b${hook}\\b`, "g");
			if (regex.test(fileContent)) {
				result.hasClientCode = true;
				astCache.set(filePath, result);
				return result;
			}
		}

		// If no client code detected
		astCache.set(filePath, result);
		return result;
	} catch (_err) {
		return {
			error: true,
			hasUseClient: undefined,
			hasClientCode: undefined
		};
	}
}

/**
 * Gets cached client dependency analysis or checks file if needed
 */
export function getClientDependency(filePath: string): boolean | null {
	// If the file is in cache, check if it has changed
	if (clientSideDependencyCache.has(filePath)) {
		// For non-existent files, return the cached value
		if (!existsSync(filePath)) {
			return clientSideDependencyCache.get(filePath) ?? false;
		}
		if (hasFileChanged(filePath)) {
			// If file has changed, remove from cache and return null
			clientSideDependencyCache.delete(filePath);
			return null;
		}
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		return clientSideDependencyCache.get(filePath) || false;
	}
	return null;
}

/**
 * Handle error when setting timestamp
 */
function handleTimestampError(filePath: string): void {
	console.info("Error setting timestamp for file", filePath);
	fileTimestamps.delete(filePath);
}

/**
 * Sets client dependency analysis result in cache
 */
export function setClientDependency(filePath: string, isClientSide: boolean): void {
	clientSideDependencyCache.set(filePath, isClientSide);
	// Update timestamp for the file to prevent hasFileChanged from returning true
	if (existsSync(filePath)) {
		try {
			const stats = statSync(filePath);
			fileTimestamps.set(filePath, stats.mtimeMs);
		} catch (_err) {
			handleTimestampError(filePath);
		}
	}
}

/**
 * Clears all analysis caches
 */
export function clearCaches(): void {
	astCache.clear();
	clientSideDependencyCache.clear();
	fileTimestamps.clear();
}
