import { z } from 'zod';
import { EnhancedBaseTool } from './enhanced-base.js';
import { FreshdeskClient } from '../api/client.js';
import { Permission, AccessLevel } from '../auth/permissions.js';

const ConversationsManageSchema = z.object({
  action: z.enum(['list', 'create_reply', 'create_note', 'update', 'delete']).describe('Action to perform on conversations'),
  params: z.object({
    // Common params
    ticket_id: z.number().describe('ID of the ticket').optional(),
    
    // List specific
    page: z.number().min(1).describe('Page number (default: 1)').optional(),
    per_page: z.number().min(1).max(100).describe('Items per page (default: 30, max: 100)').optional(),
    
    // Create reply params
    body: z.string().describe('Content of the reply/note in HTML').optional(),
    from_email: z.string().email().describe('Email address of the sender').optional(),
    to_emails: z.array(z.string().email()).describe('Email addresses of recipients').optional(),
    cc_emails: z.array(z.string().email()).describe('Email addresses to CC').optional(),
    bcc_emails: z.array(z.string().email()).describe('Email addresses to BCC').optional(),
    
    // Create note params
    private: z.boolean().describe('Whether the note is private (default: true)').optional(),
    notify_emails: z.array(z.string().email()).describe('Email addresses to notify about the note').optional(),
    
    // Update specific
    conversation_id: z.number().describe('ID of the conversation to update').optional(),
    
    // Attachment params
    attachments: z.array(z.object({
      name: z.string().describe('File name'),
      content_type: z.string().describe('MIME type'),
      size: z.number().describe('File size in bytes'),
      url: z.string().describe('URL to download the attachment'),
    })).describe('File attachments').optional(),
  }).describe('Parameters for the action'),
});

export class ConversationsEnhancedTool extends EnhancedBaseTool {
  constructor(client: FreshdeskClient) {
    super(
      'conversations_manage',
      'Manage Freshdesk ticket conversations - list conversations, create replies and notes, update, and delete',
      ConversationsManageSchema,
      {
        requiredPermissions: [Permission.CONVERSATIONS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Conversation management capabilities',
      },
      client
    );
  }

  async execute(args: any): Promise<any> {
    try {
      const { action, params } = args;

      switch (action) {
        case 'list':
          return await this.listConversations(params);
        case 'create_reply':
          return await this.createReply(params);
        case 'create_note':
          return await this.createNote(params);
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

  private async listConversations(params: any): Promise<string> {
    const { ticket_id, page, per_page } = params;
    
    if (!ticket_id) {
      throw new Error('ticket_id is required for list action');
    }

    const options = {
      page,
      per_page,
    };

    const response = await this.client.conversations.list(ticket_id, options);
    return this.formatResponse({
      message: `Found ${response.length} conversations for ticket ${ticket_id}`,
      conversations: response,
    });
  }

  private async createReply(params: any): Promise<string> {
    const { ticket_id, body, from_email, to_emails, cc_emails, bcc_emails, attachments } = params;
    
    if (!ticket_id) {
      throw new Error('ticket_id is required for create_reply action');
    }
    
    if (!body) {
      throw new Error('body is required for create_reply action');
    }

    const replyData = {
      body,
      from_email,
      to_emails,
      cc_emails,
      bcc_emails,
      attachments,
    };

    const response = await this.client.conversations.createReply(ticket_id, replyData);
    return this.formatResponse({
      message: 'Reply created successfully',
      conversation: response,
    });
  }

  private async createNote(params: any): Promise<string> {
    const { ticket_id, body, private: isPrivate = true, notify_emails, attachments } = params;
    
    if (!ticket_id) {
      throw new Error('ticket_id is required for create_note action');
    }
    
    if (!body) {
      throw new Error('body is required for create_note action');
    }

    const noteData = {
      body,
      private: isPrivate,
      notify_emails,
      attachments,
    };

    const response = await this.client.conversations.createNote(ticket_id, noteData);
    return this.formatResponse({
      message: 'Note created successfully',
      conversation: response,
    });
  }

  private async updateConversation(params: any): Promise<string> {
    const { ticket_id, conversation_id, body } = params;
    
    if (!ticket_id || !conversation_id) {
      throw new Error('ticket_id and conversation_id are required for update action');
    }
    
    if (!body) {
      throw new Error('body is required for update action');
    }

    const response = await this.client.conversations.update(ticket_id, conversation_id, { body });
    return this.formatResponse({
      message: 'Conversation updated successfully',
      conversation: response,
    });
  }

  private async deleteConversation(params: any): Promise<string> {
    const { ticket_id, conversation_id } = params;
    
    if (!ticket_id || !conversation_id) {
      throw new Error('ticket_id and conversation_id are required for delete action');
    }

    await this.client.conversations.delete(ticket_id, conversation_id);
    return this.formatResponse({
      message: 'Conversation deleted successfully',
      ticket_id,
      conversation_id,
    });
  }
}