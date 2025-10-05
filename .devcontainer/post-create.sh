#!/usr/bin/env bash
set -euo pipefail

echo "Installing PostgreSQL client..."

if ! command -v psql &> /dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get update
  apt-get -y install lsb-release
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | tee /etc/apt/sources.list.d/pgdg.list
  apt-get update
  apt-get -y install postgresql-client-16
  echo "PostgreSQL client 16 installed successfully!"
else
  echo "PostgreSQL client is already installed."
fi
