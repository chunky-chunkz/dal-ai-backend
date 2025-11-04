#!/bin/bash
set -e

script_dir=$(dirname "$(realpath "$0")")
cd "$script_dir"

echo "📦 Installing dependencies..."
npm ci

echo "🏗️  Building TypeScript project..."
npm run build || echo "⚠️ Build skipped or failed (maybe pure JS project). Continuing..."

echo "🚀 Starting backend..."
node server.js
