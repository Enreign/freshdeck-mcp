import { BaseResource } from './base.js';
import { Conversation, ConversationReplyData, ConversationNoteData, ConversationUpdateData } from '../../core/types.js';

export class ConversationsAPI extends BaseResource {
  async list(ticketId: number, options?: {
    page?: number;
    per_page?: number;
  }): Promise<Conversation[]> {
    const queryString = options ? this.buildQueryString(options) : '';
    return this.client.get<Conversation[]>(`/tickets/${ticketId}/conversations${queryString}`);
  }

  async createReply(ticketId: number, data: ConversationReplyData): Promise<Conversation> {
    return this.client.post<Conversation>(`/tickets/${ticketId}/reply`, data);
  }

  async createNote(ticketId: number, data: ConversationNoteData): Promise<Conversation> {
    return this.client.post<Conversation>(`/tickets/${ticketId}/notes`, data);
  }

  async update(ticketId: number, conversationId: number, data: ConversationUpdateData): Promise<Conversation> {
    return this.client.put<Conversation>(`/tickets/${ticketId}/conversations/${conversationId}`, data);
  }

  async delete(ticketId: number, conversationId: number): Promise<void> {
    return this.client.delete<void>(`/tickets/${ticketId}/conversations/${conversationId}`);
  }
}