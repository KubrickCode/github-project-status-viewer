#!/usr/bin/env bash
set -e

echo "Installing Doppler CLI..."

# Install dependencies
apt-get update
apt-get install -y curl gnupg

# Install Doppler CLI
curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh

echo "Doppler CLI installed successfully"