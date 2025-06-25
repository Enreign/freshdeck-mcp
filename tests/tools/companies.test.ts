import { CompaniesTool } from '../../src/tools/companies.js';
import { FreshdeskClient } from '../../src/api/client.js';
import { Company } from '../../src/core/types.js';

// Mock the client
jest.mock('../../src/api/client.js');

describe('CompaniesTool', () => {
  let mockClient: jest.Mocked<FreshdeskClient>;
  let companiesTool: CompaniesTool;

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

    companiesTool = new CompaniesTool(mockClient);
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const definition = companiesTool.definition;

      expect(definition.name).toBe('companies_manage');
      expect(definition.description).toContain('Manage Freshdesk companies');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('action');
      expect(definition.inputSchema.properties).toHaveProperty('params');
      expect((definition.inputSchema as any).required).toEqual(['action', 'params']);
    });
  });

  describe('execute', () => {
    it('should route to correct method based on action', async () => {
      const createSpy = jest.spyOn(companiesTool as any, 'createCompany').mockResolvedValue('create result');
      const listSpy = jest.spyOn(companiesTool as any, 'listCompanies').mockResolvedValue('list result');
      const getSpy = jest.spyOn(companiesTool as any, 'getCompany').mockResolvedValue('get result');
      const updateSpy = jest.spyOn(companiesTool as any, 'updateCompany').mockResolvedValue('update result');
      const deleteSpy = jest.spyOn(companiesTool as any, 'deleteCompany').mockResolvedValue('delete result');
      const searchSpy = jest.spyOn(companiesTool as any, 'searchCompanies').mockResolvedValue('search result');

      expect(createSpy).toBeDefined();
      expect(listSpy).toBeDefined();
      expect(getSpy).toBeDefined();
      expect(updateSpy).toBeDefined();
      expect(deleteSpy).toBeDefined();
      expect(searchSpy).toBeDefined();

      await expect(companiesTool.execute({ action: 'create', params: {} })).resolves.toBe('create result');
      await expect(companiesTool.execute({ action: 'list', params: {} })).resolves.toBe('list result');
      await expect(companiesTool.execute({ action: 'get', params: {} })).resolves.toBe('get result');
      await expect(companiesTool.execute({ action: 'update', params: {} })).resolves.toBe('update result');
      await expect(companiesTool.execute({ action: 'delete', params: {} })).resolves.toBe('delete result');
      await expect(companiesTool.execute({ action: 'search', params: {} })).resolves.toBe('search result');
    });

    it('should handle unknown action', async () => {
      const result = await companiesTool.execute({ action: 'unknown', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain('Unknown action: unknown');
    });
  });

  describe('createCompany', () => {
    const mockCompany: Company = {
      id: 123,
      name: 'Test Company',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    } as Company;

    it('should create company with valid data', async () => {
      mockClient.post.mockResolvedValue(mockCompany);

      const params = {
        name: 'Test Company',
        description: 'A test company',
        domains: ['testcompany.com'],
      };

      const result = await companiesTool['createCompany'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.post).toHaveBeenCalledWith('/companies', params);
      expect(parsed.success).toBe(true);
      expect(parsed.company).toEqual(mockCompany);
    });

    it('should validate required name field', async () => {
      const invalidParams = {
        description: 'Missing name',
      };

      await expect(companiesTool['createCompany'](invalidParams)).rejects.toThrow();
    });
  });

  describe('listCompanies', () => {
    const mockCompanies: Company[] = [
      { id: 1, name: 'Company 1' } as Company,
      { id: 2, name: 'Company 2' } as Company,
    ];

    it('should list companies with default parameters', async () => {
      mockClient.get.mockResolvedValue(mockCompanies);

      const result = await companiesTool['listCompanies']({});
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/companies', {
        params: {
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.companies).toEqual(mockCompanies);
      expect(parsed.count).toBe(2);
    });

    it('should list companies with pagination', async () => {
      mockClient.get.mockResolvedValue(mockCompanies);

      const params = {
        page: 2,
        per_page: 50,
      };

      await companiesTool['listCompanies'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/companies', {
        params: {
          page: 2,
          per_page: 50,
        },
      });
    });
  });

  describe('getCompany', () => {
    const mockCompany: Company = {
      id: 123,
      name: 'Single Company',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    } as Company;

    it('should get company by id', async () => {
      mockClient.get.mockResolvedValue(mockCompany);

      const params = {
        company_id: 123,
      };

      const result = await companiesTool['getCompany'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/companies/123');
      expect(parsed.success).toBe(true);
      expect(parsed.company).toEqual(mockCompany);
    });
  });

  describe('updateCompany', () => {
    const mockCompany: Company = {
      id: 123,
      name: 'Updated Company',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T12:00:00Z',
    } as Company;

    it('should update company with valid data', async () => {
      mockClient.put.mockResolvedValue(mockCompany);

      const params = {
        company_id: 123,
        name: 'Updated Company',
        description: 'Updated description',
      };

      const result = await companiesTool['updateCompany'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.put).toHaveBeenCalledWith('/companies/123', {
        name: 'Updated Company',
        description: 'Updated description',
      });

      expect(parsed.success).toBe(true);
      expect(parsed.company).toEqual(mockCompany);
    });
  });

  describe('deleteCompany', () => {
    it('should delete company by id', async () => {
      mockClient.delete.mockResolvedValue(undefined);

      const params = {
        company_id: 123,
      };

      const result = await companiesTool['deleteCompany'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.delete).toHaveBeenCalledWith('/companies/123');
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Company ID 123 deleted successfully');
    });
  });

  describe('searchCompanies', () => {
    const mockSearchResponse = {
      results: [
        { id: 1, name: 'Search Result 1' } as Company,
        { id: 2, name: 'Search Result 2' } as Company,
      ],
      total: 2,
    };

    it('should search companies with query', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const params = {
        query: 'tech company',
      };

      const result = await companiesTool['searchCompanies'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/search/companies', {
        params: {
          query: 'tech company',
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.companies).toEqual(mockSearchResponse.results);
      expect(parsed.total).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle validation errors', async () => {
      const result = await companiesTool.execute({
        action: 'create',
        params: {}, // Missing required name
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
    });

    it('should handle client errors', async () => {
      mockClient.post.mockRejectedValue(new Error('API Error'));

      const result = await companiesTool.execute({
        action: 'create',
        params: { name: 'Test Company' },
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('API Error');
    });
  });
});