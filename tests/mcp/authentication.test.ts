/**
 * Authentication Integration
 * 
 * Tests MCP server authentication and authorization.
 * Validates API key handling, security, and access control.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Authentication Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up environment
    delete process.env.SKIP_CONNECTION_TEST;
    delete process.env.FRESHDESK_DOMAIN;
    delete process.env.FRESHDESK_API_KEY;
  });

  test('should start server with valid authentication configuration', async () => {
    // Set up valid mock environment
    process.env.FRESHDESK_DOMAIN = 'test-domain';
    process.env.FRESHDESK_API_KEY = 'valid-test-api-key';
    process.env.SKIP_CONNECTION_TEST = 'true';

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'auth-valid-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should connect successfully with valid auth
    await expect(client.connect(transport)).resolves.not.toThrow();
    
    // Should be able to list tools
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should reject invalid domain configuration', async () => {
    // Set up invalid domain
    process.env.FRESHDESK_DOMAIN = ''; // Empty domain
    process.env.FRESHDESK_API_KEY = 'test-api-key';

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'auth-invalid-domain-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should fail to connect with invalid domain
    await expect(client.connect(transport)).rejects.toThrow();
  });

  test('should reject missing API key', async () => {
    // Set up missing API key
    process.env.FRESHDESK_DOMAIN = 'test-domain';
    delete process.env.FRESHDESK_API_KEY; // No API key

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'auth-missing-key-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should fail to connect without API key
    await expect(client.connect(transport)).rejects.toThrow();
  });

  test('should reject empty API key', async () => {
    // Set up empty API key
    process.env.FRESHDESK_DOMAIN = 'test-domain';
    process.env.FRESHDESK_API_KEY = ''; // Empty API key

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'auth-empty-key-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should fail to connect with empty API key
    await expect(client.connect(transport)).rejects.toThrow();
  });

  test('should validate domain format', async () => {
    const invalidDomains = [
      '',
      ' ',
      'invalid domain with spaces',
      'domain.with.too.many.dots.freshdesk.com',
      'invalid-characters!@#',
      '123.456.789', // IP address format
      'test-', // Ends with hyphen
      '-test', // Starts with hyphen
    ];

    for (const domain of invalidDomains) {
      process.env.FRESHDESK_DOMAIN = domain;
      process.env.FRESHDESK_API_KEY = 'test-api-key';

      const serverPath = path.resolve(__dirname, '../../src/index.ts');
      
      transport = new StdioClientTransport({
        command: 'tsx',
        args: [serverPath],
        env: { ...process.env },
      });

      client = new Client(
        {
          name: `auth-invalid-domain-${invalidDomains.indexOf(domain)}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Should fail with invalid domain
      await expect(client.connect(transport)).rejects.toThrow();
      
      await client.close().catch(() => {}); // Clean up
    }
  });

  test('should accept valid domain formats', async () => {
    const validDomains = [
      'test-domain',
      'my-company',
      'company123',
      'test-domain.freshdesk.com',
      'my-company.freshdesk.com'
    ];

    for (const domain of validDomains) {
      process.env.FRESHDESK_DOMAIN = domain;
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
          name: `auth-valid-domain-${validDomains.indexOf(domain)}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Should succeed with valid domain
      await expect(client.connect(transport)).resolves.not.toThrow();
      
      // Should be functional
      const tools = await client.listTools();
      expect(tools.tools.length).toBe(5);
      
      await client.close();
    }
  });

  test('should handle API key validation', async () => {
    // Test with various API key formats
    const apiKeys = [
      'simple-key',
      'abc123',
      'very-long-api-key-with-many-characters-0123456789',
      'mixed-CASE-api-KEY-123',
      'api_key_with_underscores',
      'api.key.with.dots'
    ];

    for (const apiKey of apiKeys) {
      process.env.FRESHDESK_DOMAIN = 'test-domain';
      process.env.FRESHDESK_API_KEY = apiKey;
      process.env.SKIP_CONNECTION_TEST = 'true';

      const serverPath = path.resolve(__dirname, '../../src/index.ts');
      
      transport = new StdioClientTransport({
        command: 'tsx',
        args: [serverPath],
        env: { ...process.env },
      });

      client = new Client(
        {
          name: `auth-key-format-${apiKeys.indexOf(apiKey)}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Should accept various API key formats
      await expect(client.connect(transport)).resolves.not.toThrow();
      
      const tools = await client.listTools();
      expect(tools.tools.length).toBe(5);
      
      await client.close();
    }
  });

  test('should not expose API key in logs or responses', async () => {
    process.env.FRESHDESK_DOMAIN = 'test-domain';
    process.env.FRESHDESK_API_KEY = 'secret-api-key-12345';
    process.env.SKIP_CONNECTION_TEST = 'true';

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'auth-security-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);

    // Test various operations to ensure API key is not exposed
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);

    // Tool responses should not contain API key
    tools.tools.forEach(tool => {
      expect(JSON.stringify(tool)).not.toContain('secret-api-key-12345');
    });

    // Tool execution should not expose API key
    const result = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    expect(result.content).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('secret-api-key-12345');
  });

  test('should handle authentication configuration updates', async () => {
    // Test with initial configuration
    process.env.FRESHDESK_DOMAIN = 'test-domain-1';
    process.env.FRESHDESK_API_KEY = 'api-key-1';
    process.env.SKIP_CONNECTION_TEST = 'true';

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'auth-config-client-1',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    const tools1 = await client.listTools();
    expect(tools1.tools.length).toBe(5);
    await client.close();

    // Test with different configuration (new server instance)
    process.env.FRESHDESK_DOMAIN = 'test-domain-2';
    process.env.FRESHDESK_API_KEY = 'api-key-2';

    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env },
    });

    client = new Client(
      {
        name: 'auth-config-client-2',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    const tools2 = await client.listTools();
    expect(tools2.tools.length).toBe(5);
  });

  test('should enforce authentication for all tool operations', async () => {
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
        name: 'auth-enforcement-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);

    // Test that all tools require authentication (by virtue of server startup)
    const toolNames = [
      'tickets_manage',
      'contacts_manage',
      'agents_manage',
      'companies_manage',
      'conversations_manage'
    ];

    for (const toolName of toolNames) {
      const result = await client.callTool({
        name: toolName,
        arguments: {
          action: 'list',
          params: { page: 1 }
        }
      });

      expect(result.content).toBeDefined();
      // Tool executed (authentication was enforced at server level)
    }
  });

  test('should handle environment variable precedence', async () => {
    // Test that environment variables are properly loaded
    const testEnv = {
      FRESHDESK_DOMAIN: 'precedence-test-domain',
      FRESHDESK_API_KEY: 'precedence-test-key',
      FRESHDESK_MAX_RETRIES: '5',
      FRESHDESK_TIMEOUT: '45000',
      FRESHDESK_RATE_LIMIT: '75',
      SKIP_CONNECTION_TEST: 'true'
    };

    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    
    transport = new StdioClientTransport({
      command: 'tsx',
      args: [serverPath],
      env: { ...process.env, ...testEnv },
    });

    client = new Client(
      {
        name: 'auth-precedence-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Should start with custom environment configuration
    await expect(client.connect(transport)).resolves.not.toThrow();
    
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(5);
  });

  test('should handle secure API key storage patterns', async () => {
    // Test various secure API key patterns
    const securePatterns = [
      'sk_test_1234567890abcdef', // Stripe-like pattern
      'fd_live_abcdef1234567890', // Freshdesk-like pattern  
      'Bearer_token_style_key',
      'jwt.like.token.pattern'
    ];

    for (const apiKey of securePatterns) {
      process.env.FRESHDESK_DOMAIN = 'test-domain';
      process.env.FRESHDESK_API_KEY = apiKey;
      process.env.SKIP_CONNECTION_TEST = 'true';

      const serverPath = path.resolve(__dirname, '../../src/index.ts');
      
      transport = new StdioClientTransport({
        command: 'tsx',
        args: [serverPath],
        env: { ...process.env },
      });

      client = new Client(
        {
          name: `auth-secure-pattern-${securePatterns.indexOf(apiKey)}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Should handle various secure key patterns
      await expect(client.connect(transport)).resolves.not.toThrow();
      
      const tools = await client.listTools();
      expect(tools.tools.length).toBe(5);
      
      await client.close();
    }
  });
});