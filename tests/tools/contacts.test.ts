import { ContactsTool } from '../../src/tools/contacts.js';
import { FreshdeskClient } from '../../src/api/client.js';
import { Contact } from '../../src/core/types.js';

// Mock the client
jest.mock('../../src/api/client.js');

describe('ContactsTool', () => {
  let mockClient: jest.Mocked<FreshdeskClient>;
  let contactsTool: ContactsTool;

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

    contactsTool = new ContactsTool(mockClient);
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const definition = contactsTool.definition;

      expect(definition.name).toBe('contacts_manage');
      expect(definition.description).toContain('Manage Freshdesk contacts');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('action');
      expect(definition.inputSchema.properties).toHaveProperty('params');
      expect((definition.inputSchema as any).required).toEqual(['action', 'params']);
    });

    it('should have correct action enum values', () => {
      const definition = contactsTool.definition;
      const actionProperty = definition.inputSchema.properties?.['action'];

      expect((actionProperty as any).enum).toEqual([
        'create', 'update', 'list', 'get', 'delete', 'search', 'merge'
      ]);
    });
  });

  describe('execute', () => {
    it('should route to correct method based on action', async () => {
      const createSpy = jest.spyOn(contactsTool as any, 'createContact').mockResolvedValue('create result');
      const updateSpy = jest.spyOn(contactsTool as any, 'updateContact').mockResolvedValue('update result');
      const listSpy = jest.spyOn(contactsTool as any, 'listContacts').mockResolvedValue('list result');
      const getSpy = jest.spyOn(contactsTool as any, 'getContact').mockResolvedValue('get result');
      const deleteSpy = jest.spyOn(contactsTool as any, 'deleteContact').mockResolvedValue('delete result');
      const searchSpy = jest.spyOn(contactsTool as any, 'searchContacts').mockResolvedValue('search result');
      const mergeSpy = jest.spyOn(contactsTool as any, 'mergeContacts').mockResolvedValue('merge result');

      await expect(contactsTool.execute({ action: 'create', params: {} })).resolves.toBe('create result');
      await expect(contactsTool.execute({ action: 'update', params: {} })).resolves.toBe('update result');
      await expect(contactsTool.execute({ action: 'list', params: {} })).resolves.toBe('list result');
      await expect(contactsTool.execute({ action: 'get', params: {} })).resolves.toBe('get result');
      await expect(contactsTool.execute({ action: 'delete', params: {} })).resolves.toBe('delete result');
      await expect(contactsTool.execute({ action: 'search', params: {} })).resolves.toBe('search result');
      await expect(contactsTool.execute({ action: 'merge', params: {} })).resolves.toBe('merge result');

      expect(createSpy).toHaveBeenCalledWith({});
      expect(updateSpy).toHaveBeenCalledWith({});
      expect(listSpy).toHaveBeenCalledWith({});
      expect(getSpy).toHaveBeenCalledWith({});
      expect(deleteSpy).toHaveBeenCalledWith({});
      expect(searchSpy).toHaveBeenCalledWith({});
      expect(mergeSpy).toHaveBeenCalledWith({});
    });

    it('should handle unknown action', async () => {
      const result = await contactsTool.execute({ action: 'unknown', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain('Unknown action: unknown');
    });

    it('should handle errors in action methods', async () => {
      jest.spyOn(contactsTool as any, 'createContact').mockRejectedValue(new Error('Create failed'));

      const result = await contactsTool.execute({ action: 'create', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Create failed');
    });
  });

  describe('createContact', () => {
    const mockContact: Contact = {
      id: 123,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    } as Contact;

    it('should create contact with minimal required data', async () => {
      mockClient.post.mockResolvedValue(mockContact);

      const params = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = await contactsTool['createContact'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', params);

      expect(parsed.success).toBe(true);
      expect(parsed.contact).toEqual(mockContact);
      expect(parsed.message).toBe('Contact "John Doe" (ID: 123) created successfully');
    });

    it('should create contact with all optional fields', async () => {
      mockClient.post.mockResolvedValue(mockContact);

      const params = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1-555-0123',
        mobile: '+1-555-0124',
        twitter_id: '@janesmith',
        unique_external_id: 'EXT123',
        other_emails: ['jane.alt@example.com', 'j.smith@example.com'],
        company_id: 456,
        view_all_tickets: true,
        other_companies: [789, 101],
        address: '123 Main St, City, State 12345',
        description: 'VIP customer',
        job_title: 'Software Engineer',
        language: 'en',
        time_zone: 'Eastern Time (US & Canada)',
        tags: ['vip', 'engineer'],
        custom_fields: { department: 'IT', level: 'senior' },
      };

      await contactsTool['createContact'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', params);
    });

    it('should validate required fields', async () => {
      const invalidParams = {
        name: 'John Doe',
        // Missing email
      };

      await expect(contactsTool['createContact'](invalidParams)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const invalidParams = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      await expect(contactsTool['createContact'](invalidParams)).rejects.toThrow();
    });

    it('should validate other_emails format', async () => {
      const invalidParams = {
        name: 'John Doe',
        email: 'john@example.com',
        other_emails: ['valid@example.com', 'invalid-email'],
      };

      await expect(contactsTool['createContact'](invalidParams)).rejects.toThrow();
    });

    it('should validate other_companies as array of numbers', async () => {
      const invalidParams = {
        name: 'John Doe',
        email: 'john@example.com',
        other_companies: ['123', '456'], // Should be numbers
      };

      await expect(contactsTool['createContact'](invalidParams)).rejects.toThrow();
    });
  });

  describe('updateContact', () => {
    const mockContact: Contact = {
      id: 123,
      name: 'John Doe Updated',
      email: 'john.updated@example.com',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T12:00:00Z',
    } as Contact;

    it('should update contact with valid data', async () => {
      mockClient.put.mockResolvedValue(mockContact);

      const params = {
        contact_id: 123,
        name: 'John Doe Updated',
        email: 'john.updated@example.com',
      };

      const result = await contactsTool['updateContact'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.put).toHaveBeenCalledWith('/contacts/123', {
        name: 'John Doe Updated',
        email: 'john.updated@example.com',
      });

      expect(parsed.success).toBe(true);
      expect(parsed.contact).toEqual(mockContact);
      expect(parsed.message).toBe('Contact ID 123 updated successfully');
    });

    it('should update contact with partial data', async () => {
      mockClient.put.mockResolvedValue(mockContact);

      const params = {
        contact_id: 456,
        job_title: 'Senior Engineer',
        tags: ['senior', 'lead'],
      };

      await contactsTool['updateContact'](params);

      expect(mockClient.put).toHaveBeenCalledWith('/contacts/456', {
        job_title: 'Senior Engineer',
        tags: ['senior', 'lead'],
      });
    });

    it('should validate required contact_id', async () => {
      const invalidParams = {
        name: 'Test',
        // Missing contact_id
      };

      await expect(contactsTool['updateContact'](invalidParams)).rejects.toThrow();
    });

    it('should validate email format in updates', async () => {
      const invalidParams = {
        contact_id: 123,
        email: 'invalid-email-format',
      };

      await expect(contactsTool['updateContact'](invalidParams)).rejects.toThrow();
    });
  });

  describe('listContacts', () => {
    const mockContacts: Contact[] = [
      { id: 1, name: 'Contact 1', email: 'contact1@example.com' } as Contact,
      { id: 2, name: 'Contact 2', email: 'contact2@example.com' } as Contact,
    ];

    it('should list contacts with default parameters', async () => {
      mockClient.get.mockResolvedValue(mockContacts);

      const result = await contactsTool['listContacts']({});
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/contacts', {
        params: {
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.contacts).toEqual(mockContacts);
      expect(parsed.count).toBe(2);
      expect(parsed.page).toBe(1);
      expect(parsed.per_page).toBe(30);
    });

    it('should list contacts with filters', async () => {
      mockClient.get.mockResolvedValue(mockContacts);

      const params = {
        page: 2,
        per_page: 50,
        email: 'specific@example.com',
        mobile: '+1-555-0123',
        phone: '+1-555-0124',
        company_id: 456,
        state: 'verified' as const,
        updated_since: '2023-01-01T00:00:00Z',
      };

      await contactsTool['listContacts'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/contacts', {
        params: {
          page: 2,
          per_page: 50,
          email: 'specific@example.com',
          mobile: '+1-555-0123',
          phone: '+1-555-0124',
          company_id: 456,
          state: 'verified',
          updated_since: '2023-01-01T00:00:00Z',
        },
      });
    });

    it('should validate state enum values', async () => {
      const invalidParams = {
        state: 'invalid_state',
      };

      await expect(contactsTool['listContacts'](invalidParams)).rejects.toThrow();
    });

    it('should validate pagination limits', async () => {
      const invalidParams = {
        per_page: 150, // Over limit
      };

      await expect(contactsTool['listContacts'](invalidParams)).rejects.toThrow();
    });

    it('should validate email format in filters', async () => {
      const invalidParams = {
        email: 'invalid-email-format',
      };

      await expect(contactsTool['listContacts'](invalidParams)).rejects.toThrow();
    });
  });

  describe('getContact', () => {
    const mockContact: Contact = {
      id: 123,
      name: 'Single Contact',
      email: 'single@example.com',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    } as Contact;

    it('should get contact by id', async () => {
      mockClient.get.mockResolvedValue(mockContact);

      const params = {
        contact_id: 123,
      };

      const result = await contactsTool['getContact'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/contacts/123', {
        params: {},
      });

      expect(parsed.success).toBe(true);
      expect(parsed.contact).toEqual(mockContact);
    });

    it('should get contact with includes', async () => {
      mockClient.get.mockResolvedValue(mockContact);

      const params = {
        contact_id: 456,
        include: ['tickets'],
      };

      await contactsTool['getContact'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/contacts/456', {
        params: {
          include: 'tickets',
        },
      });
    });

    it('should validate required contact_id', async () => {
      const invalidParams = {};

      await expect(contactsTool['getContact'](invalidParams)).rejects.toThrow();
    });
  });

  describe('deleteContact', () => {
    it('should delete contact (soft delete)', async () => {
      mockClient.delete.mockResolvedValue(undefined);

      const params = {
        contact_id: 123,
      };

      const result = await contactsTool['deleteContact'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.delete).toHaveBeenCalledWith('/contacts/123');

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Contact ID 123  deleted successfully');
    });

    it('should delete contact permanently', async () => {
      mockClient.delete.mockResolvedValue(undefined);

      const params = {
        contact_id: 456,
        permanent: true,
      };

      const result = await contactsTool['deleteContact'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.delete).toHaveBeenCalledWith('/contacts/456/hard_delete');

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Contact ID 456 permanently deleted successfully');
    });

    it('should validate required contact_id', async () => {
      const invalidParams = {
        permanent: true,
        // Missing contact_id
      };

      await expect(contactsTool['deleteContact'](invalidParams)).rejects.toThrow();
    });
  });

  describe('searchContacts', () => {
    const mockSearchResponse = {
      results: [
        { id: 1, name: 'Search Result 1', email: 'result1@example.com' } as Contact,
        { id: 2, name: 'Search Result 2', email: 'result2@example.com' } as Contact,
      ],
      total: 2,
    };

    it('should search contacts with query', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const params = {
        query: 'John Doe',
      };

      const result = await contactsTool['searchContacts'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/search/contacts', {
        params: {
          query: 'John Doe',
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.contacts).toEqual(mockSearchResponse.results);
      expect(parsed.total).toBe(2);
      expect(parsed.page).toBe(1);
      expect(parsed.per_page).toBe(30);
    });

    it('should search contacts with pagination', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const params = {
        query: 'engineer',
        page: 3,
        per_page: 10,
      };

      await contactsTool['searchContacts'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/search/contacts', {
        params: {
          query: 'engineer',
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

      await expect(contactsTool['searchContacts'](invalidParams)).rejects.toThrow();
    });

    it('should validate pagination constraints', async () => {
      const invalidParams = {
        query: 'test',
        per_page: 200, // Over limit
      };

      await expect(contactsTool['searchContacts'](invalidParams)).rejects.toThrow();
    });
  });

  describe('mergeContacts', () => {
    const mockMergedContact: Contact = {
      id: 123,
      name: 'Merged Contact',
      email: 'merged@example.com',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T12:00:00Z',
    } as Contact;

    it('should merge contacts successfully', async () => {
      mockClient.put.mockResolvedValue(mockMergedContact);

      const params = {
        primary_contact_id: 123,
        secondary_contact_ids: [456, 789],
      };

      const result = await contactsTool['mergeContacts'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.put).toHaveBeenCalledWith('/contacts/123/merge', {
        secondary_contact_ids: [456, 789],
      });

      expect(parsed.success).toBe(true);
      expect(parsed.contact).toEqual(mockMergedContact);
      expect(parsed.message).toBe('Successfully merged 2 contacts into contact ID 123');
    });

    it('should validate required primary_contact_id', async () => {
      const invalidParams = {
        secondary_contact_ids: [456, 789],
        // Missing primary_contact_id
      };

      await expect(contactsTool['mergeContacts'](invalidParams)).rejects.toThrow();
    });

    it('should validate required secondary_contact_ids', async () => {
      const invalidParams = {
        primary_contact_id: 123,
        // Missing secondary_contact_ids
      };

      await expect(contactsTool['mergeContacts'](invalidParams)).rejects.toThrow();
    });

    it('should validate secondary_contact_ids as array of numbers', async () => {
      const invalidParams = {
        primary_contact_id: 123,
        secondary_contact_ids: ['456', '789'], // Should be numbers
      };

      await expect(contactsTool['mergeContacts'](invalidParams)).rejects.toThrow();
    });

    it('should handle single contact merge', async () => {
      mockClient.put.mockResolvedValue(mockMergedContact);

      const params = {
        primary_contact_id: 123,
        secondary_contact_ids: [456],
      };

      const result = await contactsTool['mergeContacts'](params);
      const parsed = JSON.parse(result);

      expect(parsed.message).toBe('Successfully merged 1 contacts into contact ID 123');
    });
  });

  describe('error handling', () => {
    it('should handle validation errors properly', async () => {
      const result = await contactsTool.execute({
        action: 'create',
        params: { name: 'Test' }, // Missing required email
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBeDefined();
    });

    it('should handle client errors properly', async () => {
      mockClient.post.mockRejectedValue(new Error('API Error'));

      const result = await contactsTool.execute({
        action: 'create',
        params: {
          name: 'Test',
          email: 'test@example.com',
        },
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('API Error');
    });

    it('should handle network errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network timeout'));

      const result = await contactsTool.execute({
        action: 'list',
        params: {},
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Network timeout');
    });
  });

  describe('edge cases', () => {
    it('should handle empty contact list', async () => {
      mockClient.get.mockResolvedValue([]);

      const result = await contactsTool['listContacts']({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.contacts).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it('should handle null response from client', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await contactsTool['getContact']({ contact_id: 123 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.contact).toBeNull();
    });

    it('should handle missing search results', async () => {
      mockClient.get.mockResolvedValue({ results: [], total: 0 });

      const result = await contactsTool['searchContacts']({ query: 'nonexistent' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.contacts).toEqual([]);
      expect(parsed.total).toBe(0);
    });

    it('should handle empty secondary_contact_ids array', async () => {
      const invalidParams = {
        primary_contact_id: 123,
        secondary_contact_ids: [],
      };

      await expect(contactsTool['mergeContacts'](invalidParams)).rejects.toThrow();
    });
  });

  describe('data validation edge cases', () => {
    it('should handle very long names', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Contact);

      const params = {
        name: 'A'.repeat(1000), // Very long name
        email: 'test@example.com',
      };

      await contactsTool['createContact'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', params);
    });

    it('should handle international phone numbers', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Contact);

      const params = {
        name: 'International User',
        email: 'intl@example.com',
        phone: '+44 20 7946 0958',
        mobile: '+33 1 42 68 53 00',
      };

      await contactsTool['createContact'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', params);
    });

    it('should handle unicode characters in names', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Contact);

      const params = {
        name: '张三 Müller José',
        email: 'unicode@example.com',
      };

      await contactsTool['createContact'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', params);
    });

    it('should handle empty arrays in optional fields', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Contact);

      const params = {
        name: 'Test User',
        email: 'test@example.com',
        other_emails: [],
        other_companies: [],
        tags: [],
      };

      await contactsTool['createContact'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', params);
    });

    it('should handle complex custom fields', async () => {
      mockClient.post.mockResolvedValue({ id: 123 } as Contact);

      const complexCustomFields = {
        text_field: 'Simple text',
        number_field: 42,
        boolean_field: true,
        date_field: '2023-01-01',
        array_field: ['item1', 'item2', 'item3'],
        nested_object: {
          level1: {
            level2: 'deep value',
            array: [1, 2, 3],
          },
        },
      };

      const params = {
        name: 'Complex User',
        email: 'complex@example.com',
        custom_fields: complexCustomFields,
      };

      await contactsTool['createContact'](params);

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', params);
    });
  });
});