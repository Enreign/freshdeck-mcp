import { z } from 'zod';
import { EnhancedBaseTool } from './enhanced-base.js';
import { FreshdeskClient } from '../api/client.js';
import { Permission, AccessLevel } from '../auth/permissions.js';

const AgentsManageSchema = z.object({
  action: z.enum(['list', 'get', 'update', 'current']).describe('Action to perform on agents'),
  params: z.object({
    // Get/update specific
    agent_id: z.number().describe('ID of the agent').optional(),
    
    // List specific
    page: z.number().min(1).describe('Page number (default: 1)').optional(),
    per_page: z.number().min(1).max(100).describe('Items per page (default: 50, max: 100)').optional(),
    email: z.string().email().describe('Filter agents by email').optional(),
    mobile: z.string().describe('Filter agents by mobile number').optional(),
    phone: z.string().describe('Filter agents by phone number').optional(),
    state: z.enum(['fulltime', 'occasional']).describe('Filter by agent type').optional(),
    
    // Update params
    occasional: z.boolean().describe('Set agent as occasional (true) or full-time (false)').optional(),
    signature: z.string().describe('Agent signature in HTML format').optional(),
    ticket_scope: z.number().describe('Ticket permission: 1=Global, 2=Group, 3=Restricted').optional(),
    group_ids: z.array(z.number()).describe('Group IDs the agent belongs to').optional(),
    role_ids: z.array(z.number()).describe('Role IDs assigned to the agent').optional(),
    contact: z.object({
      name: z.string().describe('Agent name').optional(),
      email: z.string().email().describe('Agent email').optional(),
      phone: z.string().describe('Agent phone').optional(),
      mobile: z.string().describe('Agent mobile').optional(),
      job_title: z.string().describe('Agent job title').optional(),
      language: z.string().describe('Language code').optional(),
      time_zone: z.string().describe('Time zone').optional(),
    }).describe('Contact information for the agent').optional(),
  }).describe('Parameters for the action'),
});

export class AgentsEnhancedTool extends EnhancedBaseTool {
  constructor(client: FreshdeskClient) {
    super(
      'agents_manage',
      'Manage Freshdesk agents - list, get, update agent information and get current agent details',
      AgentsManageSchema,
      {
        requiredPermissions: [Permission.AGENTS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Agent management capabilities',
      },
      client
    );
  }

  async execute(args: any): Promise<any> {
    try {
      const { action, params } = args;

      switch (action) {
        case 'list':
          return await this.listAgents(params);
        case 'get':
          return await this.getAgent(params);
        case 'update':
          return await this.updateAgent(params);
        case 'current':
          return await this.getCurrentAgent();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async listAgents(params: any): Promise<string> {
    const options = {
      page: params.page,
      per_page: params.per_page,
      email: params.email,
      mobile: params.mobile,
      phone: params.phone,
      state: params.state,
    };

    const response = await this.client.agents.list(options);
    return this.formatResponse({
      message: `Found ${response.length} agents`,
      agents: response,
    });
  }

  private async getAgent(params: any): Promise<string> {
    const { agent_id } = params;
    
    if (!agent_id) {
      throw new Error('agent_id is required for get action');
    }

    const response = await this.client.agents.get(agent_id);
    return this.formatResponse({
      message: 'Agent retrieved successfully',
      agent: response,
    });
  }

  private async updateAgent(params: any): Promise<string> {
    const { agent_id, ...updateData } = params;
    
    if (!agent_id) {
      throw new Error('agent_id is required for update action');
    }

    // Note: Updating agents requires admin permissions
    const response = await this.client.agents.update(agent_id, updateData);
    return this.formatResponse({
      message: 'Agent updated successfully',
      agent: response,
    });
  }

  private async getCurrentAgent(): Promise<string> {
    const response = await this.client.agents.current();
    return this.formatResponse({
      message: 'Current agent retrieved successfully',
      agent: response,
    });
  }
}