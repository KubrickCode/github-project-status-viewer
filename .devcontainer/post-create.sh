#!/bin/bash

npm install -g @anthropic-ai/claude-code
npm install -g prettier
npm install -g baedal

if [ -f /workspaces/github-project-status-viewer/.env ]; then
  grep -v '^#' /workspaces/github-project-status-viewer/.env | sed 's/^/export /' >> ~/.bashrc
fi
