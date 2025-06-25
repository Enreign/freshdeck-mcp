/**
 * Real MCP Process Testing
 * 
 * Tests actual MCP server process spawning and communication via STDIO.
 * Validates that the server can be started as a real subprocess and communicate
 * through the MCP protocol.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

describe('Real MCP Process Testing', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(() => {
    // Set up mock environment for testing
    process.env['FRESHDESK_DOMAIN'] = 'test-domain';
    process.env['FRESHDESK_API_KEY'] = 'test-api-key';
    process.env['SKIP_CONNECTION_TEST'] = 'true'; // Skip connection test for process testing
  });

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up environment
    delete process.env['SKIP_CONNECTION_TEST'];
  });

  test('should spawn MCP server process and establish connection', async () => {
    const serverPath = path.resolve(process.cwd(), 'src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'test-process-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should connect without throwing
    await expect(client.connect(transport)).resolves.not.toThrow();
  });

  test('should handle server process lifecycle correctly', async () => {
    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'test-lifecycle-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect
    await client.connect(transport);
    
    // Verify connection by listing tools
    const toolsResult = await client.listTools();
    expect(toolsResult.tools).toBeDefined();
    expect(toolsResult.tools.length).toBeGreaterThan(0);

    // Clean disconnect
    await client.close();
    
    // Should not be able to list tools after closing
    await expect(client.listTools()).rejects.toThrow();
  });

  test('should handle process environment variables correctly', async () => {
    // Test with different environment configuration
    const testEnv = {
      ...process.env,
      FRESHDESK_DOMAIN: 'custom-domain',
      FRESHDESK_API_KEY: 'custom-api-key',
      FRESHDESK_MAX_RETRIES: '5',
      FRESHDESK_TIMEOUT: '60000',
      FRESHDESK_RATE_LIMIT: '100',
      SKIP_CONNECTION_TEST: 'true',
    };

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: testEnv,
    });

    client = new Client(
      {
        name: 'test-env-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should start successfully with custom environment
    await expect(client.connect(transport)).resolves.not.toThrow();
    
    // Verify server is running with custom config by listing tools
    const toolsResult = await client.listTools();
    expect(toolsResult.tools.length).toBe(5);
  });

  test('should handle invalid environment gracefully', async () => {
    const invalidEnv = {
      ...process.env,
      FRESHDESK_DOMAIN: '', // Invalid empty domain
      FRESHDESK_API_KEY: 'test-key',
    };

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: invalidEnv,
    });

    client = new Client(
      {
        name: 'test-invalid-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should fail to connect due to invalid configuration
    await expect(client.connect(transport)).rejects.toThrow();
  });

  test('should handle server crashes gracefully', async () => {
    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'test-crash-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    
    // Verify initial connection
    const toolsResult = await client.listTools();
    expect(toolsResult.tools.length).toBe(5);

    // Close connection (simulates crash)
    await client.close();
    
    // Subsequent calls should fail gracefully
    await expect(client.listTools()).rejects.toThrow();
  });

  test('should validate process stdio communication', async () => {
    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'test-stdio-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);

    // Test multiple sequential communications
    for (let i = 0; i < 3; i++) {
      const toolsResult = await client.listTools();
      expect(toolsResult.tools).toBeDefined();
      expect(toolsResult.tools.length).toBe(5);
    }

    // Test tool execution through stdio
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 5 }
      }
    });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');
  });

  test('should handle concurrent process connections', async () => {
    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    // Create multiple clients
    const clients: Client[] = [];
    const transports: StdioClientTransport[] = [];

    try {
      // Create 3 concurrent connections
      for (let i = 0; i < 3; i++) {
        const transport = new StdioClientTransport({
          command: 'tsx',
          args: [serverPath],
          env: { ...process.env },
        });

        const client = new Client(
          {
            name: `test-concurrent-client-${i}`,
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        clients.push(client);
        transports.push(transport);
      }

      // Connect all clients concurrently
      await Promise.all(
        clients.map(client => client.connect(transports[clients.indexOf(client)]))
      );

      // Test concurrent tool listing
      const results = await Promise.all(
        clients.map(client => client.listTools())
      );

      // All should succeed
      results.forEach(result => {
        expect(result.tools.length).toBe(5);
      });

    } finally {
      // Clean up all clients
      await Promise.all(
        clients.map(async (client) => {
          try {
            await client.close();
          } catch (error) {
            // Ignore cleanup errors
          }
        })
      );
    }
  });
});