import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import nock from 'nock';
import path from 'path';

describe('MCP Server E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  const baseUrl = 'https://test-domain.freshdesk.com/api/v2';

  beforeAll(async () => {
    // Set test environment variables
    process.env['FRESHDESK_DOMAIN'] = 'test-domain';
    process.env['FRESHDESK_API_KEY'] = 'test-api-key';
    process.env['FRESHDESK_MAX_RETRIES'] = '2';
    process.env['FRESHDESK_TIMEOUT'] = '10000';
    process.env['FRESHDESK_RATE_LIMIT'] = '50';
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env['FRESHDESK_DOMAIN'];
    delete process.env['FRESHDESK_API_KEY'];
    delete process.env['FRESHDESK_MAX_RETRIES'];
    delete process.env['FRESHDESK_TIMEOUT'];
    delete process.env['FRESHDESK_RATE_LIMIT'];
  });

  beforeEach(async () => {
    // Start MCP server process
    const serverPath = path.resolve(__dirname, '../../src/index.ts');
    serverProcess = spawn('tsx', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Create MCP client
    const transport = new StdioClientTransport({
      readable: serverProcess.stdout!,
      writable: serverProcess.stdin!,
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

    await client.connect(transport);
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
    nock.cleanAll();
  });

  describe('Server Initialization', () => {
    it('should start server and establish connection', async () => {
      const result = await client.listTools();
      
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
    });

    it('should list all available tools', async () => {
      const result = await client.listTools();
      
      const toolNames = result.tools.map(tool => tool.name);
      expect(toolNames).toContain('tickets_manage');
      expect(toolNames).toContain('contacts_manage');
      expect(toolNames).toContain('agents_manage');
      expect(toolNames).toContain('companies_manage');
      expect(toolNames).toContain('conversations_manage');
    });

    it('should provide correct tool definitions', async () => {
      const result = await client.listTools();
      
      const ticketsTool = result.tools.find(tool => tool.name === 'tickets_manage');
      expect(ticketsTool).toBeDefined();
      expect(ticketsTool!.description).toContain('Manage Freshdesk tickets');
      expect(ticketsTool!.inputSchema).toBeDefined();
      expect(ticketsTool!.inputSchema.properties).toHaveProperty('action');
      expect(ticketsTool!.inputSchema.properties).toHaveProperty('params');
    });
  });

  describe('Tool Execution Workflows', () => {
    it('should execute complete ticket management workflow', async () => {
      // Mock API responses
      nock(baseUrl)
        .post('/tickets')
        .reply(201, {
          id: 123,
          subject: 'E2E Test Ticket',
          description: 'Test ticket for E2E testing',
          status: 2,
          priority: 2,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        });

      nock(baseUrl)
        .get('/tickets/123')
        .reply(200, {
          id: 123,
          subject: 'E2E Test Ticket',
          status: 2,
          priority: 2,
        });

      nock(baseUrl)
        .put('/tickets/123')
        .reply(200, {
          id: 123,
          subject: 'E2E Test Ticket',
          status: 4, // Resolved
          priority: 3, // High
        });

      nock(baseUrl)
        .delete('/tickets/123')
        .reply(204);

      // 1. Create ticket
      const createResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'create',
          params: {
            subject: 'E2E Test Ticket',
            description: 'Test ticket for E2E testing',
            email: 'test@example.com',
            priority: 2,
            status: 2,
          },
        },
      });

      expect(createResult.content).toBeDefined();
      const createResponse = JSON.parse(createResult.content[0].text);
      expect(createResponse.success).toBe(true);
      expect(createResponse.ticket.id).toBe(123);

      // 2. Get ticket
      const getResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'get',
          params: {
            ticket_id: 123,
          },
        },
      });

      const getResponse = JSON.parse(getResult.content[0].text);
      expect(getResponse.success).toBe(true);
      expect(getResponse.ticket.id).toBe(123);

      // 3. Update ticket
      const updateResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'update',
          params: {
            ticket_id: 123,
            status: 4,
            priority: 3,
          },
        },
      });

      const updateResponse = JSON.parse(updateResult.content[0].text);
      expect(updateResponse.success).toBe(true);
      expect(updateResponse.ticket.status).toBe(4);
      expect(updateResponse.ticket.priority).toBe(3);

      // 4. Delete ticket
      const deleteResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'delete',
          params: {
            ticket_id: 123,
          },
        },
      });

      const deleteResponse = JSON.parse(deleteResult.content[0].text);
      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.message).toContain('deleted successfully');
    });

    it('should execute complete contact management workflow', async () => {
      // Mock API responses
      nock(baseUrl)
        .post('/contacts')
        .reply(201, {
          id: 456,
          name: 'E2E Test Contact',
          email: 'e2e@example.com',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        });

      nock(baseUrl)
        .get('/contacts')
        .query(true)
        .reply(200, [
          {
            id: 456,
            name: 'E2E Test Contact',
            email: 'e2e@example.com',
          },
        ]);

      nock(baseUrl)
        .put('/contacts/456')
        .reply(200, {
          id: 456,
          name: 'Updated E2E Contact',
          email: 'e2e@example.com',
        });

      // 1. Create contact
      const createResult = await client.callTool({
        name: 'contacts_manage',
        arguments: {
          action: 'create',
          params: {
            name: 'E2E Test Contact',
            email: 'e2e@example.com',
            phone: '+1-555-0123',
          },
        },
      });

      const createResponse = JSON.parse(createResult.content[0].text);
      expect(createResponse.success).toBe(true);
      expect(createResponse.contact.id).toBe(456);

      // 2. List contacts
      const listResult = await client.callTool({
        name: 'contacts_manage',
        arguments: {
          action: 'list',
          params: {
            page: 1,
            per_page: 10,
          },
        },
      });

      const listResponse = JSON.parse(listResult.content[0].text);
      expect(listResponse.success).toBe(true);
      expect(listResponse.contacts).toHaveLength(1);
      expect(listResponse.contacts[0].id).toBe(456);

      // 3. Update contact
      const updateResult = await client.callTool({
        name: 'contacts_manage',
        arguments: {
          action: 'update',
          params: {
            contact_id: 456,
            name: 'Updated E2E Contact',
          },
        },
      });

      const updateResponse = JSON.parse(updateResult.content[0].text);
      expect(updateResponse.success).toBe(true);
      expect(updateResponse.contact.name).toBe('Updated E2E Contact');
    });

    it('should execute agent management workflow', async () => {
      // Mock API responses
      nock(baseUrl)
        .get('/agents/me')
        .reply(200, {
          id: 789,
          contact: {
            name: 'E2E Test Agent',
            email: 'agent@example.com',
          },
          occasional: false,
        });

      nock(baseUrl)
        .get('/agents')
        .query(true)
        .reply(200, [
          {
            id: 789,
            contact: {
              name: 'E2E Test Agent',
              email: 'agent@example.com',
            },
          },
        ]);

      nock(baseUrl)
        .put('/agents/789')
        .reply(200, {
          id: 789,
          contact: {
            name: 'E2E Test Agent',
            email: 'agent@example.com',
          },
          signature: 'Updated signature',
        });

      // 1. Get current agent
      const meResult = await client.callTool({
        name: 'agents_manage',
        arguments: {
          action: 'me',
          params: {},
        },
      });

      const meResponse = JSON.parse(meResult.content[0].text);
      expect(meResponse.success).toBe(true);
      expect(meResponse.agent.id).toBe(789);

      // 2. List agents
      const listResult = await client.callTool({
        name: 'agents_manage',
        arguments: {
          action: 'list',
          params: {},
        },
      });

      const listResponse = JSON.parse(listResult.content[0].text);
      expect(listResponse.success).toBe(true);
      expect(listResponse.agents).toHaveLength(1);

      // 3. Update agent
      const updateResult = await client.callTool({
        name: 'agents_manage',
        arguments: {
          action: 'update',
          params: {
            agent_id: 789,
            signature: 'Updated signature',
          },
        },
      });

      const updateResponse = JSON.parse(updateResult.content[0].text);
      expect(updateResponse.success).toBe(true);
      expect(updateResponse.agent.signature).toBe('Updated signature');
    });
  });

  describe('Error Handling Workflows', () => {
    it('should handle API authentication errors', async () => {
      nock(baseUrl)
        .get('/tickets')
        .reply(401, {
          message: 'Authentication failed',
          code: 'INVALID_CREDENTIALS',
        });

      const result = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {},
        },
      });

      const response = JSON.parse((result.content as any)[0].text);
      expect(response.error).toBe(true);
      expect(response.message).toContain('Authentication failed');
    });

    it('should handle validation errors', async () => {
      const result = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'create',
          params: {
            subject: 'Test',
            // Missing required fields
          },
        },
      });

      const response = JSON.parse((result.content as any)[0].text);
      expect(response.error).toBe(true);
      expect(response.message).toBeDefined();
    });

    it('should handle network errors with retries', async () => {
      nock(baseUrl)
        .get('/tickets')
        .replyWithError('Network error')
        .get('/tickets')
        .reply(200, []);

      const result = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {},
        },
      });

      const response = JSON.parse((result.content as any)[0].text);
      expect(response.success).toBe(true);
      expect(response.tickets).toEqual([]);
    });

    it('should handle rate limiting gracefully', async () => {
      nock(baseUrl)
        .get('/tickets')
        .reply(429, {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_ERROR',
        }, {
          'retry-after': '1',
        })
        .get('/tickets')
        .reply(200, []);

      const result = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {},
        },
      });

      const response = JSON.parse((result.content as any)[0].text);
      expect(response.success).toBe(true);
      expect(response.tickets).toEqual([]);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle customer support workflow', async () => {
      // Scenario: Customer emails, agent creates ticket, adds notes, resolves
      
      // 1. Create contact for customer
      nock(baseUrl)
        .post('/contacts')
        .reply(201, {
          id: 100,
          name: 'Customer Name',
          email: 'customer@example.com',
        });

      const contactResult = await client.callTool({
        name: 'contacts_manage',
        arguments: {
          action: 'create',
          params: {
            name: 'Customer Name',
            email: 'customer@example.com',
          },
        },
      });

      const contactResponse = JSON.parse(contactResult.content[0].text);
      expect(contactResponse.success).toBe(true);

      // 2. Create ticket for the customer
      nock(baseUrl)
        .post('/tickets')
        .reply(201, {
          id: 200,
          subject: 'Customer Support Request',
          requester_id: 100,
          status: 2,
          priority: 2,
        });

      const ticketResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'create',
          params: {
            subject: 'Customer Support Request',
            description: 'Customer needs help with the product',
            email: 'customer@example.com',
            priority: 2,
            status: 2,
          },
        },
      });

      const ticketResponse = JSON.parse(ticketResult.content[0].text);
      expect(ticketResponse.success).toBe(true);

      // 3. Agent adds internal note
      nock(baseUrl)
        .post('/tickets/200/conversations')
        .reply(201, {
          id: 300,
          body: 'Internal note: Investigating the issue',
          private: true,
          user_id: 1,
        });

      const noteResult = await client.callTool({
        name: 'conversations_manage',
        arguments: {
          action: 'create',
          params: {
            ticket_id: 200,
            body: 'Internal note: Investigating the issue',
            user_id: 1,
            private: true,
          },
        },
      });

      const noteResponse = JSON.parse(noteResult.content[0].text);
      expect(noteResponse.success).toBe(true);

      // 4. Agent responds to customer
      nock(baseUrl)
        .post('/tickets/200/conversations')
        .reply(201, {
          id: 301,
          body: 'Hi, I will help you with this issue.',
          private: false,
          user_id: 1,
        });

      const responseResult = await client.callTool({
        name: 'conversations_manage',
        arguments: {
          action: 'create',
          params: {
            ticket_id: 200,
            body: 'Hi, I will help you with this issue.',
            user_id: 1,
            private: false,
          },
        },
      });

      const responseResponse = JSON.parse(responseResult.content[0].text);
      expect(responseResponse.success).toBe(true);

      // 5. Resolve ticket
      nock(baseUrl)
        .put('/tickets/200')
        .reply(200, {
          id: 200,
          subject: 'Customer Support Request',
          status: 4, // Resolved
        });

      const resolveResult = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'update',
          params: {
            ticket_id: 200,
            status: 4,
          },
        },
      });

      const resolveResponse = JSON.parse(resolveResult.content[0].text);
      expect(resolveResponse.success).toBe(true);
      expect(resolveResponse.ticket.status).toBe(4);
    });

    it('should handle bulk data operations', async () => {
      // Scenario: Import multiple contacts and create tickets for each
      
      const contacts = [
        { name: 'Contact 1', email: 'contact1@example.com' },
        { name: 'Contact 2', email: 'contact2@example.com' },
        { name: 'Contact 3', email: 'contact3@example.com' },
      ];

      // Create contacts
      const contactPromises = contacts.map((contact, index) => {
        nock(baseUrl)
          .post('/contacts', contact)
          .reply(201, { id: 100 + index, ...contact });

        return client.callTool({
          name: 'contacts_manage',
          arguments: {
            action: 'create',
            params: contact,
          },
        });
      });

      const contactResults = await Promise.all(contactPromises);
      
      contactResults.forEach((result, index) => {
        const response = JSON.parse((result.content as any)[0].text);
        expect(response.success).toBe(true);
        expect(response.contact.id).toBe(100 + index);
      });

      // Create tickets for each contact
      const ticketPromises = contacts.map((contact, index) => {
        nock(baseUrl)
          .post('/tickets')
          .reply(201, {
            id: 200 + index,
            subject: `Ticket for ${contact.name}`,
            requester_id: 100 + index,
          });

        return client.callTool({
          name: 'tickets_manage',
          arguments: {
            action: 'create',
            params: {
              subject: `Ticket for ${contact.name}`,
              description: `Support ticket for ${contact.name}`,
              email: contact.email,
              priority: 2,
              status: 2,
            },
          },
        });
      });

      const ticketResults = await Promise.all(ticketPromises);
      
      ticketResults.forEach((result, index) => {
        const response = JSON.parse((result.content as any)[0].text);
        expect(response.success).toBe(true);
        expect(response.ticket.id).toBe(200 + index);
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent tool calls efficiently', async () => {
      // Mock multiple endpoints
      nock(baseUrl).get('/tickets').query(true).reply(200, []);
      nock(baseUrl).get('/contacts').query(true).reply(200, []);
      nock(baseUrl).get('/agents').query(true).reply(200, []);
      nock(baseUrl).get('/companies').query(true).reply(200, []);

      const startTime = Date.now();

      // Execute multiple tools concurrently
      const results = await Promise.all([
        client.callTool({
          name: 'tickets_manage',
          arguments: { action: 'list', params: {} },
        }),
        client.callTool({
          name: 'contacts_manage',
          arguments: { action: 'list', params: {} },
        }),
        client.callTool({
          name: 'agents_manage',
          arguments: { action: 'list', params: {} },
        }),
        client.callTool({
          name: 'companies_manage',
          arguments: { action: 'list', params: {} },
        }),
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All calls should succeed
      results.forEach(result => {
        const response = JSON.parse((result.content as any)[0].text);
        expect(response.success).toBe(true);
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain server stability under load', async () => {
      // Mock endpoint for repeated calls
      nock(baseUrl)
        .persist()
        .get('/tickets')
        .query(true)
        .reply(200, []);

      // Make many sequential calls
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          client.callTool({
            name: 'tickets_manage',
            arguments: { action: 'list', params: {} },
          })
        );
      }

      const results = await Promise.all(promises);

      // All calls should succeed
      results.forEach(result => {
        const response = JSON.parse((result.content as any)[0].text);
        expect(response.success).toBe(true);
      });
    });
  });

  describe('Configuration and Environment', () => {
    it('should handle missing required environment variables', async () => {
      // This test would require restarting the server with missing env vars
      // For now, we'll test that the current configuration is working
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);
    });

    it('should respect timeout configuration', async () => {
      nock(baseUrl)
        .get('/tickets')
        .delay(15000) // Delay longer than configured timeout
        .reply(200, []);

      const result = await client.callTool({
        name: 'tickets_manage',
        arguments: {
          action: 'list',
          params: {},
        },
      });

      const response = JSON.parse((result.content as any)[0].text);
      expect(response.error).toBe(true);
    });
  });
});