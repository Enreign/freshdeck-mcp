import { z } from 'zod';
import { BaseTool } from './base.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Conversation } from '../core/types.js';

const CreateReplySchema = z.object({
  ticket_id: z.number().describe('ID of the ticket to reply to'),
  body: z.string().describe('HTML content of the reply'),
  from_email: z.string().email().optional().describe('From email address (defaults to support email)'),
  to_emails: z.array(z.string().email()).optional().describe('To email addresses'),
  cc_emails: z.array(z.string().email()).optional().describe('CC email addresses'),
  bcc_emails: z.array(z.string().email()).optional().describe('BCC email addresses'),
  user_id: z.number().optional().describe('ID of the user creating the reply (for agents)'),
});

const CreateNoteSchema = z.object({
  ticket_id: z.number().describe('ID of the ticket to add note to'),
  body: z.string().describe('HTML content of the note'),
  private: z.boolean().optional().describe('Whether the note is private (default: true)'),
  notify_emails: z.array(z.string().email()).optional().describe('Email addresses to notify'),
  user_id: z.number().optional().describe('ID of the user creating the note (for agents)'),
});

const ListConversationsSchema = z.object({
  ticket_id: z.number().describe('ID of the ticket to get conversations for'),
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
});

const GetConversationSchema = z.object({
  conversation_id: z.number().describe('ID of the conversation to retrieve'),
});

const UpdateConversationSchema = z.object({
  conversation_id: z.number().describe('ID of the conversation to update'),
  body: z.string().optional().describe('Updated HTML content'),
  private: z.boolean().optional().describe('Update privacy status'),
});

const DeleteConversationSchema = z.object({
  conversation_id: z.number().describe('ID of the conversation to delete'),
});

export class ConversationsTool extends BaseTool {
  get definition(): Tool {
    return {
      name: 'conversations_manage',
      description: 'Manage Freshdesk ticket conversations - create replies and notes, list, get, update, and delete conversations',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create_reply', 'create_note', 'list', 'get', 'update', 'delete'],
            description: 'Action to perform on conversations',
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
        case 'create_reply':
          return await this.createReply(params);
        case 'create_note':
          return await this.createNote(params);
        case 'list':
          return await this.listConversations(params);
        case 'get':
          return await this.getConversation(params);
        case 'update':
          return await this.updateConversation(params);
        case 'delete':
          return await this.deleteConversation(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async createReply(params: any): Promise<string> {
    const validated = CreateReplySchema.parse(params);
    
    const replyData = {
      body: validated.body,
      from_email: validated.from_email,
      to_emails: validated.to_emails,
      cc_emails: validated.cc_emails,
      bcc_emails: validated.bcc_emails,
      user_id: validated.user_id,
    };

    const conversation = await this.client.post<Conversation>(
      `/tickets/${validated.ticket_id}/reply`,
      replyData
    );
    
    return this.formatResponse({
      success: true,
      conversation,
      message: `Reply added to ticket #${validated.ticket_id}`,
    });
  }

  private async createNote(params: any): Promise<string> {
    const validated = CreateNoteSchema.parse(params);
    
    const noteData = {
      body: validated.body,
      private: validated.private !== undefined ? validated.private : true,
      notify_emails: validated.notify_emails,
      user_id: validated.user_id,
    };

    const conversation = await this.client.post<Conversation>(
      `/tickets/${validated.ticket_id}/notes`,
      noteData
    );
    
    return this.formatResponse({
      success: true,
      conversation,
      message: `Note added to ticket #${validated.ticket_id}`,
    });
  }

  private async listConversations(params: any): Promise<string> {
    const validated = ListConversationsSchema.parse(params);
    
    const queryParams = {
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    const conversations = await this.client.get<Conversation[]>(
      `/tickets/${validated.ticket_id}/conversations`,
      { params: queryParams }
    );
    
    return this.formatResponse({
      success: true,
      ticket_id: validated.ticket_id,
      conversations,
      count: conversations.length,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }

  private async getConversation(params: any): Promise<string> {
    const validated = GetConversationSchema.parse(params);
    
    const conversation = await this.client.get<Conversation>(
      `/conversations/${validated.conversation_id}`
    );
    
    return this.formatResponse({
      success: true,
      conversation,
    });
  }

  private async updateConversation(params: any): Promise<string> {
    const validated = UpdateConversationSchema.parse(params);
    const { conversation_id, ...updateData } = validated;

    const conversation = await this.client.put<Conversation>(
      `/conversations/${conversation_id}`,
      updateData
    );
    
    return this.formatResponse({
      success: true,
      conversation,
      message: `Conversation ID ${conversation_id} updated successfully`,
    });
  }

  private async deleteConversation(params: any): Promise<string> {
    const validated = DeleteConversationSchema.parse(params);
    
    await this.client.delete(`/conversations/${validated.conversation_id}`);
    
    return this.formatResponse({
      success: true,
      message: `Conversation ID ${validated.conversation_id} deleted successfully`,
    });
  }
}