---
name: project-structure
description: |
  Project folder structure design guide. Define standard directory structures for various project types including monorepo, NestJS, React, Go, NPM packages, IDE (VSCode, etc.) and Chrome Extension.
  TRIGGER: Project structure design, folder structure questions, directory organization, project creation, monorepo structure, NestJS/React/Go project structure
---

# Project Structure Guide

## Monorepo

```
project-root/
├── src/                         # All services/apps
├── infra/                       # Shared infrastructure
├── docs/                        # Documentation
├── .devcontainer/               # Dev Container configuration
├── .github/                     # Workflows, templates
├── .vscode/                     # VSCode settings
├── .claude/                     # Claude settings
├── .gemini/                     # Gemini settings
├── package.json                 # Root package.json. For releases, version management
├── go.work                      # Go workspace (when using Go)
├── justfile                     # Just task runner
├── .gitignore
├── .prettierrc
├── .prettierignore
└── README.md
```

## Go

```
project-root/
├── cmd/                    # Execution entry points (main.go)
├── internal/               # Private packages
├── pkg/                    # Public packages
├── configs/                # Configuration files
├── scripts/                # Utility scripts
├── tests/                  # Integration tests
├── docs/                   # Documentation
├── go.mod
└── go.sum
```

## Chrome Extension

```
project-root/
├── background/                  # Service Worker (Background Script)
├── content/                     # Content Scripts
├── popup/                       # Popup (Extension UI)
├── internal/                    # Private packages
├── pkg/                         # Public packages
├── configs/                     # Configuration files
├── scripts/                     # Utility scripts
├── tests/                       # Integration tests
├── public/                      # Static resources
├── dist/                        # Build artifacts
├── package.json
└── tsconfig.json
```
