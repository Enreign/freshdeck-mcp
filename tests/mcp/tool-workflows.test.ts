/**
 * Tool Execution Workflows
 * 
 * Tests complete tool execution through MCP protocol.
 * Validates end-to-end workflows and tool interaction patterns.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Tool Execution Workflows', () => {
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
        name: 'workflow-test-client',
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

  test('should execute complete ticket management workflow', async () => {
    // 1. List existing tickets
    const listResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 10 }
      }
    });

    expect(listResult.content).toBeDefined();
    const listResponse = JSON.parse((listResult.content[0] as any).text);
    expect(listResponse).toBeDefined();

    // 2. Create a new ticket
    const createResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'create',
        params: {
          subject: 'Test Workflow Ticket',
          description: 'Created during workflow test',
          email: 'test@example.com',
          priority: 2,
          status: 2
        }
      }
    });

    expect(createResult.content).toBeDefined();
    const createResponse = JSON.parse((createResult.content[0] as any).text);
    expect(createResponse).toBeDefined();

    // 3. Search for tickets
    const searchResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'search',
        params: {
          query: 'Test Workflow',
          page: 1
        }
      }
    });

    expect(searchResult.content).toBeDefined();
    const searchResponse = JSON.parse((searchResult.content[0] as any).text);
    expect(searchResponse).toBeDefined();

    // 4. Get specific ticket (if we had an ID)
    const getResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'get',
        params: { id: 123 }
      }
    });

    expect(getResult.content).toBeDefined();
    // May fail due to invalid ID, but should not crash
  });

  test('should execute complete contact management workflow', async () => {
    // 1. List contacts
    const listResult = await client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 10 }
      }
    });

    expect(listResult.content).toBeDefined();

    // 2. Create contact
    const createResult = await client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'create',
        params: {
          name: 'John Workflow',
          email: 'john.workflow@example.com',
          phone: '+1234567890'
        }
      }
    });

    expect(createResult.content).toBeDefined();

    // 3. Search contacts
    const searchResult = await client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'search',
        params: {
          query: 'john.workflow@example.com',
          page: 1
        }
      }
    });

    expect(searchResult.content).toBeDefined();

    // 4. Update contact
    const updateResult = await client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'update',
        params: {
          id: 123,
          name: 'John Updated Workflow',
          phone: '+1987654321'
        }
      }
    });

    expect(updateResult.content).toBeDefined();
  });

  test('should execute agent management workflow', async () => {
    // 1. Get current agent info
    const meResult = await client.callTool({
      name: 'agents_manage',
      arguments: {
        action: 'me',
        params: {}
      }
    });

    expect(meResult.content).toBeDefined();
    // Note: 'me' action might not be implemented, checking error handling

    // 2. List all agents
    const listResult = await client.callTool({
      name: 'agents_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 10 }
      }
    });

    expect(listResult.content).toBeDefined();

    // 3. Get specific agent
    const getResult = await client.callTool({
      name: 'agents_manage',
      arguments: {
        action: 'get',
        params: { id: 1 }
      }
    });

    expect(getResult.content).toBeDefined();

    // 4. Get agent groups
    const groupsResult = await client.callTool({
      name: 'agents_manage',
      arguments: {
        action: 'groups',
        params: { id: 1 }
      }
    });

    expect(groupsResult.content).toBeDefined();
  });

  test('should execute company management workflow', async () => {
    // 1. List companies
    const listResult = await client.callTool({
      name: 'companies_manage',
      arguments: {
        action: 'list',
        params: { page: 1, per_page: 10 }
      }
    });

    expect(listResult.content).toBeDefined();

    // 2. Create company
    const createResult = await client.callTool({
      name: 'companies_manage',
      arguments: {
        action: 'create',
        params: {
          name: 'Workflow Test Company',
          domains: ['workflow-test.com'],
          description: 'Created during workflow testing'
        }
      }
    });

    expect(createResult.content).toBeDefined();

    // 3. Search companies
    const searchResult = await client.callTool({
      name: 'companies_manage',
      arguments: {
        action: 'search',
        params: {
          query: 'Workflow Test',
          page: 1
        }
      }
    });

    expect(searchResult.content).toBeDefined();

    // 4. Get company contacts
    const contactsResult = await client.callTool({
      name: 'companies_manage',
      arguments: {
        action: 'contacts',
        params: { id: 123 }
      }
    });

    expect(contactsResult.content).toBeDefined();
  });

  test('should execute conversation management workflow', async () => {
    const ticketId = 123;

    // 1. List conversations for a ticket
    const listResult = await client.callTool({
      name: 'conversations_manage',
      arguments: {
        action: 'list',
        params: { ticket_id: ticketId, page: 1, per_page: 10 }
      }
    });

    expect(listResult.content).toBeDefined();

    // 2. Create reply
    const replyResult = await client.callTool({
      name: 'conversations_manage',
      arguments: {
        action: 'reply',
        params: {
          ticket_id: ticketId,
          body: 'This is a workflow test reply',
          from_email: 'agent@company.com'
        }
      }
    });

    expect(replyResult.content).toBeDefined();

    // 3. Create note
    const noteResult = await client.callTool({
      name: 'conversations_manage',
      arguments: {
        action: 'note',
        params: {
          ticket_id: ticketId,
          body: 'Internal note for workflow testing',
          private: true
        }
      }
    });

    expect(noteResult.content).toBeDefined();

    // 4. Get specific conversation
    const getResult = await client.callTool({
      name: 'conversations_manage',
      arguments: {
        action: 'get',
        params: { id: 456 }
      }
    });

    expect(getResult.content).toBeDefined();
  });

  test('should execute cross-tool workflow scenario', async () => {
    // Simulate a complete customer support scenario across multiple tools

    // 1. Create a contact
    const contactResult = await client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'create',
        params: {
          name: 'Cross Tool Customer',
          email: 'cross-tool@example.com'
        }
      }
    });

    expect(contactResult.content).toBeDefined();

    // 2. Create a company for the contact
    const companyResult = await client.callTool({
      name: 'companies_manage',
      arguments: {
        action: 'create',
        params: {
          name: 'Cross Tool Inc',
          domains: ['cross-tool.com']
        }
      }
    });

    expect(companyResult.content).toBeDefined();

    // 3. Create a ticket for the contact
    const ticketResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'create',
        params: {
          subject: 'Cross Tool Support Request',
          description: 'Customer needs help with integration',
          email: 'cross-tool@example.com',
          priority: 2
        }
      }
    });

    expect(ticketResult.content).toBeDefined();

    // 4. Add a reply to the ticket
    const replyResult = await client.callTool({
      name: 'conversations_manage',
      arguments: {
        action: 'reply',
        params: {
          ticket_id: 123, // Would use actual ticket ID in real scenario
          body: 'Thank you for contacting support. We are investigating your issue.',
          from_email: 'support@company.com'
        }
      }
    });

    expect(replyResult.content).toBeDefined();

    // 5. Check agent information
    const agentResult = await client.callTool({
      name: 'agents_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    expect(agentResult.content).toBeDefined();
  });

  test('should handle workflow with error recovery', async () => {
    // Workflow that includes error scenarios and recovery

    // 1. Valid operation
    const validResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    expect(validResult.content).toBeDefined();

    // 2. Invalid operation (should not crash workflow)
    const invalidResult = await client.callTool({
      name: 'tickets_manage',
      arguments: {
        action: 'invalid_action',
        params: {}
      }
    });

    expect(invalidResult.content).toBeDefined();
    const invalidResponse = JSON.parse((invalidResult.content[0] as any).text);
    expect(invalidResponse.error).toBe(true);

    // 3. Recovery with valid operation
    const recoveryResult = await client.callTool({
      name: 'contacts_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    expect(recoveryResult.content).toBeDefined();

    // 4. Continue workflow normally
    const continueResult = await client.callTool({
      name: 'agents_manage',
      arguments: {
        action: 'list',
        params: { page: 1 }
      }
    });

    expect(continueResult.content).toBeDefined();
  });

  test('should handle concurrent workflow operations', async () => {
    // Execute multiple workflows concurrently

    const workflows = [
      // Workflow 1: Ticket operations
      async () => {
        const results = [];
        results.push(await client.callTool({
          name: 'tickets_manage',
          arguments: { action: 'list', params: { page: 1 } }
        }));
        results.push(await client.callTool({
          name: 'tickets_manage',
          arguments: { action: 'search', params: { query: 'test' } }
        }));
        return results;
      },

      // Workflow 2: Contact operations
      async () => {
        const results = [];
        results.push(await client.callTool({
          name: 'contacts_manage',
          arguments: { action: 'list', params: { page: 1 } }
        }));
        results.push(await client.callTool({
          name: 'contacts_manage',
          arguments: { action: 'search', params: { query: 'test' } }
        }));
        return results;
      },

      // Workflow 3: Company operations
      async () => {
        const results = [];
        results.push(await client.callTool({
          name: 'companies_manage',
          arguments: { action: 'list', params: { page: 1 } }
        }));
        results.push(await client.callTool({
          name: 'agents_manage',
          arguments: { action: 'list', params: { page: 1 } }
        }));
        return results;
      }
    ];

    const allResults = await Promise.all(workflows.map(workflow => workflow()));

    // All workflows should complete successfully
    expect(allResults.length).toBe(3);
    allResults.forEach(workflowResults => {
      expect(workflowResults.length).toBeGreaterThan(0);
      workflowResults.forEach(result => {
        expect(result.content).toBeDefined();
      });
    });
  });

  test('should handle complex workflow with all tools', async () => {
    // Complex workflow that uses all available tools

    const operations = [
      { name: 'tickets_manage', action: 'list', params: { page: 1 } },
      { name: 'contacts_manage', action: 'list', params: { page: 1 } },
      { name: 'agents_manage', action: 'list', params: { page: 1 } },
      { name: 'companies_manage', action: 'list', params: { page: 1 } },
      { name: 'conversations_manage', action: 'list', params: { ticket_id: 1, page: 1 } },
      { name: 'tickets_manage', action: 'search', params: { query: 'complex' } },
      { name: 'contacts_manage', action: 'search', params: { query: 'workflow' } },
      { name: 'companies_manage', action: 'search', params: { query: 'test' } }
    ];

    const results = [];

    for (const operation of operations) {
      const result = await client.callTool({
        name: operation.name,
        arguments: {
          action: operation.action,
          params: operation.params
        }
      });

      expect(result.content).toBeDefined();
      results.push(result);

      // Small delay to simulate real workflow timing
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    expect(results.length).toBe(operations.length);

    // All operations should have completed
    results.forEach(result => {
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  test('should maintain state consistency across workflow operations', async () => {
    // Test that tool state remains consistent throughout workflow

    // Initial state check
    const initialTools = await client.listTools();
    expect(initialTools.tools.length).toBe(5);

    // Perform multiple operations
    for (let i = 0; i < 10; i++) {
      await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: { page: 1, per_page: 5 }
        }
      });

      // State should remain consistent
      const tools = await client.listTools();
      expect(tools.tools.length).toBe(5);
    }

    // Final state check
    const finalTools = await client.listTools();
    expect(finalTools.tools.length).toBe(5);
    
    // Tool definitions should be identical
    expect(finalTools.tools).toEqual(initialTools.tools);
  });
});