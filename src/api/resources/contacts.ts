import { BaseResource } from './base.js';
import { Contact, ContactCreateData, ContactUpdateData } from '../../core/types.js';

export class ContactsAPI extends BaseResource {
  async create(data: ContactCreateData): Promise<Contact> {
    return this.client.post<Contact>('/contacts', data);
  }

  async update(contactId: number, data: ContactUpdateData): Promise<Contact> {
    return this.client.put<Contact>(`/contacts/${contactId}`, data);
  }

  async get(contactId: number): Promise<Contact> {
    return this.client.get<Contact>(`/contacts/${contactId}`);
  }

  async list(options?: {
    page?: number;
    per_page?: number;
    email?: string;
    mobile?: string;
    phone?: string;
    updated_since?: string;
    state?: string;
  }): Promise<Contact[]> {
    const queryString = options ? this.buildQueryString(options) : '';
    return this.client.get<Contact[]>(`/contacts${queryString}`);
  }

  async delete(contactId: number): Promise<void> {
    return this.client.delete<void>(`/contacts/${contactId}`);
  }

  async search(query: string, options?: {
    page?: number;
    per_page?: number;
  }): Promise<{ results: Contact[]; total: number }> {
    const params = { query, ...options };
    const queryString = this.buildQueryString(params);
    return this.client.get<{ results: Contact[]; total: number }>(`/search/contacts${queryString}`);
  }

  async merge(primaryContactId: number, secondaryContactIds: number[]): Promise<Contact> {
    return this.client.post<Contact>(`/contacts/${primaryContactId}/merge`, {
      secondary_contact_ids: secondaryContactIds,
    });
  }
}