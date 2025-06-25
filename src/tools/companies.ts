import { z } from 'zod';
import { BaseTool } from './base.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Company } from '../core/types.js';

const CreateCompanySchema = z.object({
  name: z.string().describe('Company name'),
  description: z.string().optional().describe('Company description'),
  note: z.string().optional().describe('Internal notes about the company'),
  domains: z.array(z.string()).optional().describe('Email domains associated with the company'),
  health_score: z.string().optional().describe('Company health score'),
  account_tier: z.string().optional().describe('Account tier (e.g., "Premium", "Enterprise")'),
  renewal_date: z.string().optional().describe('Contract renewal date'),
  industry: z.string().optional().describe('Industry sector'),
  custom_fields: z.record(z.any()).optional().describe('Custom fields as key-value pairs'),
});

const UpdateCompanySchema = z.object({
  company_id: z.number().describe('ID of the company to update'),
  name: z.string().optional().describe('Company name'),
  description: z.string().optional().describe('Company description'),
  note: z.string().optional().describe('Internal notes about the company'),
  domains: z.array(z.string()).optional().describe('Email domains associated with the company'),
  health_score: z.string().optional().describe('Company health score'),
  account_tier: z.string().optional().describe('Account tier'),
  renewal_date: z.string().optional().describe('Contract renewal date'),
  industry: z.string().optional().describe('Industry sector'),
  custom_fields: z.record(z.any()).optional().describe('Custom fields as key-value pairs'),
});

const ListCompaniesSchema = z.object({
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
});

const GetCompanySchema = z.object({
  company_id: z.number().describe('ID of the company to retrieve'),
});

const DeleteCompanySchema = z.object({
  company_id: z.number().describe('ID of the company to delete'),
});

const SearchCompaniesSchema = z.object({
  query: z.string().describe('Search query string'),
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
});

const ListCompanyContactsSchema = z.object({
  company_id: z.number().describe('ID of the company'),
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
});

export class CompaniesTool extends BaseTool {
  get definition(): Tool {
    return {
      name: 'companies_manage',
      description: 'Manage Freshdesk companies - create, update, list, get, delete, search companies, and list company contacts',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'update', 'list', 'get', 'delete', 'search', 'list_contacts'],
            description: 'Action to perform on companies',
          },
          params: {
            type: 'object',
            description: 'Parameters for the action',
          },
        },
        required: ['action', 'params'],
      },
    };
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
        case 'list_contacts':
          return await this.listCompanyContacts(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async createCompany(params: any): Promise<string> {
    const validated = CreateCompanySchema.parse(params);
    
    const company = await this.client.post<Company>('/companies', validated);
    return this.formatResponse({
      success: true,
      company,
      message: `Company "${company.name}" (ID: ${company.id}) created successfully`,
    });
  }

  private async updateCompany(params: any): Promise<string> {
    const validated = UpdateCompanySchema.parse(params);
    const { company_id, ...updateData } = validated;

    const company = await this.client.put<Company>(`/companies/${company_id}`, updateData);
    return this.formatResponse({
      success: true,
      company,
      message: `Company ID ${company_id} updated successfully`,
    });
  }

  private async listCompanies(params: any): Promise<string> {
    const validated = ListCompaniesSchema.parse(params);
    
    const queryParams = {
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    const companies = await this.client.get<Company[]>('/companies', { params: queryParams });
    return this.formatResponse({
      success: true,
      companies,
      count: companies.length,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }

  private async getCompany(params: any): Promise<string> {
    const validated = GetCompanySchema.parse(params);
    
    const company = await this.client.get<Company>(`/companies/${validated.company_id}`);
    return this.formatResponse({
      success: true,
      company,
    });
  }

  private async deleteCompany(params: any): Promise<string> {
    const validated = DeleteCompanySchema.parse(params);
    
    await this.client.delete(`/companies/${validated.company_id}`);
    return this.formatResponse({
      success: true,
      message: `Company ID ${validated.company_id} deleted successfully`,
    });
  }

  private async searchCompanies(params: any): Promise<string> {
    const validated = SearchCompaniesSchema.parse(params);
    
    const queryParams = {
      query: validated.query,
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    const response = await this.client.get<{ results: Company[]; total: number }>('/search/companies', { params: queryParams });
    return this.formatResponse({
      success: true,
      companies: response.results,
      total: response.total,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }

  private async listCompanyContacts(params: any): Promise<string> {
    const validated = ListCompanyContactsSchema.parse(params);
    
    const queryParams = {
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    const contacts = await this.client.get<any[]>(`/companies/${validated.company_id}/contacts`, { params: queryParams });
    return this.formatResponse({
      success: true,
      company_id: validated.company_id,
      contacts,
      count: contacts.length,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }
}