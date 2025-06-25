import { z } from 'zod';
import { BaseTool } from './base.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Ticket, Priority, Status, Source } from '../core/types.js';

const CreateTicketSchema = z.object({
  subject: z.string().describe('Subject of the ticket'),
  description: z.string().describe('HTML content of the ticket'),
  email: z.string().email().describe('Email address of the requester'),
  priority: z.number().min(1).max(4).describe('Priority: 1=Low, 2=Medium, 3=High, 4=Urgent'),
  status: z.number().min(2).max(7).describe('Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed, 6=Waiting on Customer, 7=Waiting on Third Party'),
  source: z.number().min(1).max(10).optional().describe('Source: 1=Email, 2=Portal, 3=Phone, 7=Chat, 8=Mobihelp, 9=Feedback Widget, 10=Outbound Email'),
  tags: z.array(z.string()).optional().describe('Tags for the ticket'),
  cc_emails: z.array(z.string().email()).optional().describe('Email addresses to CC'),
  custom_fields: z.record(z.any()).optional().describe('Custom fields as key-value pairs'),
  group_id: z.number().optional().describe('Group ID to assign the ticket'),
  responder_id: z.number().optional().describe('Agent ID to assign the ticket'),
  type: z.string().optional().describe('Ticket type'),
  product_id: z.number().optional().describe('Product ID associated with the ticket'),
});

const UpdateTicketSchema = z.object({
  ticket_id: z.number().describe('ID of the ticket to update'),
  subject: z.string().optional().describe('Subject of the ticket'),
  description: z.string().optional().describe('HTML content of the ticket'),
  priority: z.number().min(1).max(4).optional().describe('Priority: 1=Low, 2=Medium, 3=High, 4=Urgent'),
  status: z.number().min(2).max(7).optional().describe('Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed, 6=Waiting on Customer, 7=Waiting on Third Party'),
  tags: z.array(z.string()).optional().describe('Tags for the ticket'),
  custom_fields: z.record(z.any()).optional().describe('Custom fields as key-value pairs'),
  group_id: z.number().optional().describe('Group ID to assign the ticket'),
  responder_id: z.number().optional().describe('Agent ID to assign the ticket'),
  type: z.string().optional().describe('Ticket type'),
  product_id: z.number().optional().describe('Product ID associated with the ticket'),
});

const ListTicketsSchema = z.object({
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
  filter: z.string().optional().describe('Predefined filter like "new_and_my_open", "watching", "spam", "deleted"'),
  requester_id: z.number().optional().describe('Filter by requester ID'),
  responder_id: z.number().optional().describe('Filter by responder/agent ID'),
  company_id: z.number().optional().describe('Filter by company ID'),
  updated_since: z.string().optional().describe('ISO 8601 datetime to filter tickets updated after this time'),
  include: z.array(z.string()).optional().describe('Include related data: "description", "requester", "stats", "company"'),
});

const GetTicketSchema = z.object({
  ticket_id: z.number().describe('ID of the ticket to retrieve'),
  include: z.array(z.string()).optional().describe('Include related data: "conversations", "requester", "company", "stats"'),
});

const DeleteTicketSchema = z.object({
  ticket_id: z.number().describe('ID of the ticket to delete'),
});

const SearchTicketsSchema = z.object({
  query: z.string().describe('Search query string (e.g., "status:2 priority:1")'),
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
});

export class TicketsTool extends BaseTool {
  get definition(): Tool {
    return {
      name: 'tickets_manage',
      description: 'Manage Freshdesk tickets - create, update, list, get, delete, and search tickets',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'update', 'list', 'get', 'delete', 'search'],
            description: 'Action to perform on tickets',
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
    const validated = CreateTicketSchema.parse(params);
    
    const ticketData = {
      subject: validated.subject,
      description: validated.description,
      email: validated.email,
      priority: validated.priority as Priority,
      status: validated.status as Status,
      source: (validated.source as Source) || 2, // Default to Portal
      tags: validated.tags,
      cc_emails: validated.cc_emails,
      custom_fields: validated.custom_fields,
      group_id: validated.group_id,
      responder_id: validated.responder_id,
      type: validated.type,
      product_id: validated.product_id,
    };

    const ticket = await this.client.post<Ticket>('/tickets', ticketData);
    return this.formatResponse({
      success: true,
      ticket,
      message: `Ticket #${ticket.id} created successfully`,
    });
  }

  private async updateTicket(params: any): Promise<string> {
    const validated = UpdateTicketSchema.parse(params);
    const { ticket_id, ...updateData } = validated;

    const ticket = await this.client.put<Ticket>(`/tickets/${ticket_id}`, updateData);
    return this.formatResponse({
      success: true,
      ticket,
      message: `Ticket #${ticket_id} updated successfully`,
    });
  }

  private async listTickets(params: any): Promise<string> {
    const validated = ListTicketsSchema.parse(params);
    
    const queryParams: any = {
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    if (validated.filter) {
      queryParams.filter = validated.filter;
    }
    if (validated.requester_id) {
      queryParams.requester_id = validated.requester_id;
    }
    if (validated.responder_id) {
      queryParams.responder_id = validated.responder_id;
    }
    if (validated.company_id) {
      queryParams.company_id = validated.company_id;
    }
    if (validated.updated_since) {
      queryParams.updated_since = validated.updated_since;
    }
    if (validated.include) {
      queryParams.include = validated.include.join(',');
    }

    const tickets = await this.client.get<Ticket[]>('/tickets', { params: queryParams });
    return this.formatResponse({
      success: true,
      tickets,
      count: tickets.length,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }

  private async getTicket(params: any): Promise<string> {
    const validated = GetTicketSchema.parse(params);
    
    const queryParams: any = {};
    if (validated.include) {
      queryParams.include = validated.include.join(',');
    }

    const ticket = await this.client.get<Ticket>(`/tickets/${validated.ticket_id}`, { params: queryParams });
    return this.formatResponse({
      success: true,
      ticket,
    });
  }

  private async deleteTicket(params: any): Promise<string> {
    const validated = DeleteTicketSchema.parse(params);
    
    await this.client.delete(`/tickets/${validated.ticket_id}`);
    return this.formatResponse({
      success: true,
      message: `Ticket #${validated.ticket_id} deleted successfully`,
    });
  }

  private async searchTickets(params: any): Promise<string> {
    const validated = SearchTicketsSchema.parse(params);
    
    const queryParams = {
      query: validated.query,
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    const response = await this.client.get<{ results: Ticket[]; total: number }>('/search/tickets', { params: queryParams });
    return this.formatResponse({
      success: true,
      tickets: response.results,
      total: response.total,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }
}