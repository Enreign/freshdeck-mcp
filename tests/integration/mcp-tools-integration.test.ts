import nock from 'nock';
import { FreshdeskClient } from '../../src/api/client.js';
import { TicketsTool } from '../../src/tools/tickets.js';
import { ContactsTool } from '../../src/tools/contacts.js';
import { AgentsTool } from '../../src/tools/agents.js';
import { CompaniesTool } from '../../src/tools/companies.js';
import { ConversationsTool } from '../../src/tools/conversations.js';
import { FreshdeskConfig } from '../../src/core/types.js';

describe('MCP Tools Integration Tests', () => {
  let client: FreshdeskClient;
  let ticketsTool: TicketsTool;
  let contactsTool: ContactsTool;
  let agentsTool: AgentsTool;
  let companiesTool: CompaniesTool;
  let conversationsTool: ConversationsTool;

  const baseUrl = 'https://test-domain.freshdesk.com/api/v2';
  const config: FreshdeskConfig = {
    domain: 'test-domain',
    apiKey: 'test-api-key',
    timeout: 30000,
    maxRetries: 3,
    rateLimitPerMinute: 50,
  };

  beforeEach(() => {
    client = new FreshdeskClient(config);
    ticketsTool = new TicketsTool(client);
    contactsTool = new ContactsTool(client);
    agentsTool = new AgentsTool(client);
    companiesTool = new CompaniesTool(client);
    conversationsTool = new ConversationsTool(client);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Cross-Tool Workflow Integration', () => {
    it('should handle complete ticket lifecycle with related entities', async () => {
      // 1. Create a company
      nock(baseUrl)
        .post('/companies', {
          name: 'Test Company',
          domains: ['testcompany.com'],
        })
        .reply(201, {
          id: 100,
          name: 'Test Company',
          domains: ['testcompany.com'],
        });

      const companyResult = await companiesTool.execute({
        action: 'create',
        params: {
          name: 'Test Company',
          domains: ['testcompany.com'],
        },
      });

      const company = JSON.parse(companyResult);
      expect(company.success).toBe(true);
      expect(company.company.id).toBe(100);

      // 2. Create a contact associated with the company
      nock(baseUrl)
        .post('/contacts', {
          name: 'John Doe',
          email: 'john@testcompany.com',
          company_id: 100,
        })
        .reply(201, {
          id: 200,
          name: 'John Doe',
          email: 'john@testcompany.com',
          company_id: 100,
        });

      const contactResult = await contactsTool.execute({
        action: 'create',
        params: {
          name: 'John Doe',
          email: 'john@testcompany.com',
          company_id: 100,
        },
      });

      const contact = JSON.parse(contactResult);
      expect(contact.success).toBe(true);
      expect(contact.contact.id).toBe(200);

      // 3. Create a ticket for the contact
      nock(baseUrl)
        .post('/tickets', {
          subject: 'Integration Test Ticket',
          description: 'Test ticket for integration testing',
          email: 'john@testcompany.com',
          priority: 2,
          status: 2,
        })
        .reply(201, {
          id: 300,
          subject: 'Integration Test Ticket',
          requester_id: 200,
          company_id: 100,
          priority: 2,
          status: 2,
        });

      const ticketResult = await ticketsTool.execute({
        action: 'create',
        params: {
          subject: 'Integration Test Ticket',
          description: 'Test ticket for integration testing',
          email: 'john@testcompany.com',
          priority: 2,
          status: 2,
        },
      });

      const ticket = JSON.parse(ticketResult);
      expect(ticket.success).toBe(true);
      expect(ticket.ticket.id).toBe(300);

      // 4. Add a conversation to the ticket
      nock(baseUrl)
        .post('/tickets/300/conversations', {
          body: 'This is a follow-up message',
          user_id: 200,
          private: false,
        })
        .reply(201, {
          id: 400,
          body: 'This is a follow-up message',
          user_id: 200,
          ticket_id: 300,
        });

      const conversationResult = await conversationsTool.execute({
        action: 'create',
        params: {
          ticket_id: 300,
          body: 'This is a follow-up message',
          user_id: 200,
          private: false,
        },
      });

      const conversation = JSON.parse(conversationResult);
      expect(conversation.success).toBe(true);
      expect(conversation.conversation.id).toBe(400);

      // 5. Update ticket status to resolved
      nock(baseUrl)
        .put('/tickets/300', { status: 4 })
        .reply(200, {
          id: 300,
          subject: 'Integration Test Ticket',
          status: 4,
        });

      const updateResult = await ticketsTool.execute({
        action: 'update',
        params: {
          ticket_id: 300,
          status: 4,
        },
      });

      const updatedTicket = JSON.parse(updateResult);
      expect(updatedTicket.success).toBe(true);
      expect(updatedTicket.ticket.status).toBe(4);
    });

    it('should handle agent assignment workflow', async () => {
      // 1. Get current agent
      nock(baseUrl)
        .get('/agents/me')
        .reply(200, {
          id: 500,
          contact: {
            name: 'Agent Smith',
            email: 'agent@company.com',
          },
        });

      const agentResult = await agentsTool.execute({
        action: 'me',
        params: {},
      });

      const agent = JSON.parse(agentResult);
      expect(agent.success).toBe(true);
      expect(agent.agent.id).toBe(500);

      // 2. Create ticket and assign to agent
      nock(baseUrl)
        .post('/tickets', {
          subject: 'Agent Assignment Test',
          description: 'Test ticket for agent assignment',
          email: 'customer@example.com',
          priority: 3,
          status: 2,
          responder_id: 500,
        })
        .reply(201, {
          id: 600,
          subject: 'Agent Assignment Test',
          responder_id: 500,
          priority: 3,
          status: 2,
        });

      const ticketResult = await ticketsTool.execute({
        action: 'create',
        params: {
          subject: 'Agent Assignment Test',
          description: 'Test ticket for agent assignment',
          email: 'customer@example.com',
          priority: 3,
          status: 2,
          responder_id: 500,
        },
      });

      const ticket = JSON.parse(ticketResult);
      expect(ticket.success).toBe(true);
      expect(ticket.ticket.responder_id).toBe(500);

      // 3. Agent adds internal note
      nock(baseUrl)
        .post('/tickets/600/conversations', {
          body: 'Internal note: Working on this ticket',
          user_id: 500,
          private: true,
        })
        .reply(201, {
          id: 700,
          body: 'Internal note: Working on this ticket',
          user_id: 500,
          private: true,
        });

      const noteResult = await conversationsTool.execute({
        action: 'create',
        params: {
          ticket_id: 600,
          body: 'Internal note: Working on this ticket',
          user_id: 500,
          private: true,
        },
      });

      const note = JSON.parse(noteResult);
      expect(note.success).toBe(true);
      expect(note.conversation.private).toBe(true);
    });
  });

  describe('Tool Error Handling Integration', () => {
    it('should handle cascading errors gracefully', async () => {
      // 1. Try to create ticket with invalid email (should fail)
      const invalidTicketResult = await ticketsTool.execute({
        action: 'create',
        params: {
          subject: 'Test Ticket',
          description: 'Test description',
          email: 'invalid-email',
          priority: 2,
          status: 2,
        },
      });

      const invalidTicket = JSON.parse(invalidTicketResult);
      expect(invalidTicket.error).toBe(true);

      // 2. Try to create conversation for non-existent ticket
      nock(baseUrl)
        .post('/tickets/999/conversations')
        .reply(404, {
          message: 'Ticket not found',
          code: 'NOT_FOUND',
        });

      const invalidConversationResult = await conversationsTool.execute({
        action: 'create',
        params: {
          ticket_id: 999,
          body: 'Test conversation',
          user_id: 123,
        },
      });

      const invalidConversation = JSON.parse(invalidConversationResult);
      expect(invalidConversation.error).toBe(true);
      expect(invalidConversation.message).toContain('Ticket not found');
    });

    it('should handle rate limiting across tools', async () => {
      // Create client with very low rate limit
      const rateLimitedConfig = { ...config, rateLimitPerMinute: 2 };
      const rateLimitedClient = new FreshdeskClient(rateLimitedConfig);
      const rateLimitedTickets = new TicketsTool(rateLimitedClient);
      const rateLimitedContacts = new ContactsTool(rateLimitedClient);

      // First request should succeed
      nock(baseUrl)
        .get('/tickets?page=1&per_page=30')
        .reply(200, []);

      const firstResult = await rateLimitedTickets.execute({
        action: 'list',
        params: {},
      });

      const first = JSON.parse(firstResult);
      expect(first.success).toBe(true);

      // Second request should succeed
      nock(baseUrl)
        .get('/contacts?page=1&per_page=30')
        .reply(200, []);

      const secondResult = await rateLimitedContacts.execute({
        action: 'list',
        params: {},
      });

      const second = JSON.parse(secondResult);
      expect(second.success).toBe(true);

      // Third request should fail due to rate limit
      const thirdResult = await rateLimitedTickets.execute({
        action: 'list',
        params: {},
      });

      const third = JSON.parse(thirdResult);
      expect(third.error).toBe(true);
      expect(third.message).toContain('Rate limit exceeded');
    });
  });

  describe('Search and Query Integration', () => {
    it('should handle complex search workflows across entities', async () => {
      // 1. Search for tickets
      nock(baseUrl)
        .get('/search/tickets')
        .query({
          query: 'priority:3 status:2',
          page: 1,
          per_page: 30,
        })
        .reply(200, {
          results: [
            { id: 1, subject: 'High Priority Ticket', priority: 3, status: 2 },
            { id: 2, subject: 'Another High Priority', priority: 3, status: 2 },
          ],
          total: 2,
        });

      const ticketSearchResult = await ticketsTool.execute({
        action: 'search',
        params: {
          query: 'priority:3 status:2',
        },
      });

      const ticketSearch = JSON.parse(ticketSearchResult);
      expect(ticketSearch.success).toBe(true);
      expect(ticketSearch.tickets).toHaveLength(2);

      // 2. Search for contacts
      nock(baseUrl)
        .get('/search/contacts')
        .query({
          query: 'john@example.com',
          page: 1,
          per_page: 30,
        })
        .reply(200, {
          results: [
            { id: 100, name: 'John Doe', email: 'john@example.com' },
          ],
          total: 1,
        });

      const contactSearchResult = await contactsTool.execute({
        action: 'search',
        params: {
          query: 'john@example.com',
        },
      });

      const contactSearch = JSON.parse(contactSearchResult);
      expect(contactSearch.success).toBe(true);
      expect(contactSearch.contacts).toHaveLength(1);

      // 3. Search for companies
      nock(baseUrl)
        .get('/search/companies')
        .query({
          query: 'tech company',
          page: 1,
          per_page: 30,
        })
        .reply(200, {
          results: [
            { id: 200, name: 'Tech Corp' },
            { id: 201, name: 'Another Tech Co' },
          ],
          total: 2,
        });

      const companySearchResult = await companiesTool.execute({
        action: 'search',
        params: {
          query: 'tech company',
        },
      });

      const companySearch = JSON.parse(companySearchResult);
      expect(companySearch.success).toBe(true);
      expect(companySearch.companies).toHaveLength(2);
    });
  });

  describe('Bulk Operations Integration', () => {
    it('should handle multiple related operations efficiently', async () => {
      // Create multiple contacts for the same company
      const contacts = [
        { name: 'John Doe', email: 'john@company.com' },
        { name: 'Jane Smith', email: 'jane@company.com' },
        { name: 'Bob Johnson', email: 'bob@company.com' },
      ];

      const contactPromises = contacts.map((contact, index) => {
        nock(baseUrl)
          .post('/contacts', contact)
          .reply(201, { id: 100 + index, ...contact });

        return contactsTool.execute({
          action: 'create',
          params: contact,
        });
      });

      const contactResults = await Promise.all(contactPromises);

      contactResults.forEach((result, index) => {
        const contact = JSON.parse(result);
        expect(contact.success).toBe(true);
        expect(contact.contact.id).toBe(100 + index);
      });

      // Create tickets for each contact
      const ticketPromises = contacts.map((contact, index) => {
        nock(baseUrl)
          .post('/tickets', {
            subject: `Ticket for ${contact.name}`,
            description: `Test ticket for ${contact.name}`,
            email: contact.email,
            priority: 2,
            status: 2,
          })
          .reply(201, {
            id: 200 + index,
            subject: `Ticket for ${contact.name}`,
            requester_id: 100 + index,
          });

        return ticketsTool.execute({
          action: 'create',
          params: {
            subject: `Ticket for ${contact.name}`,
            description: `Test ticket for ${contact.name}`,
            email: contact.email,
            priority: 2,
            status: 2,
          },
        });
      });

      const ticketResults = await Promise.all(ticketPromises);

      ticketResults.forEach((result, index) => {
        const ticket = JSON.parse(result);
        expect(ticket.success).toBe(true);
        expect(ticket.ticket.id).toBe(200 + index);
      });
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across related operations', async () => {
      // 1. Create a contact
      nock(baseUrl)
        .post('/contacts', {
          name: 'Consistency Test User',
          email: 'consistency@test.com',
        })
        .reply(201, {
          id: 999,
          name: 'Consistency Test User',
          email: 'consistency@test.com',
        });

      const contactResult = await contactsTool.execute({
        action: 'create',
        params: {
          name: 'Consistency Test User',
          email: 'consistency@test.com',
        },
      });

      const contact = JSON.parse(contactResult);
      expect(contact.success).toBe(true);

      // 2. Create ticket with same email (should link to contact)
      nock(baseUrl)
        .post('/tickets', {
          subject: 'Consistency Test Ticket',
          description: 'Test description',
          email: 'consistency@test.com',
          priority: 2,
          status: 2,
        })
        .reply(201, {
          id: 888,
          subject: 'Consistency Test Ticket',
          requester_id: 999, // Should link to the contact
          priority: 2,
          status: 2,
        });

      const ticketResult = await ticketsTool.execute({
        action: 'create',
        params: {
          subject: 'Consistency Test Ticket',
          description: 'Test description',
          email: 'consistency@test.com',
          priority: 2,
          status: 2,
        },
      });

      const ticket = JSON.parse(ticketResult);
      expect(ticket.success).toBe(true);
      expect(ticket.ticket.requester_id).toBe(999);

      // 3. Update contact and verify ticket relationship remains
      nock(baseUrl)
        .put('/contacts/999', {
          name: 'Updated Consistency User',
        })
        .reply(200, {
          id: 999,
          name: 'Updated Consistency User',
          email: 'consistency@test.com',
        });

      const updateResult = await contactsTool.execute({
        action: 'update',
        params: {
          contact_id: 999,
          name: 'Updated Consistency User',
        },
      });

      const updatedContact = JSON.parse(updateResult);
      expect(updatedContact.success).toBe(true);
      expect(updatedContact.contact.name).toBe('Updated Consistency User');

      // 4. Verify ticket still references correct contact
      nock(baseUrl)
        .get('/tickets/888')
        .reply(200, {
          id: 888,
          subject: 'Consistency Test Ticket',
          requester_id: 999,
          priority: 2,
          status: 2,
        });

      const getTicketResult = await ticketsTool.execute({
        action: 'get',
        params: {
          ticket_id: 888,
        },
      });

      const retrievedTicket = JSON.parse(getTicketResult);
      expect(retrievedTicket.success).toBe(true);
      expect(retrievedTicket.ticket.requester_id).toBe(999);
    });
  });

  describe('Performance Integration', () => {
    it('should handle high-volume operations efficiently', async () => {
      const startTime = Date.now();

      // Simulate multiple concurrent list operations
      const operations = [
        ticketsTool.execute({ action: 'list', params: { per_page: 10 } }),
        contactsTool.execute({ action: 'list', params: { per_page: 10 } }),
        agentsTool.execute({ action: 'list', params: { per_page: 10 } }),
        companiesTool.execute({ action: 'list', params: { per_page: 10 } }),
      ];

      // Mock all the endpoints
      nock(baseUrl).get('/tickets').query(true).reply(200, []);
      nock(baseUrl).get('/contacts').query(true).reply(200, []);
      nock(baseUrl).get('/agents').query(true).reply(200, []);
      nock(baseUrl).get('/companies').query(true).reply(200, []);

      const results = await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All operations should succeed
      results.forEach(result => {
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
      });

      // Should complete in reasonable time (less than 5 seconds for mocked operations)
      expect(duration).toBeLessThan(5000);
    });
  });
});