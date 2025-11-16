# Changelog

All notable changes to this project will be documented in this file.

## [2.0.2](https://github.com/KubrickCode/github-project-status-viewer/compare/v0.0.4...v2.0.2) (2025-10-11)

### ✨ Features

- Added display mode selection feature and implemented compact mode
- Add Privacy Policy page
- Add automated Chrome Web Store deployment

### 🐛 Bug Fixes

- Fix 401 error after 2-hour session expiry by implementing refresh token rotation
- Fix badge display on initial page load for SPA navigation
- Reload status badges immediately after successful login
- Solve the problem of the margin below the login button being too wide when the popover is not logged in

### 💄 Styles

- Redesign popup UI with GitHub Primer design system
- Improve status badge design for visual consistency
- Badge colors have been improved to match dark mode
- Adjust badge padding
- Change the pop-up header icon to the Octocat logo
- Reduce the length of the description in the pop-up
- Edit popup title

### 📚 Documentation

- Add display mode info in readme
- Improved visibility of before-after comparison screenshots
- Add dark mode information in readme
- Change readme images
- Edit readme
- Add logo image

### ✅ Tests

- Add go test cases

### 🔧 CI/CD

- Bump softprops/action-gh-release from 1 to 2
- Bump actions/checkout from 4 to 5

### 🔨 Chore

- Modify the main package version to match the manifest version
- Version sync
- Delete prisma code
- Format code

## [0.0.4](https://github.com/KubrickCode/github-project-status-viewer/compare/v0.0.3...v0.0.4) (2025-10-07)

### 🔨 Chore

- Release v0.0.4

## [0.0.3](https://github.com/KubrickCode/github-project-status-viewer/compare/v0.0.2...v0.0.3) (2025-10-07)

### ✨ Features

- Migrate from PAT to OAuth authentication with JWT tokens
- Implement JWT and Redis-based token security
- Switch vercel server from TypeScript to Go
- Add vercel server as MVP

### 🔧 CI/CD

- Configure Vercel deployment for Go serverless functions
- Use index.go in subdirectories for Vercel Go functions
- Go version modified
- Add go devcontainer configurations

### 🔨 Chore

- Add .env in gitignore
- Edit gitignore

## [0.0.2](https://github.com/KubrickCode/github-project-status-viewer/releases/tag/v0.0.2) (2025-10-06)

### ✨ Features

- Implemented the MVP model
- Replace hardcoded project statuses with dynamic detection
- Use actual GitHub Projects status colors instead of hash-based colors
- Move status badges before issue titles with uniform width alignment

### 💄 Styles

- Improve project status badge styling for better visibility and distinction from labels
- Fix vertical alignment of status badges with issue titles and labels

### 📚 Documentation

- Update README
- Add funding
- Add claude markdown

### 🔧 CI/CD

- Add release workflow
- Add release command

### 🔨 Chore

- Initial commit
- Initialize environment
- Enable ai agents
- Add ai agents setting
- Add coding guide
- Add rebuild command
- Change project directory structure
- Add root package
