import { ConversationsTool } from '../../src/tools/conversations.js';
import { FreshdeskClient } from '../../src/api/client.js';
import { Conversation } from '../../src/core/types.js';

// Mock the client
jest.mock('../../src/api/client.js');

describe('ConversationsTool', () => {
  let mockClient: jest.Mocked<FreshdeskClient>;
  let conversationsTool: ConversationsTool;

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

    conversationsTool = new ConversationsTool(mockClient);
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const definition = conversationsTool.definition;

      expect(definition.name).toBe('conversations_manage');
      expect(definition.description).toContain('Manage Freshdesk ticket conversations');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('action');
      expect(definition.inputSchema.properties).toHaveProperty('params');
      expect((definition.inputSchema as any).required).toEqual(['action', 'params']);
    });
  });

  describe('execute', () => {
    it('should route to correct method based on action', async () => {
      const createReplySpy = jest.spyOn(conversationsTool as any, 'createReply').mockResolvedValue('reply result');
      const createNoteSpy = jest.spyOn(conversationsTool as any, 'createNote').mockResolvedValue('note result');
      const listSpy = jest.spyOn(conversationsTool as any, 'listConversations').mockResolvedValue('list result');
      const getSpy = jest.spyOn(conversationsTool as any, 'getConversation').mockResolvedValue('get result');
      const updateSpy = jest.spyOn(conversationsTool as any, 'updateConversation').mockResolvedValue('update result');
      const deleteSpy = jest.spyOn(conversationsTool as any, 'deleteConversation').mockResolvedValue('delete result');

      expect(createReplySpy).toBeDefined();
      expect(createNoteSpy).toBeDefined();
      expect(listSpy).toBeDefined();
      expect(getSpy).toBeDefined();
      expect(updateSpy).toBeDefined();
      expect(deleteSpy).toBeDefined();

      await expect(conversationsTool.execute({ action: 'create_reply', params: {} })).resolves.toBe('reply result');
      await expect(conversationsTool.execute({ action: 'create_note', params: {} })).resolves.toBe('note result');
      await expect(conversationsTool.execute({ action: 'list', params: {} })).resolves.toBe('list result');
      await expect(conversationsTool.execute({ action: 'get', params: {} })).resolves.toBe('get result');
      await expect(conversationsTool.execute({ action: 'update', params: {} })).resolves.toBe('update result');
      await expect(conversationsTool.execute({ action: 'delete', params: {} })).resolves.toBe('delete result');
    });

    it('should handle unknown action', async () => {
      const result = await conversationsTool.execute({ action: 'unknown', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain('Unknown action: unknown');
    });
  });

  describe('createConversation', () => {
    const mockConversation: Conversation = {
      id: 123,
      body: 'Test conversation body',
      body_text: 'Test conversation body',
      incoming: false,
      private: false,
      user_id: 456,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    } as Conversation;

    it('should create conversation with valid data', async () => {
      mockClient.post.mockResolvedValue(mockConversation);

      const params = {
        ticket_id: 789,
        body: 'Test conversation body',
        user_id: 456,
      };

      const result = await conversationsTool['createReply'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.post).toHaveBeenCalledWith('/tickets/789/reply', {
        body: 'Test conversation body',
        from_email: undefined,
        to_emails: undefined,
        cc_emails: undefined,
        bcc_emails: undefined,
        user_id: 456,
      });

      expect(parsed.success).toBe(true);
      expect(parsed.conversation).toEqual(mockConversation);
    });

    it('should create conversation with optional fields', async () => {
      mockClient.post.mockResolvedValue(mockConversation);

      const params = {
        ticket_id: 789,
        body: 'Private note',
        user_id: 456,
        private: true,
        cc_emails: ['cc@example.com'],
        bcc_emails: ['bcc@example.com'],
      };

      await conversationsTool['createReply'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/tickets/789/reply', {
        body: 'Private note',
        from_email: undefined,
        to_emails: undefined,
        cc_emails: ['cc@example.com'],
        bcc_emails: ['bcc@example.com'],
        user_id: 456,
      });
    });

    it('should validate required fields', async () => {
      const invalidParams = {
        ticket_id: 789,
        // Missing body and user_id
      };

      await expect(conversationsTool['createReply'](invalidParams)).rejects.toThrow();
    });

    it('should validate email formats', async () => {
      const invalidParams = {
        ticket_id: 789,
        body: 'Test',
        user_id: 456,
        cc_emails: ['invalid-email'],
      };

      await expect(conversationsTool['createReply'](invalidParams)).rejects.toThrow();
    });
  });

  describe('listConversations', () => {
    const mockConversations: Conversation[] = [
      { id: 1, body: 'Conversation 1', body_text: 'Conversation 1' } as Conversation,
      { id: 2, body: 'Conversation 2', body_text: 'Conversation 2' } as Conversation,
    ];

    it('should list conversations for a ticket', async () => {
      mockClient.get.mockResolvedValue(mockConversations);

      const params = {
        ticket_id: 789,
      };

      const result = await conversationsTool['listConversations'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/tickets/789/conversations', {
        params: {
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.conversations).toEqual(mockConversations);
      expect(parsed.count).toBe(2);
    });

    it('should list conversations with pagination', async () => {
      mockClient.get.mockResolvedValue(mockConversations);

      const params = {
        ticket_id: 789,
        page: 2,
        per_page: 50,
      };

      await conversationsTool['listConversations'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/tickets/789/conversations', {
        params: {
          page: 2,
          per_page: 50,
        },
      });
    });

    it('should validate required ticket_id', async () => {
      const invalidParams = {
        page: 1,
        // Missing ticket_id
      };

      await expect(conversationsTool['listConversations'](invalidParams)).rejects.toThrow();
    });
  });

  describe('updateConversation', () => {
    const mockConversation: Conversation = {
      id: 123,
      body: 'Updated conversation body',
      body_text: 'Updated conversation body',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T12:00:00Z',
    } as Conversation;

    it('should update conversation with valid data', async () => {
      mockClient.put.mockResolvedValue(mockConversation);

      const params = {
        conversation_id: 123,
        body: 'Updated conversation body',
        private: true,
      };

      const result = await conversationsTool['updateConversation'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.put).toHaveBeenCalledWith('/conversations/123', {
        body: 'Updated conversation body',
        private: true,
      });

      expect(parsed.success).toBe(true);
      expect(parsed.conversation).toEqual(mockConversation);
    });

    it('should validate required conversation_id', async () => {
      const invalidParams = {
        body: 'Test',
        // Missing conversation_id
      };

      await expect(conversationsTool['updateConversation'](invalidParams)).rejects.toThrow();
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation by id', async () => {
      mockClient.delete.mockResolvedValue(undefined);

      const params = {
        conversation_id: 123,
      };

      const result = await conversationsTool['deleteConversation'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.delete).toHaveBeenCalledWith('/conversations/123');
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Conversation ID 123 deleted successfully');
    });

    it('should validate required conversation_id', async () => {
      const invalidParams = {};

      await expect(conversationsTool['deleteConversation'](invalidParams)).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle validation errors', async () => {
      const result = await conversationsTool.execute({
        action: 'create_reply',
        params: { ticket_id: 789 }, // Missing required body and user_id
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
    });

    it('should handle client errors', async () => {
      mockClient.post.mockRejectedValue(new Error('API Error'));

      const result = await conversationsTool.execute({
        action: 'create_reply',
        params: {
          ticket_id: 789,
          body: 'Test',
          user_id: 456,
        },
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('API Error');
    });
  });

  describe('edge cases', () => {
    it('should handle empty conversation list', async () => {
      mockClient.get.mockResolvedValue([]);

      const result = await conversationsTool['listConversations']({ ticket_id: 789 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.conversations).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it('should handle HTML content in conversation body', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Conversation);

      const params = {
        ticket_id: 789,
        body: '<p>HTML <strong>formatted</strong> content with <a href="http://example.com">links</a></p>',
        user_id: 456,
      };

      await conversationsTool['createReply'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/tickets/789/reply', {
        body: '<p>HTML <strong>formatted</strong> content with <a href="http://example.com">links</a></p>',
        from_email: undefined,
        to_emails: undefined,
        cc_emails: undefined,
        bcc_emails: undefined,
        user_id: 456,
      });
    });

    it('should handle multiple email addresses', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Conversation);

      const params = {
        ticket_id: 789,
        body: 'Multiple recipients',
        user_id: 456,
        cc_emails: ['cc1@example.com', 'cc2@example.com', 'cc3@example.com'],
        bcc_emails: ['bcc1@example.com', 'bcc2@example.com'],
      };

      await conversationsTool['createReply'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/tickets/789/reply', {
        body: 'Multiple recipients',
        from_email: undefined,
        to_emails: undefined,
        cc_emails: ['cc1@example.com', 'cc2@example.com', 'cc3@example.com'],
        bcc_emails: ['bcc1@example.com', 'bcc2@example.com'],
        user_id: 456,
      });
    });
  });
});