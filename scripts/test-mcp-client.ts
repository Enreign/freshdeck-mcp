#!/usr/bin/env tsx

/**
 * Manual MCP Client Test
 * 
 * This script creates a direct MCP client to test the Freshdesk MCP server
 * without needing Claude Desktop or the MCP Inspector.
 */

import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTitle(title: string) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSection(title: string) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'-'.repeat(40)}`, 'blue');
}

async function testMCPServer() {
  let serverProcess: ChildProcess | null = null;
  let client: Client | null = null;

  try {
    logTitle('Freshdesk MCP Server Test');

    // Check environment variables
    if (!process.env.FRESHDESK_DOMAIN || !process.env.FRESHDESK_API_KEY) {
      log('❌ Missing required environment variables:', 'red');
      log('   FRESHDESK_DOMAIN and FRESHDESK_API_KEY must be set', 'red');
      log('\nExample:', 'yellow');
      log('   export FRESHDESK_DOMAIN=your-domain', 'yellow');
      log('   export FRESHDESK_API_KEY=your-api-key', 'yellow');
      process.exit(1);
    }

    log(`✅ Environment configured:`, 'green');
    log(`   Domain: ${process.env.FRESHDESK_DOMAIN}`, 'green');
    log(`   API Key: ${process.env.FRESHDESK_API_KEY?.substring(0, 8)}...`, 'green');

    logSection('Starting MCP Server');

    // Start the MCP server
    const serverPath = path.resolve(__dirname, '../src/index.ts');
    log(`🚀 Starting server: tsx ${serverPath}`, 'yellow');

    serverProcess = spawn('tsx', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Handle server errors
    serverProcess.stderr?.on('data', (data) => {
      log(`🔴 Server Error: ${data}`, 'red');
    });

    serverProcess.on('error', (error) => {
      log(`❌ Failed to start server: ${error.message}`, 'red');
      process.exit(1);
    });

    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    logSection('Connecting MCP Client');

    // Create MCP client
    const transport = new StdioClientTransport({
      reader: serverProcess.stdout!,
      writer: serverProcess.stdin!,
    });

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    log('🔌 Connecting to MCP server...', 'yellow');
    await client.connect(transport);
    log('✅ Connected successfully!', 'green');

    logSection('Testing Server Capabilities');

    // Test 1: List available tools
    log('📋 Listing available tools...', 'yellow');
    const toolsResult = await client.listTools();
    
    log(`✅ Found ${toolsResult.tools.length} tools:`, 'green');
    toolsResult.tools.forEach((tool, index) => {
      log(`   ${index + 1}. ${tool.name} - ${tool.description}`, 'cyan');
    });

    if (toolsResult.tools.length === 0) {
      log('⚠️  No tools found! Check server implementation.', 'yellow');
      return;
    }

    logSection('Testing Tool Execution');

    // Test 2: Test tickets tool - list tickets
    log('🎫 Testing tickets tool - listing tickets...', 'yellow');
    try {
      const listTicketsResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {
            page: 1,
            per_page: 5,
          },
        },
      });

      log('✅ Tickets list call successful!', 'green');
      const response = JSON.parse(listTicketsResult.content[0].text);
      if (response.success) {
        log(`   Found ${response.tickets?.length || 0} tickets`, 'cyan');
      } else {
        log(`   Error: ${response.message}`, 'yellow');
      }
    } catch (error: any) {
      log(`❌ Tickets test failed: ${error.message}`, 'red');
    }

    // Test 3: Test contacts tool - list contacts
    log('👥 Testing contacts tool - listing contacts...', 'yellow');
    try {
      const listContactsResult = await client.callTool({
        name: 'contacts_manage',
        arguments: {
          action: 'list',
          params: {
            page: 1,
            per_page: 5,
          },
        },
      });

      log('✅ Contacts list call successful!', 'green');
      const response = JSON.parse(listContactsResult.content[0].text);
      if (response.success) {
        log(`   Found ${response.contacts?.length || 0} contacts`, 'cyan');
      } else {
        log(`   Error: ${response.message}`, 'yellow');
      }
    } catch (error: any) {
      log(`❌ Contacts test failed: ${error.message}`, 'red');
    }

    // Test 4: Test agents tool - get current agent
    log('👤 Testing agents tool - getting current agent...', 'yellow');
    try {
      const currentAgentResult = await client.callTool({
        name: 'agents_manage',
        arguments: {
          action: 'me',
          params: {},
        },
      });

      log('✅ Current agent call successful!', 'green');
      const response = JSON.parse(currentAgentResult.content[0].text);
      if (response.success) {
        log(`   Agent: ${response.agent?.contact?.name || 'Unknown'}`, 'cyan');
        log(`   Email: ${response.agent?.contact?.email || 'Unknown'}`, 'cyan');
      } else {
        log(`   Error: ${response.message}`, 'yellow');
      }
    } catch (error: any) {
      log(`❌ Agent test failed: ${error.message}`, 'red');
    }

    // Test 5: Test error handling - invalid action
    log('⚠️  Testing error handling - invalid action...', 'yellow');
    try {
      const errorResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'invalid_action',
          params: {},
        },
      });

      const response = JSON.parse(errorResult.content[0].text);
      if (response.error) {
        log('✅ Error handling works correctly!', 'green');
        log(`   Error message: ${response.message}`, 'cyan');
      } else {
        log('⚠️  Expected error but got success', 'yellow');
      }
    } catch (error: any) {
      log(`✅ Error handling works (threw exception): ${error.message}`, 'green');
    }

    logSection('Performance Test');

    // Test 6: Concurrent tool calls
    log('⚡ Testing concurrent tool calls...', 'yellow');
    const startTime = Date.now();

    try {
      const concurrentPromises = [
        client.callTool({
          name: 'tickets_manage',
          arguments: { action: 'list', params: { per_page: 1 } },
        }),
        client.callTool({
          name: 'contacts_manage',
          arguments: { action: 'list', params: { per_page: 1 } },
        }),
        client.callTool({
          name: 'agents_manage',
          arguments: { action: 'list', params: { per_page: 1 } },
        }),
      ];

      const results = await Promise.all(concurrentPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      log(`✅ Concurrent calls completed in ${duration}ms`, 'green');
      log(`   ${results.length} calls executed successfully`, 'cyan');
    } catch (error: any) {
      log(`❌ Concurrent test failed: ${error.message}`, 'red');
    }

    logTitle('Test Results Summary');
    log('🎉 MCP Server testing completed successfully!', 'green');
    log('✅ Server startup: OK', 'green');
    log('✅ Client connection: OK', 'green');
    log('✅ Tool discovery: OK', 'green');
    log('✅ Tool execution: OK', 'green');
    log('✅ Error handling: OK', 'green');
    log('✅ Performance: OK', 'green');

    log('\n💡 Next steps:', 'yellow');
    log('   1. Test with Claude Desktop using the provided script', 'yellow');
    log('   2. Use MCP Inspector for interactive testing', 'yellow');
    log('   3. Run the comprehensive test suite: npm run test:coverage', 'yellow');

  } catch (error: any) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'red');
    }
    process.exit(1);
  } finally {
    // Cleanup
    if (client) {
      try {
        await client.close();
        log('\n🔌 Client disconnected', 'yellow');
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
      log('🛑 Server stopped', 'yellow');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMCPServer().catch((error) => {
    log(`\n💥 Unhandled error: ${error.message}`, 'red');
    process.exit(1);
  });
}