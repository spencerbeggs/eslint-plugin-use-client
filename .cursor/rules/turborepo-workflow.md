# Turborepo Workflow

This document outlines how we use Turborepo to orchestrate tasks in our ESLint plugin monorepo for React 19's "use client" directive.

## Turborepo Overview

[Turborepo](https://turbo.build/) is a high-performance build system for JavaScript and TypeScript monorepos. Key benefits include:

1. **Incremental Builds**: Avoids redundant work by caching previous executions
2. **Parallel Execution**: Runs tasks in parallel for faster builds
3. **Task Dependencies**: Defines how tasks depend on each other
4. **Selective Execution**: Runs tasks only for affected packages

## Repository Structure

Our monorepo is structured for clarity and maintainability:

```
/
├── .github/                 # GitHub Actions workflows
├── .husky/                  # Git hooks
├── pkg/                     # Main package
│   ├── __tests__/           # Test files
│   ├── src/                 # Source code
│   ├── package.json         # Package-specific configuration
│   └── turbo.json           # Package-specific tasks
├── turbo/                   # Shared Turborepo scripts
│   └── scripts/             # Helper scripts
├── package.json             # Root package.json
└── turbo.json               # Root Turborepo configuration
```

## Root Turborepo Configuration

The root `turbo.json` defines global pipeline configurations:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "__tests__/**/*.ts"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

Key concepts in this configuration:

- `globalDependencies`: Files that affect all tasks
- `dependsOn`: Task dependencies (e.g., test depends on build)
- `outputs`: Generated files to cache
- `inputs`: Files that affect task execution
- `cache`: Whether to cache results

## Workspace-Specific Configuration

Each workspace (package) can have its own `turbo.json` for package-specific settings:

```json
// pkg/turbo.json
{
  "extends": ["//"],
  "pipeline": {
    "build": {
      "outputs": ["dist/**"],
      "dependsOn": ["^build"]
    }
  }
}
```

## Root Package.json Scripts

Our root `package.json` defines scripts that leverage Turborepo:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "clean": "turbo run clean",
    "release": "turbo run build lint test && changeset publish"
  }
}
```

## Workspace Package.json Scripts

Each workspace has its own scripts:

```json
// pkg/package.json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint ./src --ext .ts,.tsx",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rimraf .turbo dist coverage"
  }
}
```

## Task Execution Flow

Here's how Turborepo executes tasks:

1. **Dependency Resolution**: Builds a directed acyclic graph (DAG) of task dependencies
2. **Caching Check**: Checks if tasks can be skimmed from cache
3. **Parallel Execution**: Runs non-dependent tasks in parallel
4. **Caching Results**: Stores successful task results in cache

## Common Workflows

### Development Workflow

During development, we use:

```bash
# Run development server with watch mode
npm run dev

# Run tests in watch mode
npm run test:watch -- --filter=pkg
```

### CI Workflow

In continuous integration:

```bash
# Full validation
npm run build
npm run lint
npm run test
```

### Release Workflow

For releases:

```bash
# Create release
npm run release
```

## Turborepo Cache

Turborepo maintains a local cache to speed up builds:

- **Location**: `.turbo` directory (gitignored)
- **Remote Cache**: Can be configured for team sharing
- **Pruning**: Use `npx turbo prune` to remove old cache entries

## Filtering Tasks

You can filter which packages/tasks to run:

```bash
# Run build only for the pkg package
npx turbo run build --filter=pkg

# Run build for packages affected by changes
npx turbo run build --filter=...[main]
```

## Task Orchestration Scripts

We use custom scripts in the `turbo/scripts` directory to enhance workflow:

```typescript
// turbo/scripts/toggle-vscode-settings.ts
import * as fs from 'fs';
import * as path from 'path';

// Toggle specific VS Code settings
const settingsPath = path.resolve(__dirname, '../../.vscode/settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

// Toggle search and file excludes
settings['search.exclude']['.turbo'] = !settings['search.exclude']['.turbo'];
settings['files.exclude']['.turbo'] = !settings['files.exclude']['.turbo'];

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('VS Code settings toggled successfully');
```

Run these scripts with:

```bash
npx tsx turbo/scripts/toggle-vscode-settings.ts
```

## Environment Variable Handling

Turborepo respects environment variables:

- **Global Environment**: Variables defined in `.env` 
- **Task-specific**: Variables defined in `.env.{taskname}`
- **CLI Passthrough**: Variables passed via command line

```bash
# Pass environment variable
NODE_ENV=production npx turbo run build
```

## GitHub Actions Integration

Our GitHub Actions workflows use Turborepo for CI:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Test
        run: npm run test
      # Cache Turborepo outputs
      - name: Cache Turborepo
        uses: actions/cache@v3
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-turbo-
```

## Troubleshooting Common Issues

- **Cache Invalidation**: Use `turbo run clean` to clear cache
- **Task Dependency Errors**: Check the `dependsOn` configuration
- **Missing Outputs**: Verify `outputs` paths are correctly defined
- **Performance Issues**: Use `--profile` flag to generate trace

## Best Practices

1. **Clear Dependencies**: Accurately define task dependencies
2. **Minimal Caching**: Only cache necessary outputs
3. **Consistent Scripts**: Use the same script names across packages
4. **Proper Filtering**: Use filtering for focused development
5. **Remote Caching**: Configure remote caching for team efficiency

By leveraging Turborepo effectively, we maintain a fast, efficient workflow for developing our ESLint plugin, allowing developers to focus on implementing rules rather than build infrastructure.
