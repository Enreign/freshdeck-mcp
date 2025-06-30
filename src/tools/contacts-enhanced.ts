import { z } from 'zod';
import { EnhancedBaseTool } from './enhanced-base.js';
import { FreshdeskClient } from '../api/client.js';
import { Permission, AccessLevel } from '../auth/permissions.js';

const ContactsManageSchema = z.object({
  action: z.enum(['create', 'update', 'list', 'get', 'delete', 'search', 'merge']).describe('Action to perform on contacts'),
  params: z.object({
    // Create/update contact params
    name: z.string().describe('Full name of the contact').optional(),
    email: z.string().email().describe('Primary email address').optional(),
    phone: z.string().describe('Phone number').optional(),
    mobile: z.string().describe('Mobile number').optional(),
    twitter_id: z.string().describe('Twitter handle').optional(),
    unique_external_id: z.string().describe('External ID from your system').optional(),
    other_emails: z.array(z.string().email()).describe('Additional email addresses').optional(),
    company_id: z.number().describe('Company ID to associate with').optional(),
    view_all_tickets: z.boolean().describe('Can view all company tickets').optional(),
    language: z.string().describe('Language code (e.g., "en", "fr")').optional(),
    time_zone: z.string().describe('Time zone (e.g., "Eastern Time (US & Canada)")').optional(),
    tags: z.array(z.string()).describe('Tags for the contact').optional(),
    custom_fields: z.record(z.any()).describe('Custom fields as key-value pairs').optional(),
    address: z.string().describe('Address of the contact').optional(),
    
    // Update/get/delete specific
    contact_id: z.number().describe('ID of the contact').optional(),
    
    // List specific
    page: z.number().min(1).describe('Page number (default: 1)').optional(),
    per_page: z.number().min(1).max(100).describe('Items per page (default: 30, max: 100)').optional(),
    email_filter: z.string().email().describe('Filter by email address').optional(),
    mobile_filter: z.string().describe('Filter by mobile number').optional(),
    phone_filter: z.string().describe('Filter by phone number').optional(),
    updated_since: z.string().describe('ISO 8601 datetime to filter contacts updated after this time').optional(),
    state: z.enum(['verified', 'unverified', 'blocked', 'deleted']).describe('Filter by contact state').optional(),
    
    // Search specific
    query: z.string().describe('Search query string').optional(),
    
    // Merge specific
    primary_contact_id: z.number().describe('Primary contact ID to merge into').optional(),
    secondary_contact_ids: z.array(z.number()).describe('Contact IDs to merge from').optional(),
  }).describe('Parameters for the action'),
});

export class ContactsEnhancedTool extends EnhancedBaseTool {
  constructor(client: FreshdeskClient) {
    super(
      'contacts_manage',
      'Manage Freshdesk contacts - create, update, list, get, delete, search, and merge contacts',
      ContactsManageSchema,
      {
        requiredPermissions: [Permission.CONTACTS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Contact management capabilities',
      },
      client
    );
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
    const contactData = {
      name: params.name,
      email: params.email,
      phone: params.phone,
      mobile: params.mobile,
      twitter_id: params.twitter_id,
      unique_external_id: params.unique_external_id,
      other_emails: params.other_emails,
      company_id: params.company_id,
      view_all_tickets: params.view_all_tickets,
      language: params.language,
      time_zone: params.time_zone,
      tags: params.tags,
      custom_fields: params.custom_fields,
      address: params.address,
    };

    const response = await this.client.contacts.create(contactData);
    return this.formatResponse({
      message: 'Contact created successfully',
      contact: response,
    });
  }

  private async updateContact(params: any): Promise<string> {
    const { contact_id, ...updateData } = params;
    
    if (!contact_id) {
      throw new Error('contact_id is required for update action');
    }

    const response = await this.client.contacts.update(contact_id, updateData);
    return this.formatResponse({
      message: 'Contact updated successfully',
      contact: response,
    });
  }

  private async listContacts(params: any): Promise<string> {
    const options = {
      page: params.page,
      per_page: params.per_page,
      email: params.email_filter,
      mobile: params.mobile_filter,
      phone: params.phone_filter,
      updated_since: params.updated_since,
      state: params.state,
    };

    const response = await this.client.contacts.list(options);
    return this.formatResponse({
      message: `Found ${response.length} contacts`,
      contacts: response,
    });
  }

  private async getContact(params: any): Promise<string> {
    const { contact_id } = params;
    
    if (!contact_id) {
      throw new Error('contact_id is required for get action');
    }

    const response = await this.client.contacts.get(contact_id);
    return this.formatResponse({
      message: 'Contact retrieved successfully',
      contact: response,
    });
  }

  private async deleteContact(params: any): Promise<string> {
    const { contact_id } = params;
    
    if (!contact_id) {
      throw new Error('contact_id is required for delete action');
    }

    await this.client.contacts.delete(contact_id);
    return this.formatResponse({
      message: 'Contact deleted successfully',
      contact_id,
    });
  }

  private async searchContacts(params: any): Promise<string> {
    const { query, page, per_page } = params;
    
    if (!query) {
      throw new Error('query is required for search action');
    }

    const options = {
      page,
      per_page,
    };

    const response = await this.client.contacts.search(query, options);
    return this.formatResponse({
      message: `Found ${response.results?.length || 0} contacts matching query`,
      search_results: response,
    });
  }

  private async mergeContacts(params: any): Promise<string> {
    const { primary_contact_id, secondary_contact_ids } = params;
    
    if (!primary_contact_id || !secondary_contact_ids || secondary_contact_ids.length === 0) {
      throw new Error('primary_contact_id and secondary_contact_ids are required for merge action');
    }

    const response = await this.client.contacts.merge(primary_contact_id, secondary_contact_ids);
    return this.formatResponse({
      message: 'Contacts merged successfully',
      merged_contact: response,
    });
  }
}