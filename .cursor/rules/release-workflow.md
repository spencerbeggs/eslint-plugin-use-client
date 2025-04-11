# Release Workflow

This document outlines the GitHub Actions workflows for building, testing, and releasing our ESLint plugin for React 19's "use client" directive.

## Release Philosophy

Our release workflow follows these principles:

1. **Automation**: Minimize manual steps in the release process
2. **Quality Assurance**: Ensure code passes all tests and lints before release
3. **Semantic Versioning**: Follow [semver](https://semver.org/) for version numbering
4. **Comprehensive Changelogs**: Automatically generate detailed changelogs
5. **Reproducible Builds**: Ensure consistent build outputs

## GitHub Actions Workflows

### Pull Request Validation

On each pull request, we run a validation workflow:

```yaml
# .github/workflows/pr-validation.yml
name: PR Validation

on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install
      - name: Lint code
        run: pnpm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install
      - name: Build
        run: pnpm run build
      - name: Test
        run: pnpm run test
        
  commit-message:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: wagoid/commitlint-github-action@v5
        
  summary:
    needs: [lint, test, commit-message]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check workflow status
        run: |
          if [[ "${{ needs.lint.result }}" != "success" || \
                "${{ needs.test.result }}" != "success" || \
                "${{ needs.commit-message.result }}" != "success" ]]; then
            echo "One or more jobs failed"
            exit 1
          fi
```

### Build and Release

When changes are merged to main, our release workflow is triggered:

```yaml
# .github/workflows/release.yml
name: Build and Release

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install
      - name: Build
        run: pnpm run build
      - name: Test
        run: pnpm run test
      - name: Upload build artifacts
        uses: actions/upload-artifact@v2
        with:
          name: dist
          path: pkg/dist
          retention-days: 1
          
  release:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
      - name: Install dependencies
        run: pnpm install
      - name: Download build artifacts
        uses: actions/download-artifact@v2
        with:
          name: dist
          path: pkg/dist
      - name: Configure Git
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
      - name: Version and publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Versioning with Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs:

### Adding a Changeset

When making changes, developers create a changeset to document changes:

```bash
# Add a changeset for feature/fix
pnpm changeset
```

This creates a file in the `.changeset` directory describing the change:

```md
---
"@spencerbeggs/eslint-plugin-use-client": minor
---

Added new rule to detect unnecessary "use client" directives
```

### Version Types

We follow semantic versioning:

- **patch**: Bug fixes and minor changes
- **minor**: New features, non-breaking changes
- **major**: Breaking changes

### Automated Changelog Generation

Changesets automatically generate changelogs based on commit messages and changeset files.

## Release Process

The release process follows these steps:

1. **Pull Request**: Developer submits a PR with changes and a changeset
2. **Validation**: GitHub Actions runs tests, lints, and checks
3. **Review**: Code is reviewed and approved by maintainers
4. **Merge**: Changes are merged to main branch
5. **Build**: GitHub Actions builds the package
6. **Version Bump**: Changesets updates version based on changesets
7. **Changelog Update**: Changelog is automatically updated
8. **NPM Publish**: Package is published to NPM
9. **GitHub Release**: A GitHub release is created with release notes
10. **Tag**: A Git tag is created for the version

## Package.json Configuration

Our package.json is configured to support this workflow:

```json
{
  "scripts": {
    "release": "turbo run build lint test && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.26.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

## Handling Prerelease Versions

For prerelease versions (alpha, beta, rc), we use the following process:

```bash
# Enter prerelease mode
pnpm changeset pre enter alpha

# Add changesets as normal
pnpm changeset

# Version and publish prereleases
pnpm run release

# Exit prerelease mode when ready for stable
pnpm changeset pre exit
```

## CI Environment Setup

Our CI environment is configured with necessary secrets:

1. **NPM_TOKEN**: For publishing to NPM
2. **GITHUB_TOKEN**: For creating releases and interacting with the repo

## Manual Release (if needed)

In case automatic releases fail, here's the manual process:

```bash
# 1. Checkout main
git checkout main
git pull

# 2. Build the package
pnpm run build

# 3. Run tests
pnpm run test

# 4. Version based on changesets
pnpm changeset version

# 5. Update package.json in build output
node scripts/update-dist-package.js

# 6. Publish
pnpm publish

# 7. Push changes
git push --follow-tags
```

## Post-Release Tasks

After a release:

1. **Release Notes**: Verify the GitHub release notes
2. **Documentation**: Ensure docs are updated for the new version
3. **Announcements**: Post announcements in relevant channels

## Best Practices

1. **Descriptive Commit Messages**: Follow conventional commits for clarity
2. **Comprehensive Changesets**: Document all noteworthy changes
3. **Test Before Release**: Ensure all tests pass before publishing
4. **Pin Dependencies**: Use exact versions for dependencies
5. **Release Notes**: Write clear, user-focused release notes

By following this workflow, we ensure consistent, high-quality releases of our ESLint plugin for React 19's "use client" directive.
