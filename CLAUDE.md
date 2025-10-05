# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub Project Status Viewer is a Chrome browser extension that displays GitHub Projects V2 status badges directly in repository issue lists. It uses the GitHub GraphQL API to fetch project status information and dynamically renders color-coded badges next to each issue.

## Build Commands

The project uses `just` as the task runner (not npm scripts directly):

```bash
# Install dependencies
just deps

# Build for production (compiles TypeScript and copies public files to dist/)
just build

# Development watch mode (TypeScript only)
just watch

# Type checking without emitting files
just typecheck

# Clean build artifacts
just clean

# Full rebuild
just rebuild
```

Note: `yarn` is the package manager (yarn@1.22.19), but use `just` commands for development tasks.

## Architecture

### Three-Component Extension Pattern

The extension follows Chrome Manifest V3 architecture with three distinct components that communicate via message passing:

1. **Content Script** (`src/content.ts`)
   - Runs on GitHub issue list pages matching `https://github.com/*/*/issues*`
   - DOM manipulation: Parses issue numbers from `[data-testid="issue-pr-title-link"]` elements
   - Uses MutationObserver to detect dynamic page updates
   - Sends requests to background script via `chrome.runtime.sendMessage`
   - Renders status badges by injecting `<span class="project-status-badge">` elements

2. **Service Worker** (`src/background.ts`)
   - Handles GraphQL API communication with GitHub
   - Dynamically builds queries for multiple issues using aliases (e.g., `issue0: issue(number: 1)`)
   - Authenticates with GitHub Personal Access Token from chrome.storage.sync
   - Extracts status from `ProjectV2ItemFieldSingleSelectValue` nodes
   - Returns status map to content script

3. **Popup UI** (`src/popup.ts`)
   - Simple configuration interface for storing GitHub PAT
   - Persists configuration to chrome.storage.sync
   - No direct communication with content script or background worker

### Key Data Flow

```
User visits GitHub issues page
  → Content script parses issue numbers from DOM
  → Sends {type: "GET_PROJECT_STATUS", owner, repo, issueNumbers} to background
  → Background builds GraphQL query with issue aliases
  → Queries GitHub API for projectItems.fieldValues where field.name === "Status"
  → Returns [{number, status}] to content script
  → Content script injects badges next to issue titles
```

### GraphQL Query Pattern

The extension builds dynamic queries with issue aliases to fetch multiple issues in a single request:

```graphql
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    issue0: issue(number: 123) {
      number
      projectItems(first: 10) {
        nodes {
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { name }
              }
            }
          }
        }
      }
    }
    issue1: issue(number: 124) { ... }
  }
}
```

## Code Style Requirements

From `.claude/CODING_GUIDE.md`:

- **Types over Interfaces**: Always use `type` instead of `interface`
- **Arrow functions**: Use arrow functions outside of classes
- **IIFE pattern**: All entry point files wrap code in `(() => { ... })()` to avoid global scope pollution
- **Alphabetical ordering**: Sort object properties, types, and interfaces alphabetically
- **Early returns**: Minimize conditional depth with early returns
- **Constants**: Extract magic values to named constants (e.g., `STATUS_FIELD_NAME = "Status"`)
- **No any types**: Avoid unsafe type systems
- **Minimal comments**: Write self-documenting code

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Output: `./dist` directory
- Source: `./src` directory

## Testing Workflow

There are no automated tests currently. Manual testing requires:

1. Build the extension: `just build`
2. Load unpacked extension from `dist/` folder in Chrome
3. Configure GitHub PAT in extension popup
4. Navigate to any GitHub repo's issues page
5. Verify badges appear next to issues with project assignments

## Important Implementation Details

- **Status field detection**: Only shows status from the FIRST connected project per issue
- **Supported statuses**: "Backlog", "Ready", "In progress", "In review", "Done"
- **GitHub Projects V2 only**: Does not support legacy Projects (V1)
- **Badge deduplication**: Checks for existing `.project-status-badge` before injecting
- **Error handling**: Background script logs GraphQL errors but gracefully degrades in content script
