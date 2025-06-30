#!/bin/bash

# Launch script for Enhanced Freshdesk MCP Server with proper environment

# Set default values if not provided
export SKIP_CONNECTION_TEST=${SKIP_CONNECTION_TEST:-false}
export SKIP_PERMISSION_DISCOVERY=${SKIP_PERMISSION_DISCOVERY:-false}
export NODE_ENV=${NODE_ENV:-production}

# Check required environment variables
if [ -z "$FRESHDESK_DOMAIN" ] || [ -z "$FRESHDESK_API_KEY" ]; then
    echo "Error: FRESHDESK_DOMAIN and FRESHDESK_API_KEY must be set"
    echo "Example:"
    echo "  export FRESHDESK_DOMAIN=yourcompany"
    echo "  export FRESHDESK_API_KEY=your-api-key"
    exit 1
fi

# Build if dist doesn't exist
if [ ! -f "dist/index-enhanced.js" ]; then
    echo "Building project..."
    npm run build
fi

# Run the enhanced server
echo "Starting Enhanced Freshdesk MCP Server..."
echo "Domain: $FRESHDESK_DOMAIN.freshdesk.com"
echo "Skip Connection Test: $SKIP_CONNECTION_TEST"
echo "Skip Permission Discovery: $SKIP_PERMISSION_DISCOVERY"
echo ""

node dist/index-enhanced.js