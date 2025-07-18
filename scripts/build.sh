#!/bin/bash
set -e

echo "🔨 Building library..."
pnpm tsc

echo "📦 Bundling CLI..."
node scripts/build-cli.js

echo "✨ Build complete!"
