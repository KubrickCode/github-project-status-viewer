# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**CRITICAL**

- Always update CLAUDE.md and README.md When changing a feature that requires major work or essential changes to the content of the document. Ignore minor changes.
- Never create branches or make commits autonomously - always ask the user to do it manually
- Avoid unfounded assumptions - verify critical details
  - Don't guess file paths - use Glob/Grep to find them
  - Don't guess API contracts or function signatures - read the actual code
  - Reasonable inference based on patterns is OK
  - When truly uncertain about important decisions, ask the user

**IMPORTANT**

- If Claude repeats the same mistake, add an explicit ban to CLAUDE.md
  - Leveraging the Failure-Driven Documentation Pattern
- Proactively leverage frontmatter-based auto-triggering for skills and agents
  - Use .claude/skills/ for general principles (coding standards, work methodologies, ...)
  - Use .claude/agents/ for specialized expert domains (architecture, optimization, ...)
- Always gather context before starting work
  - Read related files first (don't work blind)
  - Check existing patterns in codebase
  - Review project conventions (naming, structure, etc.)
  - Reference .claude/skills/work-execution-principles for detailed guidance
- Always assess issue size and scope accurately - avoid over-engineering simple tasks
  - Apply to both implementation and documentation
  - Verbose documentation causes review burden for humans

## Project Overview

GitHub Project Status Viewer is a Chrome browser extension that displays GitHub Projects V2 status badges directly in repository issue lists. It uses the GitHub GraphQL API to fetch project status information and dynamically renders color-coded badges next to each issue.

## Build Commands

The project uses `just` as the task runner (not npm scripts directly):

```bash
just deps         # Install dependencies
just build        # Production build (compile TypeScript, copy public/ files to dist/)
just watch        # Development watch mode (TypeScript only)
just typecheck    # Type checking without emitting files
just clean        # Clean build artifacts
just rebuild      # Full rebuild (clean + deps + build)
just package      # Create extension.zip for distribution
just lint         # Run Prettier + ESLint (extension, server, config, justfile)
just test-server  # Run Go server tests
```

Package manager: yarn@1.22.19

## Architecture

### Chrome Manifest V3 Three-Component Pattern

The extension follows Chrome Manifest V3 architecture with three distinct components that communicate via message passing:

1. **Content Script** (`extension/src/content.ts`)
   - Runs on GitHub issue list pages matching `https://github.com/*/*/issues*`
   - DOM manipulation: Parses issue numbers from `[data-testid="issue-pr-title-link"]` elements
   - Uses MutationObserver to detect dynamic page updates
   - Sends requests to background script via `chrome.runtime.sendMessage`
   - Renders status badges by injecting `<span class="project-status-badge">` elements
   - SPA routing support: Handles `turbo:load`, `pjax:end` events

2. **Service Worker** (`extension/src/background.ts`)
   - Handles GraphQL API communication with GitHub
   - Dynamically builds queries for multiple issues using aliases (e.g., `issue0: issue(number: 1)`)
   - Authenticates with OAuth tokens from chrome.storage.session
   - Extracts status from `ProjectV2ItemFieldSingleSelectValue` nodes
   - Returns status map to content script
   - Includes automatic token refresh logic

3. **Popup UI** (`extension/src/popup.ts`)
   - Handles GitHub OAuth login (using chrome.identity.launchWebAuthFlow)
   - Manages display mode settings (full/compact)
   - Stores access/refresh tokens in chrome.storage.session
   - No direct communication with content script or background worker

### OAuth Authentication Flow

```
User clicks "Sign in with GitHub"
  → Popup initiates GitHub OAuth via chrome.identity.launchWebAuthFlow
  → Extracts code parameter from GitHub callback URL
  → Sends code to backend API (/api/callback)
  → Backend returns access_token + refresh_token
  → Stores tokens in chrome.storage.session
  → Background verifies token (/api/verify) then calls GitHub API
  → Automatically refreshes via /api/refresh when token expires
```

### Key Data Flow

```
User visits GitHub issues page
  → Content script parses issue numbers from DOM
  → Sends {type: "GET_PROJECT_STATUS", owner, repo, issueNumbers} to background
  → Background builds GraphQL query with issue aliases
  → Queries GitHub API for projectItems.fieldValues where field.name === "Status"
  → Returns [{number, status, color}] to content script
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
                color
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
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

From `.claude/WORK_RULES.md`:

- **Types over Interfaces**: Always use `type` instead of `interface`
- **Arrow functions**: Use arrow functions outside of classes
- **IIFE pattern**: All entry point files wrap code in `(() => { ... })()` to avoid global scope pollution
- **Alphabetical ordering**: Sort object properties, types, and interfaces alphabetically
- **Early returns**: Minimize conditional depth with early returns
- **Constants**: Extract magic values to named constants (e.g., `STATUS_FIELD_NAME = "Status"`)
- **No any types**: Avoid unsafe type systems
- **Minimal comments**: Write self-documenting code, only include comments for unavoidable business logic

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Strict mode: enabled
- Output: `./extension/dist`
- Source: `./extension/src`

## Server Architecture (Go)

The server consists of Go serverless functions deployed on Vercel:

- `/api/callback`: OAuth callback, exchanges code for access_token
- `/api/verify`: JWT verification, returns GitHub access token
- `/api/refresh`: Issues new access/refresh tokens using refresh token
- Stores refresh tokens in Redis (Vercel KV)
- JWT-based authentication

## Important Implementation Details

- **Status field detection**: Only shows status from the FIRST connected project per issue
- **GitHub Projects V2 only**: Does not support legacy Projects (V1)
- **Badge deduplication**: Checks for existing `.project-status-badge` before injecting
- **Display modes**: full (with text), compact (color dot only)
- **Badge width alignment**: All badges aligned to max width in full mode
- **Error handling**: Background script logs GraphQL errors but gracefully degrades in content script
