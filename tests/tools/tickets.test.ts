import { TicketsTool } from '../../src/tools/tickets.js';
import { FreshdeskClient } from '../../src/api/client.js';
import { Ticket } from '../../src/core/types.js';

// Mock the client
jest.mock('../../src/api/client.js');

describe('TicketsTool', () => {
  let mockClient: jest.Mocked<FreshdeskClient>;
  let ticketsTool: TicketsTool;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      getRateLimitInfo: jest.fn(),
      testConnection: jest.fn(),
    } as any;

    ticketsTool = new TicketsTool(mockClient);
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const definition = ticketsTool.definition;

      expect(definition.name).toBe('tickets_manage');
      expect(definition.description).toContain('Manage Freshdesk tickets');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('action');
      expect(definition.inputSchema.properties).toHaveProperty('params');
      expect((definition.inputSchema as any).required).toEqual(['action', 'params']);
    });

    it('should have correct action enum values', () => {
      const definition = ticketsTool.definition;
      const actionProperty = definition.inputSchema.properties?.['action'];

      expect((actionProperty as any).enum).toEqual([
        'create', 'update', 'list', 'get', 'delete', 'search'
      ]);
    });
  });

  describe('execute', () => {
    it('should route to correct method based on action', async () => {
      const createSpy = jest.spyOn(ticketsTool as any, 'createTicket').mockResolvedValue('create result');
      const updateSpy = jest.spyOn(ticketsTool as any, 'updateTicket').mockResolvedValue('update result');
      const listSpy = jest.spyOn(ticketsTool as any, 'listTickets').mockResolvedValue('list result');
      const getSpy = jest.spyOn(ticketsTool as any, 'getTicket').mockResolvedValue('get result');
      const deleteSpy = jest.spyOn(ticketsTool as any, 'deleteTicket').mockResolvedValue('delete result');
      const searchSpy = jest.spyOn(ticketsTool as any, 'searchTickets').mockResolvedValue('search result');

      await expect(ticketsTool.execute({ action: 'create', params: {} })).resolves.toBe('create result');
      await expect(ticketsTool.execute({ action: 'update', params: {} })).resolves.toBe('update result');
      await expect(ticketsTool.execute({ action: 'list', params: {} })).resolves.toBe('list result');
      await expect(ticketsTool.execute({ action: 'get', params: {} })).resolves.toBe('get result');
      await expect(ticketsTool.execute({ action: 'delete', params: {} })).resolves.toBe('delete result');
      await expect(ticketsTool.execute({ action: 'search', params: {} })).resolves.toBe('search result');

      expect(createSpy).toHaveBeenCalledWith({});
      expect(updateSpy).toHaveBeenCalledWith({});
      expect(listSpy).toHaveBeenCalledWith({});
      expect(getSpy).toHaveBeenCalledWith({});
      expect(deleteSpy).toHaveBeenCalledWith({});
      expect(searchSpy).toHaveBeenCalledWith({});
    });

    it('should handle unknown action', async () => {
      const result = await ticketsTool.execute({ action: 'unknown', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain('Unknown action: unknown');
    });

    it('should handle errors in action methods', async () => {
      jest.spyOn(ticketsTool as any, 'createTicket').mockRejectedValue(new Error('Create failed'));

      const result = await ticketsTool.execute({ action: 'create', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Create failed');
    });
  });

  describe('createTicket', () => {
    const mockTicket: Ticket = {
      id: 123,
      subject: 'Test Ticket',
      description: 'Test description',
      status: 2, // Open
      priority: 2, // Medium
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    } as Ticket;

    it('should create ticket with valid data', async () => {
      mockClient.post.mockResolvedValue(mockTicket);

      const params = {
        subject: 'Test Ticket',
        description: 'Test description',
        email: 'test@example.com',
        priority: 2,
        status: 2,
      };

      const result = await ticketsTool['createTicket'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.post).toHaveBeenCalledWith('/tickets', {
        subject: 'Test Ticket',
        description: 'Test description',
        email: 'test@example.com',
        priority: 2,
        status: 2,
        source: 2, // Default to Portal
        tags: undefined,
        cc_emails: undefined,
        custom_fields: undefined,
        group_id: undefined,
        responder_id: undefined,
        type: undefined,
        product_id: undefined,
      });

      expect(parsed.success).toBe(true);
      expect(parsed.ticket).toEqual(mockTicket);
      expect(parsed.message).toBe('Ticket #123 created successfully');
    });

    it('should create ticket with all optional fields', async () => {
      mockClient.post.mockResolvedValue(mockTicket);

      const params = {
        subject: 'Complete Ticket',
        description: 'Complete description',
        email: 'test@example.com',
        priority: 3,
        status: 2,
        source: 1,
        tags: ['tag1', 'tag2'],
        cc_emails: ['cc1@example.com', 'cc2@example.com'],
        custom_fields: { field1: 'value1' },
        group_id: 10,
        responder_id: 20,
        type: 'Question',
        product_id: 5,
      };

      await ticketsTool['createTicket'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/tickets', {
        subject: 'Complete Ticket',
        description: 'Complete description',
        email: 'test@example.com',
        priority: 3,
        status: 2,
        source: 1,
        tags: ['tag1', 'tag2'],
        cc_emails: ['cc1@example.com', 'cc2@example.com'],
        custom_fields: { field1: 'value1' },
        group_id: 10,
        responder_id: 20,
        type: 'Question',
        product_id: 5,
      });
    });

    it('should validate required fields', async () => {
      const invalidParams = {
        subject: 'Test',
        // Missing description, email, priority, status
      };

      await expect(ticketsTool['createTicket'](invalidParams)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const invalidParams = {
        subject: 'Test',
        description: 'Test',
        email: 'invalid-email',
        priority: 2,
        status: 2,
      };

      await expect(ticketsTool['createTicket'](invalidParams)).rejects.toThrow();
    });

    it('should validate priority range', async () => {
      const invalidParams = {
        subject: 'Test',
        description: 'Test',
        email: 'test@example.com',
        priority: 5, // Out of range (1-4)
        status: 2,
      };

      await expect(ticketsTool['createTicket'](invalidParams)).rejects.toThrow();
    });

    it('should validate status range', async () => {
      const invalidParams = {
        subject: 'Test',
        description: 'Test',
        email: 'test@example.com',
        priority: 2,
        status: 1, // Out of range (2-7)
      };

      await expect(ticketsTool['createTicket'](invalidParams)).rejects.toThrow();
    });

    it('should validate cc_emails format', async () => {
      const invalidParams = {
        subject: 'Test',
        description: 'Test',
        email: 'test@example.com',
        priority: 2,
        status: 2,
        cc_emails: ['valid@example.com', 'invalid-email'],
      };

      await expect(ticketsTool['createTicket'](invalidParams)).rejects.toThrow();
    });
  });

  describe('updateTicket', () => {
    const mockTicket: Ticket = {
      id: 123,
      subject: 'Updated Ticket',
      description: 'Updated description',
      status: 2, // Open
      priority: 1, // High
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T12:00:00Z',
    } as Ticket;

    it('should update ticket with valid data', async () => {
      mockClient.put.mockResolvedValue(mockTicket);

      const params = {
        ticket_id: 123,
        subject: 'Updated Ticket',
        priority: 3,
      };

      const result = await ticketsTool['updateTicket'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.put).toHaveBeenCalledWith('/tickets/123', {
        subject: 'Updated Ticket',
        priority: 3,
      });

      expect(parsed.success).toBe(true);
      expect(parsed.ticket).toEqual(mockTicket);
      expect(parsed.message).toBe('Ticket #123 updated successfully');
    });

    it('should update ticket with all optional fields', async () => {
      mockClient.put.mockResolvedValue(mockTicket);

      const params = {
        ticket_id: 456,
        subject: 'Complete Update',
        description: 'Complete description update',
        priority: 4,
        status: 3,
        tags: ['updated-tag'],
        custom_fields: { updated_field: 'updated_value' },
        group_id: 15,
        responder_id: 25,
        type: 'Incident',
        product_id: 8,
      };

      await ticketsTool['updateTicket'](params);

      expect(mockClient.put).toHaveBeenCalledWith('/tickets/456', {
        subject: 'Complete Update',
        description: 'Complete description update',
        priority: 4,
        status: 3,
        tags: ['updated-tag'],
        custom_fields: { updated_field: 'updated_value' },
        group_id: 15,
        responder_id: 25,
        type: 'Incident',
        product_id: 8,
      });
    });

    it('should validate required ticket_id', async () => {
      const invalidParams = {
        subject: 'Test',
        // Missing ticket_id
      };

      await expect(ticketsTool['updateTicket'](invalidParams)).rejects.toThrow();
    });

    it('should validate optional field ranges', async () => {
      const invalidParams = {
        ticket_id: 123,
        priority: 0, // Out of range
      };

      await expect(ticketsTool['updateTicket'](invalidParams)).rejects.toThrow();
    });
  });

  describe('listTickets', () => {
    const mockTickets: Ticket[] = [
      { id: 1, subject: 'Ticket 1' } as Ticket,
      { id: 2, subject: 'Ticket 2' } as Ticket,
    ];

    it('should list tickets with default parameters', async () => {
      mockClient.get.mockResolvedValue(mockTickets);

      const result = await ticketsTool['listTickets']({});
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/tickets', {
        params: {
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.tickets).toEqual(mockTickets);
      expect(parsed.count).toBe(2);
      expect(parsed.page).toBe(1);
      expect(parsed.per_page).toBe(30);
    });

    it('should list tickets with custom pagination', async () => {
      mockClient.get.mockResolvedValue(mockTickets);

      const params = {
        page: 2,
        per_page: 50,
      };

      await ticketsTool['listTickets'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/tickets', {
        params: {
          page: 2,
          per_page: 50,
        },
      });
    });

    it('should list tickets with filters', async () => {
      mockClient.get.mockResolvedValue(mockTickets);

      const params = {
        filter: 'new_and_my_open',
        requester_id: 100,
        responder_id: 200,
        company_id: 300,
        updated_since: '2023-01-01T00:00:00Z',
        include: ['description', 'requester'],
      };

      await ticketsTool['listTickets'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/tickets', {
        params: {
          page: 1,
          per_page: 30,
          filter: 'new_and_my_open',
          requester_id: 100,
          responder_id: 200,
          company_id: 300,
          updated_since: '2023-01-01T00:00:00Z',
          include: 'description,requester',
        },
      });
    });

    it('should validate pagination limits', async () => {
      const invalidParams = {
        per_page: 150, // Over limit
      };

      await expect(ticketsTool['listTickets'](invalidParams)).rejects.toThrow();
    });

    it('should validate page minimum', async () => {
      const invalidParams = {
        page: 0, // Below minimum
      };

      await expect(ticketsTool['listTickets'](invalidParams)).rejects.toThrow();
    });
  });

  describe('getTicket', () => {
    const mockTicket: Ticket = {
      id: 123,
      subject: 'Single Ticket',
      description: 'Single ticket description',
      status: 2, // Open
      priority: 2, // Medium
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    } as Ticket;

    it('should get ticket by id', async () => {
      mockClient.get.mockResolvedValue(mockTicket);

      const params = {
        ticket_id: 123,
      };

      const result = await ticketsTool['getTicket'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/tickets/123', {
        params: {},
      });

      expect(parsed.success).toBe(true);
      expect(parsed.ticket).toEqual(mockTicket);
    });

    it('should get ticket with includes', async () => {
      mockClient.get.mockResolvedValue(mockTicket);

      const params = {
        ticket_id: 456,
        include: ['conversations', 'requester', 'company'],
      };

      await ticketsTool['getTicket'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/tickets/456', {
        params: {
          include: 'conversations,requester,company',
        },
      });
    });

    it('should validate required ticket_id', async () => {
      const invalidParams = {};

      await expect(ticketsTool['getTicket'](invalidParams)).rejects.toThrow();
    });
  });

  describe('deleteTicket', () => {
    it('should delete ticket by id', async () => {
      mockClient.delete.mockResolvedValue(undefined);

      const params = {
        ticket_id: 123,
      };

      const result = await ticketsTool['deleteTicket'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.delete).toHaveBeenCalledWith('/tickets/123');

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Ticket #123 deleted successfully');
    });

    it('should validate required ticket_id', async () => {
      const invalidParams = {};

      await expect(ticketsTool['deleteTicket'](invalidParams)).rejects.toThrow();
    });

    it('should handle client errors during deletion', async () => {
      mockClient.delete.mockRejectedValue(new Error('Delete failed'));

      const params = {
        ticket_id: 123,
      };

      await expect(ticketsTool['deleteTicket'](params)).rejects.toThrow('Delete failed');
    });
  });

  describe('searchTickets', () => {
    const mockSearchResponse = {
      results: [
        { id: 1, subject: 'Search Result 1' } as Ticket,
        { id: 2, subject: 'Search Result 2' } as Ticket,
      ],
      total: 2,
    };

    it('should search tickets with query', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const params = {
        query: 'status:2 priority:1',
      };

      const result = await ticketsTool['searchTickets'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/search/tickets', {
        params: {
          query: 'status:2 priority:1',
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.tickets).toEqual(mockSearchResponse.results);
      expect(parsed.total).toBe(2);
      expect(parsed.page).toBe(1);
      expect(parsed.per_page).toBe(30);
    });

    it('should search tickets with pagination', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const params = {
        query: 'urgent tickets',
        page: 3,
        per_page: 10,
      };

      await ticketsTool['searchTickets'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/search/tickets', {
        params: {
          query: 'urgent tickets',
          page: 3,
          per_page: 10,
        },
      });
    });

    it('should validate required query', async () => {
      const invalidParams = {
        page: 1,
        // Missing query
      };

      await expect(ticketsTool['searchTickets'](invalidParams)).rejects.toThrow();
    });

    it('should validate pagination constraints', async () => {
      const invalidParams = {
        query: 'test',
        per_page: 200, // Over limit
      };

      await expect(ticketsTool['searchTickets'](invalidParams)).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle validation errors properly', async () => {
      const result = await ticketsTool.execute({
        action: 'create',
        params: { subject: 'Test' }, // Missing required fields
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBeDefined();
    });

    it('should handle client errors properly', async () => {
      mockClient.post.mockRejectedValue(new Error('API Error'));

      const result = await ticketsTool.execute({
        action: 'create',
        params: {
          subject: 'Test',
          description: 'Test',
          email: 'test@example.com',
          priority: 2,
          status: 2,
        },
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('API Error');
    });

    it('should handle network errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network timeout'));

      const result = await ticketsTool.execute({
        action: 'list',
        params: {},
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Network timeout');
    });
  });

  describe('edge cases', () => {
    it('should handle empty ticket list', async () => {
      mockClient.get.mockResolvedValue([]);

      const result = await ticketsTool['listTickets']({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.tickets).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it('should handle null response from client', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await ticketsTool['getTicket']({ ticket_id: 123 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.ticket).toBeNull();
    });

    it('should handle missing search results', async () => {
      mockClient.get.mockResolvedValue({ results: [], total: 0 });

      const result = await ticketsTool['searchTickets']({ query: 'nonexistent' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.tickets).toEqual([]);
      expect(parsed.total).toBe(0);
    });
  });

  describe('data transformation', () => {
    it('should properly transform enum values', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Ticket);

      const params = {
        subject: 'Test',
        description: 'Test',
        email: 'test@example.com',
        priority: 4, // Urgent
        status: 5,  // Closed
        source: 3,  // Phone
      };

      await ticketsTool['createTicket'](params);

      const callArgs = mockClient.post.mock.calls[0]?.[1];
      expect(callArgs?.priority).toBe(4);
      expect(callArgs?.status).toBe(5);
      expect(callArgs?.source).toBe(3);
    });

    it('should handle array transformations', async () => {
      mockClient.get.mockResolvedValue([]);

      const params = {
        include: ['description', 'requester', 'stats'],
      };

      await ticketsTool['listTickets'](params);

      const callArgs = mockClient.get.mock.calls[0]?.[1];
      expect(callArgs?.params?.include).toBe('description,requester,stats');
    });

    it('should preserve custom fields structure', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Ticket);

      const customFields = {
        text_field: 'text value',
        number_field: 42,
        boolean_field: true,
        array_field: ['item1', 'item2'],
        object_field: { nested: 'value' },
      };

      const params = {
        subject: 'Test',
        description: 'Test',
        email: 'test@example.com',
        priority: 2,
        status: 2,
        custom_fields: customFields,
      };

      await ticketsTool['createTicket'](params);

      const callArgs = mockClient.post.mock.calls[0]?.[1];
      expect(callArgs?.custom_fields).toEqual(customFields);
    });
  });
});