#!/usr/bin/env bash

set -e

yarn set version berry

npm install -g @anthropic-ai/claude-code
