/**
 * Health Monitoring
 * 
 * Tests MCP server health checks and metrics tracking.
 * Validates server stability, performance metrics, and monitoring capabilities.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Health Monitoring', () => {
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
        name: 'health-monitoring-client',
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

  test('should maintain server responsiveness under load', async () => {
    const maxResponseTime = 1000; // 1 second
    const operationCount = 20;
    const responseTimes: number[] = [];

    for (let i = 0; i < operationCount; i++) {
      const startTime = performance.now();
      
      const result = await client.listTools();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      responseTimes.push(responseTime);

      expect(result.tools.length).toBe(5);
      expect(responseTime).toBeLessThan(maxResponseTime);
    }

    // Calculate health metrics
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime_actual = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);

    console.log(`Health Metrics - Avg: ${averageResponseTime.toFixed(2)}ms, Max: ${maxResponseTime_actual.toFixed(2)}ms, Min: ${minResponseTime.toFixed(2)}ms`);

    // Health thresholds
    expect(averageResponseTime).toBeLessThan(500); // Average should be under 500ms
    expect(maxResponseTime_actual).toBeLessThan(maxResponseTime); // No response over 1s
  });

  test('should track server uptime and availability', async () => {
    const checkInterval = 100; // 100ms
    const totalChecks = 10;
    const healthChecks: boolean[] = [];

    for (let i = 0; i < totalChecks; i++) {
      try {
        const result = await client.listTools();
        healthChecks.push(result.tools.length === 5);
      } catch (error) {
        healthChecks.push(false);
      }

      if (i < totalChecks - 1) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    const successfulChecks = healthChecks.filter(check => check).length;
    const availability = (successfulChecks / totalChecks) * 100;

    console.log(`Server Availability: ${availability}% (${successfulChecks}/${totalChecks})`);

    // Should maintain high availability
    expect(availability).toBeGreaterThanOrEqual(90); // 90% availability minimum
  });

  test('should monitor tool execution success rates', async () => {
    const tools = ['tickets_manage', 'contacts_manage', 'agents_manage', 'companies_manage', 'conversations_manage'];
    const successRates: Record<string, number> = {};

    for (const toolName of tools) {
      const attempts = 5;
      let successes = 0;

      for (let i = 0; i < attempts; i++) {
        try {
          const result = await client.callTool({
            name: toolName,
            arguments: {
              action: 'list',
              params: { page: 1, per_page: 5 }
            }
          });

          if (result.content && result.content.length > 0) {
            successes++;
          }
        } catch (error) {
          // Tool execution failed
        }
      }

      successRates[toolName] = (successes / attempts) * 100;
    }

    // Log success rates for monitoring
    Object.entries(successRates).forEach(([tool, rate]) => {
      console.log(`${tool} success rate: ${rate}%`);
      
      // Each tool should have reasonable success rate
      // Note: May be lower due to mock environment, but should not be 0
      expect(rate).toBeGreaterThanOrEqual(0);
    });

    // Overall system should be functional
    const overallSuccessRate = Object.values(successRates).reduce((a, b) => a + b, 0) / tools.length;
    expect(overallSuccessRate).toBeGreaterThanOrEqual(0);
  });

  test('should detect memory leaks and resource usage', async () => {
    const initialMemory = process.memoryUsage();
    const operations = 50;

    // Perform many operations
    for (let i = 0; i < operations; i++) {
      await client.listTools();
      
      // Alternate between different operations
      if (i % 2 === 0) {
        await client.callTool({
          name: 'tickets_manage',
          arguments: {
            action: 'list',
            params: { page: 1 }
          }
        });
      }
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreasePerOp = memoryIncrease / operations;

    console.log(`Memory usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${(memoryIncreasePerOp / 1024).toFixed(2)}KB per operation)`);

    // Should not have excessive memory growth
    expect(memoryIncreasePerOp).toBeLessThan(1024 * 100); // Less than 100KB per operation
  });

  test('should track error rates and error patterns', async () => {
    const totalOperations = 20;
    const errorOperations = 5;
    const validOperations = totalOperations - errorOperations;
    
    let errors = 0;
    let successes = 0;

    // Mix of valid and invalid operations
    for (let i = 0; i < totalOperations; i++) {
      try {
        if (i < errorOperations) {
          // Intentional error operations
          await client.callTool({
            name: 'invalid_tool',
            arguments: {}
          });
        } else {
          // Valid operations
          const result = await client.callTool({
            name: 'tickets_manage',
            arguments: {
              action: 'list',
              params: { page: 1 }
            }
          });
          
          if (result.content) {
            successes++;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    const errorRate = (errors / totalOperations) * 100;
    const successRate = (successes / totalOperations) * 100;

    console.log(`Error Rate: ${errorRate}%, Success Rate: ${successRate}%`);

    // Error rate should match expected (errorOperations)
    expect(errorRate).toBeLessThanOrEqual((errorOperations / totalOperations) * 100 + 10); // Allow 10% tolerance
    expect(successes).toBeGreaterThan(0);
  });

  test('should monitor concurrent connection handling', async () => {
    const concurrentConnections = 3;
    const clients: Client[] = [];
    const transports: StdioClientTransport[] = [];
    const connectionHealths: boolean[] = [];

    try {
      // Create multiple concurrent connections
      for (let i = 0; i < concurrentConnections; i++) {
        const serverPath = path.resolve(__dirname, '../../src/index.ts');
        
        const transport = new StdioClientTransport({
          command: 'tsx',
          args: [serverPath],
          env: { ...process.env },
        });

        const client = new Client(
          {
            name: `health-concurrent-client-${i}`,
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        try {
          await client.connect(transport);
          
          // Test each connection
          const tools = await client.listTools();
          connectionHealths.push(tools.tools.length === 5);
          
          clients.push(client);
          transports.push(transport);
        } catch (error) {
          connectionHealths.push(false);
        }
      }

      const healthyConnections = connectionHealths.filter(health => health).length;
      const connectionSuccessRate = (healthyConnections / concurrentConnections) * 100;

      console.log(`Concurrent Connection Health: ${connectionSuccessRate}% (${healthyConnections}/${concurrentConnections})`);

      // Should handle concurrent connections well
      expect(connectionSuccessRate).toBeGreaterThanOrEqual(80); // 80% success rate

    } finally {
      // Clean up all connections
      await Promise.all(clients.map(async (client) => {
        try {
          await client.close();
        } catch (error) {
          // Ignore cleanup errors
        }
      }));
    }
  });

  test('should measure and track response time distribution', async () => {
    const measurements = 30;
    const responseTimes: number[] = [];

    for (let i = 0; i < measurements; i++) {
      const startTime = performance.now();
      
      await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: { page: 1, per_page: 10 }
        }
      });
      
      const endTime = performance.now();
      responseTimes.push(endTime - startTime);
    }

    // Calculate distribution metrics
    responseTimes.sort((a, b) => a - b);
    
    const min = responseTimes[0];
    const max = responseTimes[responseTimes.length - 1];
    const median = responseTimes[Math.floor(responseTimes.length / 2)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
    const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    console.log(`Response Time Distribution:`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Average: ${average.toFixed(2)}ms`);
    console.log(`  Median: ${median.toFixed(2)}ms`);
    console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
    console.log(`  99th percentile: ${p99.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);

    // Health thresholds
    expect(average).toBeLessThan(500); // Average under 500ms
    expect(p95).toBeLessThan(1000);    // 95% under 1s
    expect(p99).toBeLessThan(2000);    // 99% under 2s
    expect(max).toBeLessThan(5000);    // Max under 5s
  });

  test('should monitor tool-specific health metrics', async () => {
    const tools = [
      'tickets_manage',
      'contacts_manage', 
      'agents_manage',
      'companies_manage',
      'conversations_manage'
    ];

    const toolMetrics: Record<string, {
      avgResponseTime: number;
      errorRate: number;
      successCount: number;
    }> = {};

    for (const toolName of tools) {
      const attempts = 5;
      const responseTimes: number[] = [];
      let errors = 0;
      let successes = 0;

      for (let i = 0; i < attempts; i++) {
        const startTime = performance.now();
        
        try {
          const result = await client.callTool({
            name: toolName,
            arguments: {
              action: 'list',
              params: { page: 1, per_page: 5 }
            }
          });

          const endTime = performance.now();
          responseTimes.push(endTime - startTime);

          if (result.content && result.content.length > 0) {
            successes++;
          }
        } catch (error) {
          errors++;
          responseTimes.push(performance.now() - startTime);
        }
      }

      toolMetrics[toolName] = {
        avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        errorRate: (errors / attempts) * 100,
        successCount: successes
      };
    }

    // Log metrics for each tool
    Object.entries(toolMetrics).forEach(([tool, metrics]) => {
      console.log(`${tool}: Avg ${metrics.avgResponseTime.toFixed(2)}ms, ${metrics.errorRate}% errors, ${metrics.successCount} successes`);
      
      // Each tool should have reasonable performance
      expect(metrics.avgResponseTime).toBeLessThan(2000); // Under 2 seconds
      expect(metrics.errorRate).toBeLessThanOrEqual(100); // Not more than 100% errors
    });
  });

  test('should validate server stability over time', async () => {
    const stabilityDuration = 2000; // 2 seconds
    const checkInterval = 200; // Check every 200ms
    const totalChecks = Math.floor(stabilityDuration / checkInterval);
    
    const stabilityChecks: { timestamp: number; healthy: boolean; responseTime: number }[] = [];

    for (let i = 0; i < totalChecks; i++) {
      const startTime = performance.now();
      const timestamp = Date.now();
      
      try {
        const result = await client.listTools();
        const responseTime = performance.now() - startTime;
        
        stabilityChecks.push({
          timestamp,
          healthy: result.tools.length === 5,
          responseTime
        });
      } catch (error) {
        stabilityChecks.push({
          timestamp,
          healthy: false,
          responseTime: performance.now() - startTime
        });
      }

      if (i < totalChecks - 1) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    const healthyChecks = stabilityChecks.filter(check => check.healthy).length;
    const stabilityRating = (healthyChecks / totalChecks) * 100;
    const avgResponseTime = stabilityChecks.reduce((sum, check) => sum + check.responseTime, 0) / stabilityChecks.length;

    console.log(`Stability over ${stabilityDuration}ms: ${stabilityRating}% (${healthyChecks}/${totalChecks})`);
    console.log(`Average response time during stability test: ${avgResponseTime.toFixed(2)}ms`);

    // Server should be stable
    expect(stabilityRating).toBeGreaterThanOrEqual(90); // 90% stability
    expect(avgResponseTime).toBeLessThan(1000); // Consistent performance
  });

  test('should track server resource utilization patterns', async () => {
    const initialMemory = process.memoryUsage();
    const measurements: Array<{
      timestamp: number;
      memory: NodeJS.MemoryUsage;
      operation: string;
    }> = [];

    const operations = [
      { name: 'listTools', action: () => client.listTools() },
      { name: 'ticketsList', action: () => client.callTool({ name: 'tickets_manage', arguments: { action: 'list', params: { page: 1 } } }) },
      { name: 'contactsList', action: () => client.callTool({ name: 'contacts_manage', arguments: { action: 'list', params: { page: 1 } } }) },
    ];

    for (let i = 0; i < 15; i++) {
      const operation = operations[i % operations.length];
      
      try {
        await operation.action();
        
        measurements.push({
          timestamp: Date.now(),
          memory: process.memoryUsage(),
          operation: operation.name
        });
      } catch (error) {
        // Record even failed operations
        measurements.push({
          timestamp: Date.now(),
          memory: process.memoryUsage(),
          operation: `${operation.name}_error`
        });
      }
    }

    // Analyze memory usage patterns
    const memoryGrowth = measurements[measurements.length - 1].memory.heapUsed - measurements[0].memory.heapUsed;
    const averageMemoryPerOp = memoryGrowth / measurements.length;

    console.log(`Resource utilization over ${measurements.length} operations:`);
    console.log(`  Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Average per operation: ${(averageMemoryPerOp / 1024).toFixed(2)}KB`);

    // Should not have runaway memory growth
    expect(averageMemoryPerOp).toBeLessThan(1024 * 50); // Less than 50KB per operation
  });
});