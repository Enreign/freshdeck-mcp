import { z } from 'zod';
import { BaseTool } from './base.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Agent } from '../core/types.js';

const ListAgentsSchema = z.object({
  page: z.number().min(1).optional().describe('Page number (default: 1)'),
  per_page: z.number().min(1).max(100).optional().describe('Items per page (default: 30, max: 100)'),
  email: z.string().email().optional().describe('Filter by email address'),
  mobile: z.string().optional().describe('Filter by mobile number'),
  phone: z.string().optional().describe('Filter by phone number'),
  state: z.enum(['fulltime', 'occasional']).optional().describe('Filter by agent type'),
});

const GetAgentSchema = z.object({
  agent_id: z.number().describe('ID of the agent to retrieve'),
});

const UpdateAgentSchema = z.object({
  agent_id: z.number().describe('ID of the agent to update'),
  occasional: z.boolean().optional().describe('Set agent as occasional (true) or fulltime (false)'),
  signature: z.string().optional().describe('Agent signature for emails'),
  ticket_scope: z.number().min(1).max(3).optional().describe('Ticket permission: 1=Global, 2=Group, 3=Restricted'),
  group_ids: z.array(z.number()).optional().describe('Group IDs the agent belongs to'),
  role_ids: z.array(z.number()).optional().describe('Role IDs assigned to the agent'),
  skill_ids: z.array(z.number()).optional().describe('Skill IDs assigned to the agent'),
  contact: z.object({
    name: z.string().optional().describe('Agent name'),
    email: z.string().email().optional().describe('Agent email'),
    phone: z.string().optional().describe('Agent phone'),
    mobile: z.string().optional().describe('Agent mobile'),
    job_title: z.string().optional().describe('Agent job title'),
    language: z.string().optional().describe('Preferred language'),
    time_zone: z.string().optional().describe('Time zone'),
  }).optional().describe('Contact information updates'),
});

const GetCurrentAgentSchema = z.object({});

const ListAgentGroupsSchema = z.object({
  agent_id: z.number().describe('ID of the agent'),
});

const ListAgentRolesSchema = z.object({
  agent_id: z.number().describe('ID of the agent'),
});

export class AgentsTool extends BaseTool {
  get definition(): Tool {
    return {
      name: 'agents_manage',
      description: 'Manage Freshdesk agents - list, get, update agents, and view their groups and roles',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'get', 'update', 'get_current', 'list_groups', 'list_roles'],
            description: 'Action to perform on agents',
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
        case 'list':
          return await this.listAgents(params);
        case 'get':
          return await this.getAgent(params);
        case 'update':
          return await this.updateAgent(params);
        case 'get_current':
          return await this.getCurrentAgent(params);
        case 'list_groups':
          return await this.listAgentGroups(params);
        case 'list_roles':
          return await this.listAgentRoles(params);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async listAgents(params: any): Promise<string> {
    const validated = ListAgentsSchema.parse(params);
    
    const queryParams: any = {
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    };

    if (validated.email) queryParams.email = validated.email;
    if (validated.mobile) queryParams.mobile = validated.mobile;
    if (validated.phone) queryParams.phone = validated.phone;
    if (validated.state) queryParams.state = validated.state;

    const agents = await this.client.get<Agent[]>('/agents', { params: queryParams });
    return this.formatResponse({
      success: true,
      agents,
      count: agents.length,
      page: queryParams.page,
      per_page: queryParams.per_page,
    });
  }

  private async getAgent(params: any): Promise<string> {
    const validated = GetAgentSchema.parse(params);
    
    const agent = await this.client.get<Agent>(`/agents/${validated.agent_id}`);
    return this.formatResponse({
      success: true,
      agent,
    });
  }

  private async updateAgent(params: any): Promise<string> {
    const validated = UpdateAgentSchema.parse(params);
    const { agent_id, ...updateData } = validated;

    const agent = await this.client.put<Agent>(`/agents/${agent_id}`, updateData);
    return this.formatResponse({
      success: true,
      agent,
      message: `Agent ID ${agent_id} updated successfully`,
    });
  }

  private async getCurrentAgent(params: any): Promise<string> {
    GetCurrentAgentSchema.parse(params);
    
    const agent = await this.client.get<Agent>('/agents/me');
    return this.formatResponse({
      success: true,
      agent,
      message: 'Current authenticated agent retrieved',
    });
  }

  private async listAgentGroups(params: any): Promise<string> {
    const validated = ListAgentGroupsSchema.parse(params);
    
    const groups = await this.client.get<any[]>(`/agents/${validated.agent_id}/groups`);
    return this.formatResponse({
      success: true,
      agent_id: validated.agent_id,
      groups,
      count: groups.length,
    });
  }

  private async listAgentRoles(params: any): Promise<string> {
    const validated = ListAgentRolesSchema.parse(params);
    
    const roles = await this.client.get<any[]>(`/agents/${validated.agent_id}/roles`);
    return this.formatResponse({
      success: true,
      agent_id: validated.agent_id,
      roles,
      count: roles.length,
    });
  }
}