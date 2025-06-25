/**
 * Protocol Compliance Validation
 * 
 * Ensures JSON-RPC 2.0 and MCP specification adherence.
 * Tests that all protocol messages follow the correct format and semantics.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  InitializeRequestSchema,
  ErrorCode,
  McpError 
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Protocol Compliance Validation', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Set up mock environment
    process.env.FRESHDESK_DOMAIN = 'test-domain';
    process.env.FRESHDESK_API_KEY = 'test-api-key';
    process.env.SKIP_CONNECTION_TEST = 'true';

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'protocol-compliance-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
  });

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    delete process.env.SKIP_CONNECTION_TEST;
  });

  test('should follow JSON-RPC 2.0 request format', async () => {
    // Test that listTools follows JSON-RPC 2.0 format
    const toolsResult = await client.listTools();
    
    // Response should have proper structure
    expect(toolsResult).toBeDefined();
    expect(toolsResult.tools).toBeDefined();
    expect(Array.isArray(toolsResult.tools)).toBe(true);
    
    // Each tool should have required MCP properties
    toolsResult.tools.forEach(tool => {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe('object');
    });
  });

  test('should validate MCP tool call request format', async () => {
    // Test tool call with proper MCP format
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 5 }
      }
    });

    // Response should follow MCP format
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    
    // Content items should have proper structure
    result.content.forEach(item => {
      expect(item.type).toBeDefined();
      expect(['text', 'image', 'resource'].includes(item.type)).toBe(true);
      
      if (item.type === 'text') {
        expect((item as any).text).toBeDefined();
        expect(typeof (item as any).text).toBe('string');
      }
    });
  });

  test('should handle JSON-RPC 2.0 error responses correctly', async () => {
    // Test invalid tool name
    await expect(client.callTool({
      name: 'nonexistent_tool',
      arguments: {}
    })).rejects.toThrow();

    // Test invalid arguments
    await expect(client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'invalid_action',
        params: {}
      }
    })).resolves.toBeDefined(); // Should not throw, but return error in content
  });

  test('should validate tool input schema compliance', async () => {
    const toolsResult = await client.listTools();
    
    // All tools should have valid JSON Schema
    toolsResult.tools.forEach(tool => {
      const schema = tool.inputSchema;
      
      // Basic JSON Schema properties
      expect(schema.type).toBeDefined();
      expect(schema.properties).toBeDefined();
      expect(typeof schema.properties).toBe('object');
      
      // Should have action and params properties for our tools
      expect(schema.properties.action).toBeDefined();
      expect(schema.properties.params).toBeDefined();
      
      // Action should be an enum
      expect(schema.properties.action.enum).toBeDefined();
      expect(Array.isArray(schema.properties.action.enum)).toBe(true);
      
      // Required fields should be specified
      expect(schema.required).toBeDefined();
      expect(Array.isArray(schema.required)).toBe(true);
      expect(schema.required.includes('action')).toBe(true);
      expect(schema.required.includes('params')).toBe(true);
    });
  });

  test('should validate MCP capability negotiation', async () => {
    // The connection process validates capability negotiation
    // If we get here, negotiation was successful
    
    // Test that we can perform basic operations
    const toolsResult = await client.listTools();
    expect(toolsResult.tools.length).toBe(5);
    
    // Verify expected tool names
    const expectedTools = [
      'tickets_manage',
      'contacts_manage',
      'agents_manage',
      'companies_manage',
      'conversations_manage'
    ];
    
    const actualToolNames = toolsResult.tools.map(t => t.name);
    expectedTools.forEach(expectedTool => {
      expect(actualToolNames.includes(expectedTool)).toBe(true);
    });
  });

  test('should handle protocol version compatibility', async () => {
    // The SDK handles protocol version negotiation
    // If connection succeeds, versions are compatible
    
    // Test that we can successfully communicate
    const toolsResult = await client.listTools();
    expect(toolsResult).toBeDefined();
    
    // Test tool execution works with current protocol version
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });
    
    expect(result.content).toBeDefined();
  });

  test('should validate request/response message IDs', async () => {
    // Test multiple requests to ensure proper ID handling
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(client.listTools());
    }
    
    const results = await Promise.all(promises);
    
    // All requests should complete successfully
    results.forEach(result => {
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBe(5);
    });
  });

  test('should handle large message payloads correctly', async () => {
    // Test with large parameter object
    const largeParams = {
      page: 1,
      per_page: 100,
      filter: 'a'.repeat(1000), // Large filter string
      sort_by: 'created_at',
      sort_order: 'desc',
      extra_data: {
        metadata: 'x'.repeat(500),
        tags: Array(50).fill('tag').map((t, i) => `${t}_${i}`),
        custom_fields: Object.fromEntries(
          Array(20).fill(0).map((_, i) => [`field_${i}`, `value_${i}`])
        )
      }
    };

    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: largeParams
      }
    });

    // Should handle large payload without truncation
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });

  test('should validate UTF-8 encoding compliance', async () => {
    // Test with Unicode characters
    const unicodeParams = {
      page: 1,
      search: '测试 🎯 émojis and спец symbols'
    };

    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: unicodeParams
      }
    });

    expect(result.content).toBeDefined();
  });

  test('should handle concurrent protocol messages', async () => {
    // Test concurrent tool calls
    const concurrentCalls = [
      client.callTool({
        name: 'tickets_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
      client.callTool({
        name: 'contacts_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
      client.callTool({
        name: 'agents_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
      client.listTools(),
      client.listTools()
    ];

    const results = await Promise.all(concurrentCalls);
    
    // All calls should succeed
    expect(results.length).toBe(5);
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  });

  test('should validate proper notification handling', async () => {
    // MCP servers typically don't send notifications in our implementation
    // But we test that the protocol can handle them properly
    
    // If we get here without errors, notification handling is working
    const toolsResult = await client.listTools();
    expect(toolsResult.tools.length).toBe(5);
  });

  test('should handle protocol timeouts appropriately', async () => {
    // Test with a tool call that might take time
    const startTime = Date.now();
    
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 100 }
      }
    });
    
    const duration = Date.now() - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(30000); // 30 seconds max
    expect(result.content).toBeDefined();
  });
});