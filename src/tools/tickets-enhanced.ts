import { z } from 'zod';
import { EnhancedBaseTool } from './enhanced-base.js';
import { FreshdeskClient } from '../api/client.js';
import { Permission, AccessLevel } from '../auth/permissions.js';

const TicketsManageSchema = z.object({
  action: z.enum(['create', 'update', 'list', 'get', 'delete', 'search']).describe('Action to perform on tickets'),
  params: z.object({
    // Create ticket params
    subject: z.string().describe('Subject of the ticket').optional(),
    description: z.string().describe('HTML content of the ticket').optional(),
    email: z.string().email().describe('Email address of the requester').optional(),
    priority: z.number().min(1).max(4).describe('Priority: 1=Low, 2=Medium, 3=High, 4=Urgent').optional(),
    status: z.number().min(2).max(7).describe('Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed, 6=Waiting on Customer, 7=Waiting on Third Party').optional(),
    source: z.number().min(1).max(10).describe('Source: 1=Email, 2=Portal, 3=Phone, 7=Chat, 8=Mobihelp, 9=Feedback Widget, 10=Outbound Email').optional(),
    tags: z.array(z.string()).describe('Tags for the ticket').optional(),
    cc_emails: z.array(z.string().email()).describe('Email addresses to CC').optional(),
    custom_fields: z.record(z.any()).describe('Custom fields as key-value pairs').optional(),
    group_id: z.number().describe('Group ID to assign the ticket').optional(),
    responder_id: z.number().describe('Agent ID to assign the ticket').optional(),
    type: z.string().describe('Ticket type').optional(),
    product_id: z.number().describe('Product ID associated with the ticket').optional(),
    
    // Update/get/delete specific
    ticket_id: z.number().describe('ID of the ticket').optional(),
    
    // List specific
    page: z.number().min(1).describe('Page number (default: 1)').optional(),
    per_page: z.number().min(1).max(100).describe('Items per page (default: 30, max: 100)').optional(),
    filter: z.string().describe('Predefined filter like "new_and_my_open", "watching", "spam", "deleted"').optional(),
    requester_id: z.number().describe('Filter by requester ID').optional(),
    company_id: z.number().describe('Filter by company ID').optional(),
    updated_since: z.string().describe('ISO 8601 datetime to filter tickets updated after this time').optional(),
    include: z.array(z.string()).describe('Include related data: "description", "requester", "stats", "company", "conversations"').optional(),
    
    // Search specific
    query: z.string().describe('Search query string (e.g., "status:2 priority:1")').optional(),
  }).describe('Parameters for the action'),
});

export class TicketsEnhancedTool extends EnhancedBaseTool {
  constructor(client: FreshdeskClient) {
    super(
      'tickets_manage',
      'Manage Freshdesk tickets - create, update, list, get, delete, and search tickets',
      TicketsManageSchema,
      {
        requiredPermissions: [Permission.TICKETS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Basic ticket management capabilities',
      },
      client
    );
  }

  async execute(args: any): Promise<any> {
    try {
      const { action, params } = args;

      // Check additional permissions for write operations
      if (['create', 'update', 'delete'].includes(action)) {
        // This would normally check against actual user permissions
        // For now, we'll proceed with the operation
      }

      switch (action) {
        case 'create':
          return await this.createTicket(params);
        case 'update':
          return await this.updateTicket(params);
        case 'list':
          return await this.listTickets(params);
        case 'get':
          return await this.getTicket(params);
        case 'delete':
          return await this.deleteTicket(params);
        case 'search':
          return await this.searchTickets(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async createTicket(params: any): Promise<string> {
    const ticketData = {
      subject: params.subject,
      description: params.description,
      email: params.email,
      priority: params.priority,
      status: params.status,
      source: params.source,
      tags: params.tags,
      cc_emails: params.cc_emails,
      custom_fields: params.custom_fields,
      group_id: params.group_id,
      responder_id: params.responder_id,
      type: params.type,
      product_id: params.product_id,
    };

    const response = await this.client.tickets.create(ticketData);
    return this.formatResponse({
      message: 'Ticket created successfully',
      ticket: response,
    });
  }

  private async updateTicket(params: any): Promise<string> {
    const { ticket_id, ...updateData } = params;
    
    if (!ticket_id) {
      throw new Error('ticket_id is required for update action');
    }

    const response = await this.client.tickets.update(ticket_id, updateData);
    return this.formatResponse({
      message: 'Ticket updated successfully',
      ticket: response,
    });
  }

  private async listTickets(params: any): Promise<string> {
    const options = {
      page: params.page,
      per_page: params.per_page,
      filter: params.filter,
      requester_id: params.requester_id,
      responder_id: params.responder_id,
      company_id: params.company_id,
      updated_since: params.updated_since,
      include: params.include?.join(','),
    };

    const response = await this.client.tickets.list(options);
    return this.formatResponse({
      message: `Found ${response.length} tickets`,
      tickets: response,
    });
  }

  private async getTicket(params: any): Promise<string> {
    const { ticket_id, include } = params;
    
    if (!ticket_id) {
      throw new Error('ticket_id is required for get action');
    }

    const options = include ? { include: include.join(',') } : undefined;
    const response = await this.client.tickets.get(ticket_id, options);
    
    return this.formatResponse({
      message: 'Ticket retrieved successfully',
      ticket: response,
    });
  }

  private async deleteTicket(params: any): Promise<string> {
    const { ticket_id } = params;
    
    if (!ticket_id) {
      throw new Error('ticket_id is required for delete action');
    }

    await this.client.tickets.delete(ticket_id);
    return this.formatResponse({
      message: 'Ticket deleted successfully',
      ticket_id,
    });
  }

  private async searchTickets(params: any): Promise<string> {
    const { query, page, per_page } = params;
    
    if (!query) {
      throw new Error('query is required for search action');
    }

    const options = {
      page,
      per_page,
    };

    const response = await this.client.tickets.search(query, options);
    return this.formatResponse({
      message: `Found ${response.results?.length || 0} tickets matching query`,
      search_results: response,
    });
  }
}