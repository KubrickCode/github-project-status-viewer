# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
   - Uses MutationObserver to detect dynamic page updates
   - SPA routing support: Handles `turbo:load`, `pjax:end` events

2. **Service Worker** (`extension/src/background.ts`)
   - Handles GraphQL API communication with GitHub
   - Authenticates with OAuth tokens from chrome.storage.session
   - Returns status map to content script

3. **Popup UI** (`extension/src/popup.ts`)
   - Manages display mode settings (full/compact)
   - No direct communication with content script or background worker

### Service Layer (`extension/src/services/`)

- **auth.service.ts**: OAuth flow, token management (storage, exchange, validation)
- **dom-parser.service.ts**: Issue number extraction, repository info parsing
- **github-api.service.ts**: GraphQL query building, API communication
- **badge-renderer.service.ts**: Badge DOM injection, styling, width alignment

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

### Package Structure (`server/pkg/`)

- **errors/**: Centralized error types (sentinel errors pattern)
- **auth/**: Authentication middleware
- **jwt/**: Token generation and validation
- **oauth/**: GitHub OAuth client, CORS handling
- **redis/**: Vercel KV client
- **httputil/**: HTTP response helpers, error formatting
- **crypto/**: Random value generation

## Important Implementation Details

- **Status field detection**: Only shows status from the FIRST connected project per issue
- **GitHub Projects V2 only**: Does not support legacy Projects (V1)
- **Badge deduplication**: Checks for existing `.project-status-badge` before injecting
- **Display modes**: full (with text), compact (color dot only)
- **Badge width alignment**: All badges aligned to max width in full mode
- **Error handling**: Background script logs GraphQL errors but gracefully degrades in content script
