/**
 * Performance Testing
 * 
 * Validates MCP server performance under concurrent load and stress testing.
 * Tests response times, memory usage, and concurrent operation handling.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Performance Testing', () => {
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
        name: 'performance-test-client',
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

  test('should handle tool listing within performance threshold', async () => {
    const iterations = 10;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const result = await client.listTools();
      expect(result.tools.length).toBe(5);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    
    // Should average less than 100ms per call
    expect(averageTime).toBeLessThan(100);
    console.log(`Average tool listing time: ${averageTime.toFixed(2)}ms`);
  });

  test('should handle tool execution within performance threshold', async () => {
    const iterations = 10;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const result = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: { page: 1, per_page: 5 }
        }
      });
      expect(result.content).toBeDefined();
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    
    // Should average less than 500ms per tool call
    expect(averageTime).toBeLessThan(500);
    console.log(`Average tool execution time: ${averageTime.toFixed(2)}ms`);
  });

  test('should handle concurrent tool calls efficiently', async () => {
    const concurrency = 10;
    const startTime = performance.now();
    
    const promises = Array(concurrency).fill(0).map((_, i) => {
      return client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: { page: 1, per_page: 5 }
        }
      });
    });
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // All calls should succeed
    expect(results.length).toBe(concurrency);
    results.forEach(result => {
      expect(result.content).toBeDefined();
    });
    
    // Concurrent calls should complete within reasonable time
    expect(totalTime).toBeLessThan(3000); // 3 seconds for 10 concurrent calls
    console.log(`Concurrent calls (${concurrency}) completed in: ${totalTime.toFixed(2)}ms`);
  });

  test('should handle high-frequency sequential calls', async () => {
    const callCount = 50;
    const startTime = performance.now();
    
    for (let i = 0; i < callCount; i++) {
      const result = await client.listTools();
      expect(result.tools.length).toBe(5);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const callsPerSecond = (callCount / totalTime) * 1000;
    
    // Should handle at least 10 calls per second
    expect(callsPerSecond).toBeGreaterThan(10);
    console.log(`Sequential call rate: ${callsPerSecond.toFixed(2)} calls/second`);
  });

  test('should handle large payload efficiently', async () => {
    const largeParams = {
      page: 1,
      per_page: 100,
      search: 'a'.repeat(1000),
      filters: Object.fromEntries(
        Array(50).fill(0).map((_, i) => [`filter_${i}`, `value_${i}`])
      ),
      metadata: Array(100).fill(0).map((_, i) => ({
        id: i,
        data: 'x'.repeat(100)
      }))
    };

    const startTime = performance.now();
    
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: largeParams
      }
    });
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(result.content).toBeDefined();
    
    // Large payload should still execute within reasonable time
    expect(executionTime).toBeLessThan(2000); // 2 seconds
    console.log(`Large payload execution time: ${executionTime.toFixed(2)}ms`);
  });

  test('should handle mixed tool operations efficiently', async () => {
    const operations = [
      () => client.listTools(),
      () => client.callTool({
        name: 'tickets_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
      () => client.callTool({
        name: 'contacts_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
      () => client.callTool({
        name: 'agents_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
      () => client.callTool({
        name: 'companies_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
    ];

    const iterations = 20;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const operation = operations[i % operations.length];
      const result = await operation();
      expect(result).toBeDefined();
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    
    // Mixed operations should average reasonable time
    expect(averageTime).toBeLessThan(200);
    console.log(`Mixed operations average time: ${averageTime.toFixed(2)}ms`);
  });

  test('should handle rapid connection cycling', async () => {
    const cycles = 5;
    const startTime = performance.now();
    
    for (let i = 0; i < cycles; i++) {
      // Close current connection
      await client.close();
      
      // Create new connection
      const serverPath = path.resolve(__dirname, '../../src/index.ts');
      
      transport = new StdioClientTransport({
        command: 'tsx',
        args: [serverPath],
        env: { ...process.env },
      });

      client = new Client(
        {
          name: `performance-cycle-client-${i}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);
      
      // Test functionality
      const result = await client.listTools();
      expect(result.tools.length).toBe(5);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageConnectionTime = totalTime / cycles;
    
    // Connection cycling should be reasonably fast
    expect(averageConnectionTime).toBeLessThan(3000); // 3 seconds per cycle
    console.log(`Average connection cycle time: ${averageConnectionTime.toFixed(2)}ms`);
  });

  test('should handle stress test with multiple concurrent clients', async () => {
    const clientCount = 5;
    const operationsPerClient = 10;
    
    const clients: Client[] = [];
    const transports: StdioClientTransport[] = [];
    
    try {
      const startTime = performance.now();
      
      // Create multiple clients
      for (let i = 0; i < clientCount; i++) {
        const serverPath = path.resolve(__dirname, '../../src/index.ts');
        
        const transport = new StdioClientTransport({
          command: 'tsx',
          args: [serverPath],
          env: { ...process.env },
        });

        const client = new Client(
          {
            name: `stress-test-client-${i}`,
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        await client.connect(transport);
        
        clients.push(client);
        transports.push(transport);
      }
      
      // Run operations concurrently across all clients
      const allPromises = clients.flatMap(client =>
        Array(operationsPerClient).fill(0).map((_, opIndex) =>
          client.callTool({
            name: 'tickets_manage',
            arguments: {
              action: 'list',
              params: { page: 1, per_page: 5 }
            }
          })
        )
      );
      
      const results = await Promise.all(allPromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // All operations should succeed
      expect(results.length).toBe(clientCount * operationsPerClient);
      results.forEach(result => {
        expect(result.content).toBeDefined();
      });
      
      const operationsPerSecond = (results.length / totalTime) * 1000;
      
      // Should handle reasonable throughput
      expect(operationsPerSecond).toBeGreaterThan(5);
      console.log(`Stress test throughput: ${operationsPerSecond.toFixed(2)} ops/second`);
      
    } finally {
      // Clean up all clients
      await Promise.all(clients.map(async (client) => {
        try {
          await client.close();
        } catch (error) {
          // Ignore cleanup errors
        }
      }));
    }
  });

  test('should maintain performance under memory pressure', async () => {
    // Create large objects to simulate memory pressure
    const memoryPressure: any[] = [];
    
    try {
      // Allocate some memory
      for (let i = 0; i < 100; i++) {
        memoryPressure.push(new Array(1000).fill(`data_${i}`));
      }
      
      const startTime = performance.now();
      
      // Perform operations under memory pressure
      for (let i = 0; i < 10; i++) {
        const result = await client.callTool({
          name: 'contacts_manage',
          arguments: {
            action: 'list',
            params: { page: 1, per_page: 20 }
          }
        });
        expect(result.content).toBeDefined();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 10;
      
      // Should still perform reasonably under memory pressure
      expect(averageTime).toBeLessThan(1000); // 1 second per operation
      console.log(`Performance under memory pressure: ${averageTime.toFixed(2)}ms average`);
      
    } finally {
      // Clean up memory
      memoryPressure.length = 0;
    }
  });

  test('should handle error scenarios without performance degradation', async () => {
    const iterations = 20;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      // Mix of valid and invalid calls
      if (i % 3 === 0) {
        // Invalid tool call
        const result = await client.callTool({
          name: 'tickets_manage',
          arguments: {
            action: 'invalid_action',
            params: {}
          }
        });
        expect(result.content).toBeDefined();
      } else {
        // Valid call
        const result = await client.listTools();
        expect(result.tools.length).toBe(5);
      }
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    
    // Error handling shouldn't significantly impact performance
    expect(averageTime).toBeLessThan(300);
    console.log(`Average time with errors: ${averageTime.toFixed(2)}ms`);
  });
});