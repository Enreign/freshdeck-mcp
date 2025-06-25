/**
 * Error Recovery Testing
 * 
 * Tests MCP protocol error handling and recovery scenarios.
 * Validates graceful handling of various error conditions.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Error Recovery Testing', () => {
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
        name: 'error-recovery-client',
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

  test('should handle unknown tool names gracefully', async () => {
    await expect(client.callTool({
      name: 'nonexistent_tool',
      arguments: {}
    })).rejects.toThrow();

    // Should still work after error
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should handle malformed tool arguments gracefully', async () => {
    // Missing required fields
    const result1 = await client.callTool({
      name: 'tickets_manage',
      arguments: {} // Missing action and params
    });

    expect(result1.content).toBeDefined();
    const response1 = JSON.parse((result1.content[0] as any).text);
    expect(response1.error).toBe(true);

    // Invalid action
    const result2 = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'invalid_action',
        params: {}
      }
    });

    expect(result2.content).toBeDefined();
    const response2 = JSON.parse((result2.content[0] as any).text);
    expect(response2.error).toBe(true);

    // Should still work after errors
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should handle invalid JSON in arguments', async () => {
    // Test with various invalid argument structures
    const invalidArguments = [
      null,
      undefined,
      'string_instead_of_object',
      123,
      [],
      { action: null },
      { action: 'list', params: 'invalid_params' }
    ];

    for (const args of invalidArguments) {
      try {
        const result = await client.callTool({
          name: 'tickets_manage',
          arguments: args as any
        });
        
        // Should return error in content, not throw
        expect(result.content).toBeDefined();
        if (result.content[0] && (result.content[0] as any).text) {
          const response = JSON.parse((result.content[0] as any).text);
          expect(response.error).toBe(true);
        }
      } catch (error) {
        // Some invalid arguments might cause protocol-level errors
        expect(error).toBeDefined();
      }
    }

    // Should still work after all errors
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should recover from network-like errors in tool execution', async () => {
    // Simulate various error conditions that might occur during API calls
    const errorProducingCalls = [
      {
        name: 'tickets_manage',
        arguments: {
          action: 'create',
          params: {
            // Missing required fields to trigger validation errors
            description: 'Test ticket'
            // Missing email, subject, etc.
          }
        }
      },
      {
        name: 'contacts_manage',
        arguments: {
          action: 'create',
          params: {
            // Invalid email format
            name: 'Test Contact',
            email: 'invalid-email-format'
          }
        }
      }
    ];

    for (const call of errorProducingCalls) {
      const result = await client.callTool(call);
      expect(result.content).toBeDefined();
      
      // Error should be returned in content
      const response = JSON.parse((result.content[0] as any).text);
      expect(response.error).toBe(true);
      expect(response.message).toBeDefined();
    }

    // Should recover and work normally
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should handle concurrent errors without affecting other operations', async () => {
    const validCall = client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    const invalidCall1 = client.callTool({
      name: 'invalid_tool',
      arguments: {}
    });

    const invalidCall2 = client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'invalid_action',
        params: {}
      }
    });

    const anotherValidCall = client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    const results = await Promise.allSettled([
      validCall,
      invalidCall1,
      invalidCall2,
      anotherValidCall
    ]);

    // Valid calls should succeed
    expect(results[0].status).toBe('fulfilled');
    expect(results[3].status).toBe('fulfilled');

    // Invalid calls should be rejected or return errors
    expect(results[1].status).toBe('rejected');
    
    // Invalid action should return error in content
    if (results[2].status === 'fulfilled') {
      const response = JSON.parse(((results[2].value as any).content[0] as any).text);
      expect(response.error).toBe(true);
    }

    // Should still work after mixed results
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should handle rapid error recovery', async () => {
    // Rapid sequence of invalid calls followed by valid ones
    for (let i = 0; i < 10; i++) {
      try {
        await client.callTool({
          name: 'invalid_tool_' + i,
          arguments: {}
        });
      } catch (error) {
        // Expected to fail
      }

      // Immediately follow with valid call
      const result = await client.listTools();
      expect(result.tools.length).toBe(5);
    }
  });

  test('should handle errors in tool schema validation', async () => {
    // Test with arguments that don't match schema
    const invalidSchemaArgs = [
      {
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {
            page: 'not_a_number',
            per_page: -1
          }
        }
      },
      {
        name: 'contacts_manage',
        arguments: {
          action: 'create',
          params: {
            name: '', // Empty required field
            email: null
          }
        }
      }
    ];

    for (const call of invalidSchemaArgs) {
      const result = await client.callTool(call);
      expect(result.content).toBeDefined();
      
      // Should return error for invalid schema
      const response = JSON.parse((result.content[0] as any).text);
      expect(response.error).toBe(true);
    }

    // Should continue working
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should handle memory exhaustion gracefully', async () => {
    // Try to cause memory pressure with large payloads
    const largeData = 'x'.repeat(1000000); // 1MB string
    
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: {
          search: largeData,
          metadata: Array(100).fill(largeData)
        }
      }
    });

    expect(result.content).toBeDefined();
    
    // Should still work after large payload
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should handle timeout scenarios', async () => {
    // Test with operations that might timeout
    const timeoutTest = async () => {
      const startTime = Date.now();
      
      const result = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {
            page: 1,
            per_page: 1000 // Large page size
          }
        }
      });
      
      const duration = Date.now() - startTime;
      
      expect(result.content).toBeDefined();
      expect(duration).toBeLessThan(30000); // Should not take more than 30 seconds
    };

    await timeoutTest();

    // Should continue working after potential timeout scenario
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should maintain error context across operations', async () => {
    // Sequence of operations to test error context preservation
    const operations = [
      () => client.callTool({
        name: 'invalid_tool',
        arguments: {}
      }),
      () => client.listTools(),
      () => client.callTool({
        name: 'tickets_manage',
        arguments: { action: 'invalid', params: {} }
      }),
      () => client.callTool({
        name: 'tickets_manage',
        arguments: { action: 'list', params: { page: 1 } }
      }),
      () => client.listTools()
    ];

    const results = [];
    
    for (const operation of operations) {
      try {
        const result = await operation();
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error });
      }
    }

    // Check pattern: error, success, error (in content), success, success
    expect(results[0].success).toBe(false); // invalid_tool
    expect(results[1].success).toBe(true);  // listTools
    expect(results[2].success).toBe(true);  // invalid action (error in content)
    expect(results[3].success).toBe(true);  // valid call
    expect(results[4].success).toBe(true);  // listTools

    // Verify error was returned in content for invalid action
    if (results[2].success) {
      const response = JSON.parse(((results[2].result as any).content[0] as any).text);
      expect(response.error).toBe(true);
    }
  });

  test('should handle protocol-level errors gracefully', async () => {
    // Test various edge cases that might cause protocol errors
    
    // Valid operation after setup
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);

    // Try various edge cases
    const edgeCases = [
      {
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {
            // Very deep nesting
            nested: {
              level1: {
                level2: {
                  level3: {
                    level4: {
                      level5: 'deep_value'
                    }
                  }
                }
              }
            }
          }
        }
      }
    ];

    for (const testCase of edgeCases) {
      const result = await client.callTool(testCase);
      expect(result.content).toBeDefined();
    }

    // Should still be functional
    const finalTools = await client.listTools();
    expect(finalTools.tools.length).toBe(5);
  });
});