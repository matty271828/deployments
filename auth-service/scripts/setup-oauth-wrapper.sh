#!/bin/bash

# OAuth Setup Wrapper Script
# This script is called directly from the GitHub Actions workflow
# and has access to all repository secrets as environment variables

set -e

echo "🔗 Starting OAuth provider configuration..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the auth-service directory."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Run the OAuth configuration script
echo "🔧 Running OAuth configuration..."
node scripts/configure-oauth-providers.js \
    --domain "$1" \
    --auth-db-id "$2" \
    --cloudflare-account-id "$3" \
    --cloudflare-api-token "$4"

echo "✅ OAuth configuration complete!" 