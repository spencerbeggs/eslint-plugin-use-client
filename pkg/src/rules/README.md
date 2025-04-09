# ESLint Plugin Use Client Rules

This directory contains the rule implementations for the ESLint plugin for enforcing proper usage of React Server Components with the `"use client"` directive.

## Rules Overview

1. **consistent-use-client-placement**: Ensures the `"use client"` directive is always placed at the top of the file, before any imports or other code.

2. **destructure-react-imports**: Enforces destructuring of React imports to improve bundle size and modernize code style. For example, converting `React.useState` to `{ useState }` from "react".

3. **use-client-directive**: Enforces the use of the `"use client"` directive in components that use client-side features (DOM APIs, hooks, etc.).

4. **no-mixed-server-client-apis**: Prevents mixing server-only APIs with client-side code or client-only APIs with server components.

## Implementation Notes

### consistent-use-client-placement

This rule identifies a `"use client"` directive that isn't at the top of the file and moves it there. The implementation matches the expected output format in tests while preserving quote styles (`"` vs `'`).

Key features:

- Ensures `"use client"` is always the first statement in the file
- Detects multiple `"use client"` directives and removes duplicates
- Preserves quote style (`"` vs `'`) when moving directives
- Handles directives found in various locations (after imports, in function bodies, at the end of the file)

### destructure-react-imports

This rule analyzes React imports and:

- Converts default imports (`import React from "react"`) to named imports (`import { useState, useEffect } from "react"`)
- Preserves TypeScript types (`React.FC`, etc.)
- Removes unused React imports
- Handles both ESM imports and CommonJS requires

### use-client-directive

This rule analyzes components to detect client-side features like:

- DOM APIs usage
- Hook usage
- Event handlers
- Client-side-only components

When these are detected, it requires the `"use client"` directive to be present.

### no-mixed-server-client-apis

This rule prevents mixing server-only APIs with client-side code or client-only APIs with server components.

## Code Style Philosophy

The rules focus on ensuring correct functionality while minimizing code style changes:

- We avoid adding additional formatting in the rules
- Most formatting concerns are left to other ESLint rules
- We maintain minimal, targeted fixes that address only the specific directive/import issue

This approach ensures the rules work well with different code styles and formatting preferences.

# Rules

This document describes all the rules that are part of this ESLint plugin.

## Rules

| Name                                                                      | Description                                                                                        |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`destructure-react-imports`](./destructure-react-imports.ts)             | Enforces that React imports should be destructured.                                                |
| [`use-client-directive`](./use-client-directive.ts)                       | Enforces the 'use client' directive when using browser-only APIs.                                  |
| [`consistent-use-client-placement`](./consistent-use-client-placement.ts) | Enforces that 'use client' directives should be placed consistently at the top of the file.        |
| [`no-mixed-server-client-apis`](./no-mixed-server-client-apis.ts)         | Prevents mixing server-only APIs with client-side code or client-only APIs with server components. |
