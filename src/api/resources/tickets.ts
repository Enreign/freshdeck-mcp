import { BaseResource } from './base.js';
import { Ticket, TicketCreateData, TicketUpdateData } from '../../core/types.js';

export class TicketsAPI extends BaseResource {
  async create(data: TicketCreateData): Promise<Ticket> {
    return this.client.post<Ticket>('/tickets', data);
  }

  async update(ticketId: number, data: TicketUpdateData): Promise<Ticket> {
    return this.client.put<Ticket>(`/tickets/${ticketId}`, data);
  }

  async get(ticketId: number, options?: { include?: string }): Promise<Ticket> {
    const queryString = options ? this.buildQueryString(options) : '';
    return this.client.get<Ticket>(`/tickets/${ticketId}${queryString}`);
  }

  async list(options?: {
    page?: number;
    per_page?: number;
    filter?: string;
    requester_id?: number;
    responder_id?: number;
    company_id?: number;
    updated_since?: string;
    include?: string;
  }): Promise<Ticket[]> {
    const queryString = options ? this.buildQueryString(options) : '';
    return this.client.get<Ticket[]>(`/tickets${queryString}`);
  }

  async delete(ticketId: number): Promise<void> {
    return this.client.delete<void>(`/tickets/${ticketId}`);
  }

  async search(query: string, options?: {
    page?: number;
    per_page?: number;
  }): Promise<{ results: Ticket[]; total: number }> {
    const params = { query, ...options };
    const queryString = this.buildQueryString(params);
    return this.client.get<{ results: Ticket[]; total: number }>(`/search/tickets${queryString}`);
  }
}