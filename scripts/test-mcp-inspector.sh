#!/bin/bash

# MCP Inspector Test Script for Freshdesk MCP
# This script helps test the MCP server using the official MCP Inspector

set -e

echo "🔍 Testing Freshdesk MCP with MCP Inspector"
echo "=========================================="

# Check if required environment variables are set
if [ -z "$FRESHDESK_DOMAIN" ] || [ -z "$FRESHDESK_API_KEY" ]; then
    echo "❌ Error: Required environment variables not set"
    echo "Please set FRESHDESK_DOMAIN and FRESHDESK_API_KEY"
    echo ""
    echo "Example:"
    echo "export FRESHDESK_DOMAIN=your-domain"
    echo "export FRESHDESK_API_KEY=your-api-key"
    exit 1
fi

echo "✅ Environment variables configured"
echo "   Domain: $FRESHDESK_DOMAIN"
echo "   API Key: ${FRESHDESK_API_KEY:0:8}..."

# Install MCP Inspector if not available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js"
    exit 1
fi

echo ""
echo "🚀 Starting MCP Inspector..."
echo "This will open a web interface to test your MCP server"
echo ""
echo "📋 Instructions:"
echo "1. The inspector will open in your browser"
echo "2. Click 'Add Server' to configure the Freshdesk MCP server"
echo "3. Use these settings:"
echo "   - Command: tsx"
echo "   - Args: ['src/index.ts']"
echo "   - Working Directory: $(pwd)"
echo "4. Test the available tools and their functionality"
echo ""

# Start the MCP Inspector
npx @modelcontextprotocol/inspector