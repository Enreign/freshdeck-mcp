import { z } from 'zod';
import { EnhancedBaseTool } from './enhanced-base.js';
import { FreshdeskClient } from '../api/client.js';
import { Permission, AccessLevel } from '../auth/permissions.js';

const CompaniesManageSchema = z.object({
  action: z.enum(['create', 'update', 'list', 'get', 'delete', 'search']).describe('Action to perform on companies'),
  params: z.object({
    // Create/update company params
    name: z.string().describe('Name of the company').optional(),
    domains: z.array(z.string()).describe('Domains associated with the company').optional(),
    description: z.string().describe('Description of the company').optional(),
    note: z.string().describe('Any notes about the company').optional(),
    health_score: z.string().describe('Health score of the company').optional(),
    account_tier: z.enum(['Basic', 'Premium', 'Enterprise']).describe('Account tier').optional(),
    renewal_date: z.string().describe('ISO 8601 date for renewal').optional(),
    industry: z.string().describe('Industry the company belongs to').optional(),
    custom_fields: z.record(z.any()).describe('Custom fields as key-value pairs').optional(),
    
    // Update/get/delete specific
    company_id: z.number().describe('ID of the company').optional(),
    
    // List specific
    page: z.number().min(1).describe('Page number (default: 1)').optional(),
    per_page: z.number().min(1).max(100).describe('Items per page (default: 30, max: 100)').optional(),
    
    // Search specific
    query: z.string().describe('Search query string').optional(),
    
    // Filter specific
    filter_name: z.string().describe('Filter companies by name').optional(),
  }).describe('Parameters for the action'),
});

export class CompaniesEnhancedTool extends EnhancedBaseTool {
  constructor(client: FreshdeskClient) {
    super(
      'companies_manage',
      'Manage Freshdesk companies - create, update, list, get, delete, and search companies',
      CompaniesManageSchema,
      {
        requiredPermissions: [Permission.COMPANIES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Company management capabilities',
      },
      client
    );
  }

  async execute(args: any): Promise<any> {
    try {
      const { action, params } = args;

      switch (action) {
        case 'create':
          return await this.createCompany(params);
        case 'update':
          return await this.updateCompany(params);
        case 'list':
          return await this.listCompanies(params);
        case 'get':
          return await this.getCompany(params);
        case 'delete':
          return await this.deleteCompany(params);
        case 'search':
          return await this.searchCompanies(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async createCompany(params: any): Promise<string> {
    const companyData = {
      name: params.name,
      domains: params.domains,
      description: params.description,
      note: params.note,
      health_score: params.health_score,
      account_tier: params.account_tier,
      renewal_date: params.renewal_date,
      industry: params.industry,
      custom_fields: params.custom_fields,
    };

    const response = await this.client.companies.create(companyData);
    return this.formatResponse({
      message: 'Company created successfully',
      company: response,
    });
  }

  private async updateCompany(params: any): Promise<string> {
    const { company_id, ...updateData } = params;
    
    if (!company_id) {
      throw new Error('company_id is required for update action');
    }

    const response = await this.client.companies.update(company_id, updateData);
    return this.formatResponse({
      message: 'Company updated successfully',
      company: response,
    });
  }

  private async listCompanies(params: any): Promise<string> {
    const options = {
      page: params.page,
      per_page: params.per_page,
    };

    // Apply name filter if provided
    let response = await this.client.companies.list(options);
    
    if (params.filter_name) {
      response = response.filter((company: any) => 
        company.name.toLowerCase().includes(params.filter_name.toLowerCase())
      );
    }

    return this.formatResponse({
      message: `Found ${response.length} companies`,
      companies: response,
    });
  }

  private async getCompany(params: any): Promise<string> {
    const { company_id } = params;
    
    if (!company_id) {
      throw new Error('company_id is required for get action');
    }

    const response = await this.client.companies.get(company_id);
    return this.formatResponse({
      message: 'Company retrieved successfully',
      company: response,
    });
  }

  private async deleteCompany(params: any): Promise<string> {
    const { company_id } = params;
    
    if (!company_id) {
      throw new Error('company_id is required for delete action');
    }

    await this.client.companies.delete(company_id);
    return this.formatResponse({
      message: 'Company deleted successfully',
      company_id,
    });
  }

  private async searchCompanies(params: any): Promise<string> {
    const { query, page, per_page } = params;
    
    if (!query) {
      throw new Error('query is required for search action');
    }

    const options = {
      page,
      per_page,
    };

    const response = await this.client.companies.search(query, options);
    return this.formatResponse({
      message: `Found ${response.results?.length || 0} companies matching query`,
      search_results: response,
    });
  }
}