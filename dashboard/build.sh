#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Installing dependencies..."
npm install --silent

echo "Building dashboard..."
npx astro build

echo "Done! Output in ./dist/"
