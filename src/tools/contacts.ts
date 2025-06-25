import { z } from 'zod';
import { BaseTool } from './base.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Contact } from '../core/types.js';

const CreateContactSchema = z.object({
  name: z.string().describe('Name of the contact'),
  email: z.string().email().describe('Primary email address'),
  phone: z.string().optional().describe('Phone number'),
  mobile: z.string().optional().describe('Mobile number'),
  twitter_id: z.string().optional().describe('Twitter handle'),
  unique_external_id: z.string().optional().describe('External ID from another system'),
  other_emails: z.array(z.string().email()).optional().describe('Additional email addresses'),
  company_id: z.number().optional().describe('Company ID to associate with'),
  view_all_tickets: z.boolean().optional().describe('Can view all company tickets'),
  other_companies: z.array(z.number()).optional().describe('Additional company IDs'),
  address: z.string().optional().describe('Contact address'),
  description: z.string().optional().describe('Description or notes'),
  job_title: z.string().optional().describe('Job title'),
  language: z.string().optional().describe('Preferred language (e.g., "en", "fr")'),
  time_zone: z.string().optional().describe('Time zone (e.g., "Eastern Time (US & Canada)")'),
  tags: z.array(z.string()).optional().describe('Tags for the contact'),
  custom_fields: z.record(z.any()).optional().describe('Custom fields as key-value pairs'),
});

const UpdateContactSchema = z.object({
  contact_id: z.number().describe('ID of the contact to update'),
  name: z.string().optional().describe('Name of the contact'),
  email: z.string().email().optional().describe('Primary email address'),
  phone: z.string().optional().describe('Phone number'),
  mobile: z.string().optional().describe('Mobile number'),
  twitter_id: z.string().optional().describe('Twitter handle'),
  unique_external_id: z.string().optional().describe('External ID from another system'),
  other_emails: z.array(z.string().email()).optional().describe('Additional email addresses'),
  company_id: z.number().optional().describe('Company ID to associate with'),
  view_all_tickets: z.boolean().optional().describe('Can view all company tickets'),
  other_companies: z.array(z.number()).optional().describe('Additional company IDs'),
  address: z.string().optional().describe('Contact address'),
  description: z.string().optional().describe('Description or notes'),
  job_title: z.string().optional().describe('Job title'),
  language: z.string().optional().describe('Preferred language'),
  time_zone: z.string().optional().describe('Time zone'),
  tags: z.array(z.string()).optional().describe('Tags for the contact'),
  custom_fields: z.record(z.any()).optional().describe('Custom fields as key-value pairs'),
});

const ListContactsSchema = z.object({
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
  email: z.string().email().optional().describe('Filter by email address'),
  mobile: z.string().optional().describe('Filter by mobile number'),
  phone: z.string().optional().describe('Filter by phone number'),
  company_id: z.number().optional().describe('Filter by company ID'),
  state: z.enum(['verified', 'unverified', 'blocked', 'deleted']).optional().describe('Filter by contact state'),
  updated_since: z.string().optional().describe('ISO 8601 datetime to filter contacts updated after this time'),
});

const GetContactSchema = z.object({
  contact_id: z.number().describe('ID of the contact to retrieve'),
  include: z.array(z.string()).optional().describe('Include related data: "tickets"'),
});

const DeleteContactSchema = z.object({
  contact_id: z.number().describe('ID of the contact to delete'),
  permanent: z.boolean().optional().describe('Permanently delete (cannot be restored)'),
});

const SearchContactsSchema = z.object({
  query: z.string().describe('Search query string'),
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
});

const MergeContactsSchema = z.object({
  primary_contact_id: z.number().describe('ID of the primary contact to keep'),
  secondary_contact_ids: z.array(z.number()).min(1).describe('IDs of contacts to merge into the primary contact (at least one required)'),
});

export class ContactsTool extends BaseTool {
  get definition(): Tool {
    return {
      name: 'contacts_manage',
      description: 'Manage Freshdesk contacts - create, update, list, get, delete, search, and merge contacts',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'update', 'list', 'get', 'delete', 'search', 'merge'],
            description: 'Action to perform on contacts',
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
          return await this.createContact(params);
        case 'update':
          return await this.updateContact(params);
        case 'list':
          return await this.listContacts(params);
        case 'get':
          return await this.getContact(params);
        case 'delete':
          return await this.deleteContact(params);
        case 'search':
          return await this.searchContacts(params);
        case 'merge':
          return await this.mergeContacts(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async createContact(params: any): Promise<string> {
    const validated = CreateContactSchema.parse(params);
    
    const contact = await this.client.post<Contact>('/contacts', validated);
    return this.formatResponse({
      success: true,
      contact,
      message: `Contact "${contact.name}" (ID: ${contact.id}) created successfully`,
    });
  }

  private async updateContact(params: any): Promise<string> {
    const validated = UpdateContactSchema.parse(params);
    const { contact_id, ...updateData } = validated;

    const contact = await this.client.put<Contact>(`/contacts/${contact_id}`, updateData);
    return this.formatResponse({
      success: true,
      contact,
      message: `Contact ID ${contact_id} updated successfully`,
    });
  }

  private async listContacts(params: any): Promise<string> {
    const validated = ListContactsSchema.parse(params);
    
    const queryParams: any = {
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    if (validated.email) queryParams.email = validated.email;
    if (validated.mobile) queryParams.mobile = validated.mobile;
    if (validated.phone) queryParams.phone = validated.phone;
    if (validated.company_id) queryParams.company_id = validated.company_id;
    if (validated.state) queryParams.state = validated.state;
    if (validated.updated_since) queryParams.updated_since = validated.updated_since;

    const contacts = await this.client.get<Contact[]>('/contacts', { params: queryParams });
    return this.formatResponse({
      success: true,
      contacts,
      count: contacts.length,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }

  private async getContact(params: any): Promise<string> {
    const validated = GetContactSchema.parse(params);
    
    const queryParams: any = {};
    if (validated.include) {
      queryParams.include = validated.include.join(',');
    }

    const contact = await this.client.get<Contact>(`/contacts/${validated.contact_id}`, { params: queryParams });
    return this.formatResponse({
      success: true,
      contact,
    });
  }

  private async deleteContact(params: any): Promise<string> {
    const validated = DeleteContactSchema.parse(params);
    
    const endpoint = validated.permanent 
      ? `/contacts/${validated.contact_id}/hard_delete`
      : `/contacts/${validated.contact_id}`;

    await this.client.delete(endpoint);
    return this.formatResponse({
      success: true,
      message: `Contact ID ${validated.contact_id} ${validated.permanent ? 'permanently' : ''} deleted successfully`,
    });
  }

  private async searchContacts(params: any): Promise<string> {
    const validated = SearchContactsSchema.parse(params);
    
    const queryParams = {
      query: validated.query,
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    const response = await this.client.get<{ results: Contact[]; total: number }>('/search/contacts', { params: queryParams });
    return this.formatResponse({
      success: true,
      contacts: response.results,
      total: response.total,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }

  private async mergeContacts(params: any): Promise<string> {
    const validated = MergeContactsSchema.parse(params);
    
    const contact = await this.client.put<Contact>(`/contacts/${validated.primary_contact_id}/merge`, {
      secondary_contact_ids: validated.secondary_contact_ids,
    });

    return this.formatResponse({
      success: true,
      contact,
      message: `Successfully merged ${validated.secondary_contact_ids.length} contacts into contact ID ${validated.primary_contact_id}`,
    });
  }
}