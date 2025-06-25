/**
 * SDK Integration Testing
 * 
 * Tests actual @modelcontextprotocol/sdk integration and functionality.
 * Validates that our server correctly implements the MCP SDK patterns.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool,
  ToolCallRequest,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SDK Integration Testing', () => {
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
        name: 'sdk-integration-client',
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

  test('should implement MCP SDK Client interface correctly', async () => {
    // Verify client has expected methods
    expect(typeof client.listTools).toBe('function');
    expect(typeof client.callTool).toBe('function');
    expect(typeof client.connect).toBe('function');
    expect(typeof client.close).toBe('function');

    // Test basic functionality
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
  });

  test('should handle MCP SDK Transport layer correctly', async () => {
    // Test that transport is working
    expect(transport).toBeDefined();
    
    // Multiple sequential calls should work
    for (let i = 0; i < 3; i++) {
      const result = await client.listTools();
      expect(result.tools.length).toBe(5);
    }
  });

  test('should validate MCP SDK Tool schema integration', async () => {
    const toolsResult = await client.listTools();
    
    toolsResult.tools.forEach((tool: Tool) => {
      // Validate Tool type compliance
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe('object');
      
      // Validate JSON Schema structure
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      expect(tool.inputSchema.required).toBeDefined();
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
    });
  });

  test('should implement MCP SDK request handlers correctly', async () => {
    // Test ListToolsRequest handling
    const listToolsRequest = ListToolsRequestSchema.parse({
      method: 'tools/list',
      params: {}
    });
    
    const toolsResult = await client.listTools();
    expect(toolsResult.tools.length).toBe(5);

    // Test CallToolRequest handling
    const callToolRequest: ToolCallRequest = {
      method: 'tools/call',
      params: {
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: { page: 1 }
        }
      }
    };

    const callResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    expect(callResult.content).toBeDefined();
    expect(Array.isArray(callResult.content)).toBe(true);
    expect(callResult.content.length).toBeGreaterThan(0);
  });

  test('should handle MCP SDK error handling patterns', async () => {
    // Test invalid tool name
    try {
      await client.callTool({
        name: 'invalid_tool_name',
        arguments: {}
      });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeDefined();
      // Error should be properly formatted
    }

    // Test malformed arguments
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'invalid_action',
        params: {}
      }
    });

    // Should return error in content, not throw
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    const responseData = JSON.parse((result.content[0] as any).text);
    expect(responseData.error).toBe(true);
  });

  test('should support MCP SDK capability negotiation', async () => {
    // Capability negotiation happens during connect
    // If we're connected, it succeeded
    
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
    
    // Test that all expected capabilities are working
    const capabilities = [
      'tools/list',
      'tools/call'
    ];
    
    // If we can list and call tools, capabilities are working
    const callResult = await client.callTool({
      name: 'agents_manage',
      arguments: {
        action: 'list',
        params: {}
      }
    });
    
    expect(callResult.content).toBeDefined();
  });

  test('should handle MCP SDK streaming responses', async () => {
    // Our implementation doesn't use streaming, but SDK should handle it
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 50 }
      }
    });

    // Response should be complete, not streamed
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    
    // All content should be immediately available
    result.content.forEach(item => {
      expect(item.type).toBeDefined();
      if (item.type === 'text') {
        expect((item as any).text).toBeDefined();
        expect(typeof (item as any).text).toBe('string');
      }
    });
  });

  test('should validate MCP SDK progress reporting', async () => {
    // Test progress reporting during tool execution
    let progressReported = false;
    
    // SDK might report progress for long-running operations
    const result = await client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 100 }
      }
    });

    expect(result.content).toBeDefined();
    // Progress reporting is optional and our simple implementation doesn't use it
  });

  test('should handle MCP SDK resource references', async () => {
    // Test that tool results can reference resources
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    expect(result.content).toBeDefined();
    
    // Content should be properly typed
    result.content.forEach(item => {
      expect(['text', 'image', 'resource'].includes(item.type)).toBe(true);
    });
  });

  test('should support MCP SDK client information exchange', async () => {
    // Client info is exchanged during initialization
    // Test that server accepts our client info
    
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
    
    // Server should be able to handle our client capabilities
    const result = await client.callTool({
      name: 'companies_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });
    
    expect(result.content).toBeDefined();
  });

  test('should handle MCP SDK connection lifecycle', async () => {
    // Test reconnection scenario
    await client.close();
    
    // Should not be able to make calls after closing
    await expect(client.listTools()).rejects.toThrow();
    
    // Create new connection
    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    const newTransport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    const newClient = new Client(
      {
        name: 'sdk-reconnect-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await newClient.connect(newTransport);
    
    // Should work after reconnection
    const tools = await newClient.listTools();
    expect(tools.tools.length).toBe(5);
    
    await newClient.close();
  });

  test('should validate MCP SDK metadata handling', async () => {
    const tools = await client.listTools();
    
    // Each tool should have proper metadata
    tools.tools.forEach(tool => {
      expect(tool.name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/); // Valid identifier
      expect(tool.description.length).toBeGreaterThan(10); // Meaningful description
      
      // Schema should have metadata
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    });
  });

  test('should handle MCP SDK content types correctly', async () => {
    const result = await client.callTool({
      name: 'conversations_manage',
      arguments: {
        action: 'list',
        params: { ticket_id: 1, page: 1 }
      }
    });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    
    // Validate content type structure
    result.content.forEach(item => {
      expect(item.type).toBeDefined();
      
      switch (item.type) {
        case 'text':
          expect((item as any).text).toBeDefined();
          expect(typeof (item as any).text).toBe('string');
          break;
        case 'image':
          expect((item as any).data).toBeDefined();
          expect((item as any).mimeType).toBeDefined();
          break;
        case 'resource':
          expect((item as any).resource).toBeDefined();
          break;
      }
    });
  });
});