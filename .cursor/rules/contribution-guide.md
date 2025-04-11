# Contribution Guide

This document provides guidelines for contributors to the ESLint plugin for React 19's "use client" directive.

## Development Prerequisites

Before starting development, ensure you have:

1. **Node.js**: v18+ recommended
2. **pnpm**: Our package manager of choice
3. **Git**: For version control
4. **Code Editor**: VS Code recommended with our workspace settings

## Getting Started

### Setting Up the Development Environment

1. **Clone the Repository**

   ```bash
   git clone https://github.com/spencerbeggs/eslint-plugin-use-client.git
   cd eslint-plugin-use-client
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Set Up Git Hooks**

   Husky is set up automatically during installation to enforce commit conventions and run pre-commit checks.

4. **Run Initial Build**

   ```bash
   pnpm run build
   ```

5. **Run Tests**

   ```bash
   pnpm run test
   ```

## Development Workflow

### Branching Strategy

We follow a simple branching model:

- `main`: Stable, released code
- `feature/*`: New features and enhancements
- `fix/*`: Bug fixes
- `docs/*`: Documentation changes
- `refactor/*`: Code refactoring with no functionality changes

```bash
# Create a new feature branch
git checkout -b feature/new-rule-implementation
```

### Making Changes

1. **Implement Changes**

   Make your changes, following our code style and best practices.

2. **Add Tests**

   Ensure your changes have appropriate test coverage:

   ```bash
   pnpm run test:watch
   ```

3. **Run Linting**

   Ensure code style consistency:

   ```bash
   pnpm run lint
   ```

4. **Create a Changeset**

   Document your changes for release notes:

   ```bash
   pnpm changeset
   ```

   Follow the prompts to describe your changes and select the appropriate semver bump.

### Committing Changes

We use [Conventional Commits](https://www.conventionalcommits.org/) for our commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types include:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc)
- **refactor**: Code changes that neither fix bugs nor add features
- **perf**: Performance improvements
- **test**: Adding or correcting tests
- **chore**: Changes to the build process, tools, etc.

Examples:

```
feat(rules): add use-client-directive rule

Adds a new rule to detect missing use client directives in React components 
that use client-side features like hooks and event handlers.

Fixes #123
```

```
fix(ast): correct detection of browser APIs

Improves the AST traversal pattern for detecting browser API usage to 
reduce false positives.
```

### Pull Request Process

1. **Push Your Branch**

   ```bash
   git push -u origin feature/your-feature-name
   ```

2. **Create a Pull Request**

   Create a PR against the `main` branch with a clear title and description.

3. **CI Validation**

   Ensure all CI checks pass on your PR:
   - Linting
   - Tests
   - Build verification
   - Commit message validation

4. **Code Review**

   Address any feedback from reviewers.

5. **Merge**

   Once approved, your PR will be merged by a maintainer.

## Code Standards

### TypeScript Guidelines

- Use explicit typing when TypeScript cannot infer types
- Avoid `any` types when possible
- Use interfaces for public APIs and types for internal use
- Follow [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

### ESLint Rule Development

- Each rule should have a clear, focused purpose
- Rules should include comprehensive tests for valid and invalid cases
- Include helpful error messages with suggestions for fixing
- Implement automated fixes when possible

```typescript
// Good rule structure
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure React components with client features have "use client" directive',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      missingDirective: 'Component with {{ features }} requires "use client" directive',
      incorrectPosition: '"use client" directive must be at the top of the file',
    },
    schema: [], // or configuration options schema
  },
  
  create(context) {
    // Implementation
  }
};
```

### Testing Guidelines

- Write tests for both valid and invalid cases
- Test edge cases and common patterns
- Verify autofix functionality
- Use descriptive test names

```typescript
// Good test structure
ruleTester.run('use-client-directive', rule, {
  valid: [
    {
      code: `"use client";\nimport { useState } from 'react';\n// Valid component`,
      filename: 'component.tsx',
    },
    // More valid cases...
  ],
  invalid: [
    {
      code: `import { useState } from 'react';\n// Invalid component`,
      filename: 'component.tsx',
      errors: [
        {
          messageId: 'missingDirective',
          data: { features: 'hooks' },
        },
      ],
      output: `"use client";\n\nimport { useState } from 'react';\n// Invalid component`,
    },
    // More invalid cases...
  ],
});
```

## Documentation Guidelines

### Rule Documentation

Each rule should have documentation that includes:

1. **Purpose**: What the rule enforces
2. **Rationale**: Why the rule is important
3. **Examples**: Valid and invalid code examples
4. **Options**: Configuration options (if any)
5. **When Not To Use It**: Scenarios where the rule might not be appropriate
6. **Version**: When the rule was added or significantly changed

### CHANGELOG Entries

Describe changes clearly for users:

```markdown
## 1.2.0

### Added
- New `enforce-client-directive` rule to detect components using client features without the directive

### Fixed
- Improved detection of React hooks in the `use-client-directive` rule
```

## Release Process

Contributors don't need to handle releases, but should be aware of our release process:

1. Changes merged to `main` trigger our release workflow
2. Version numbers and changelogs are generated from changesets
3. Packages are published to npm automatically
4. GitHub releases are created with release notes

## Getting Help

If you need assistance:

- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Pull Requests**: Ask for help in PR comments for implementation questions

## Troubleshooting

Common issues and solutions:

- **Failed Tests**: Run `pnpm run test:watch` for detailed error information
- **Linting Errors**: Run `pnpm run lint --fix` to automatically fix some issues
- **Build Errors**: Check TypeScript errors with `pnpm run build -- --verbose`
- **Git Hook Issues**: Run `pnpm husky install` to reinstall hooks

## Code of Conduct

We follow the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please review it before contributing.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

Thank you for contributing to our ESLint plugin for React 19's "use client" directive!
