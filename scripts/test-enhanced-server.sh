#!/bin/bash

# Test script for Enhanced Freshdesk MCP Server

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Testing Enhanced Freshdesk MCP Server..."

# Check if environment variables are set
if [ -z "$FRESHDESK_DOMAIN" ] || [ -z "$FRESHDESK_API_KEY" ]; then
    echo -e "${RED}Error: FRESHDESK_DOMAIN and FRESHDESK_API_KEY must be set${NC}"
    exit 1
fi

# Build the project
echo "Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}Build successful${NC}"

# Run the enhanced server
echo "Running enhanced server..."
SKIP_PERMISSION_DISCOVERY=false SKIP_CONNECTION_TEST=false node dist/index-enhanced.js