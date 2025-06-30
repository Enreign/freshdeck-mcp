import { BaseResource } from './base.js';
import { Agent, AgentUpdateData } from '../../core/types.js';

export class AgentsAPI extends BaseResource {
  async list(options?: {
    page?: number;
    per_page?: number;
    email?: string;
    mobile?: string;
    phone?: string;
    state?: string;
  }): Promise<Agent[]> {
    const queryString = options ? this.buildQueryString(options) : '';
    return this.client.get<Agent[]>(`/agents${queryString}`);
  }

  async get(agentId: number): Promise<Agent> {
    return this.client.get<Agent>(`/agents/${agentId}`);
  }

  async update(agentId: number, data: AgentUpdateData): Promise<Agent> {
    return this.client.put<Agent>(`/agents/${agentId}`, data);
  }

  async current(): Promise<Agent> {
    return this.client.get<Agent>('/agents/me');
  }
}