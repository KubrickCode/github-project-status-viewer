# GitHub Project Status Viewer

A Chrome extension that displays GitHub Projects status directly in your repository's issue list.

## Features

- 🏷️ Automatically shows project status badges next to each issue
- 🎨 Color-coded badges for easy visual identification (Backlog, Ready, In progress, In review, Done)
- 🔄 Detects projects automatically from each issue's connections
- ⚡ Uses GitHub GraphQL API for efficient data fetching
- 🔒 Secure storage of GitHub Personal Access Token

## Installation

### 1. Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with these permissions:
   - `repo` (Full control of private repositories)
   - `read:project` (Read access to projects)

### 2. Build the Extension

```bash
just deps
just build
```

### 3. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist` folder

### 4. Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Enter your GitHub Personal Access Token
3. Click "Save Configuration"

That's it! No need to specify project numbers or usernames.

## Usage

1. Navigate to any GitHub repository's issues page (e.g., `https://github.com/owner/repo/issues`)
2. The extension automatically detects which projects each issue belongs to
3. Status badges appear next to issue titles with color-coding:
   - **Backlog** - Gray
   - **Ready** - Blue
   - **In progress** - Yellow
   - **In review** - Purple
   - **Done** - Green

## Development

```bash
# Install dependencies
just deps

# Build for production
just build

# Watch mode for development
just watch

# Clean build artifacts
just clean

# Rebuild from scratch
just rebuild

# Type check
just typecheck
```

## Project Structure

```
├── src/
│   ├── popup.ts        # Extension popup (PAT configuration)
│   ├── content.ts      # Content script (runs on GitHub pages)
│   └── background.ts   # Service worker (GraphQL API calls)
├── public/
│   ├── manifest.json   # Extension manifest
│   ├── popup.html      # Popup UI
│   └── styles.css      # Badge styles
└── dist/               # Built extension files
```

## How It Works

1. **Content Script** detects issue list pages and parses issue numbers
2. Extracts repository owner/name from URL
3. Sends request to **Service Worker** with issue numbers
4. Service Worker builds dynamic GraphQL query for each issue
5. Queries `issue(number: X).projectItems` to get project status
6. Returns status data to Content Script
7. Content Script renders colored badges next to each issue

## Technical Details

- Uses TypeScript with strict mode
- Follows IIFE pattern to avoid global scope pollution
- GraphQL queries are dynamically generated per request
- Supports GitHub Projects V2 (ProjectV2ItemFieldSingleSelectValue)
- Handles multiple issues efficiently with single API call

## Limitations

- Requires GitHub Personal Access Token with appropriate permissions
- Only shows status from first connected project per issue
- Works only with GitHub Projects V2 (new projects)

## License

MIT
