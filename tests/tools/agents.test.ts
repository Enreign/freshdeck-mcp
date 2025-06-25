import { AgentsTool } from '../../src/tools/agents.js';
import { FreshdeskClient } from '../../src/api/client.js';
import { Agent } from '../../src/core/types.js';

// Mock the client
jest.mock('../../src/api/client.js');

describe('AgentsTool', () => {
  let mockClient: jest.Mocked<FreshdeskClient>;
  let agentsTool: AgentsTool;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      getRateLimitInfo: jest.fn(),
      testConnection: jest.fn(),
    } as any;

    agentsTool = new AgentsTool(mockClient);
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const definition = agentsTool.definition;

      expect(definition.name).toBe('agents_manage');
      expect(definition.description).toContain('Manage Freshdesk agents');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('action');
      expect(definition.inputSchema.properties).toHaveProperty('params');
      expect((definition.inputSchema as any).required).toEqual(['action', 'params']);
    });

    it('should have correct action enum values', () => {
      const definition = agentsTool.definition;
      const actionProperty = definition.inputSchema.properties?.['action'];

      expect((actionProperty as any).enum).toContain('list');
      expect((actionProperty as any).enum).toContain('get');
      expect((actionProperty as any).enum).toContain('update');
      expect((actionProperty as any).enum).toContain('get_current');
      expect((actionProperty as any).enum).toContain('list_groups');
      expect((actionProperty as any).enum).toContain('list_roles');
    });
  });

  describe('execute', () => {
    it('should route to correct method based on action', async () => {
      const listSpy = jest.spyOn(agentsTool as any, 'listAgents').mockResolvedValue('list result');
      const getSpy = jest.spyOn(agentsTool as any, 'getAgent').mockResolvedValue('get result');
      const updateSpy = jest.spyOn(agentsTool as any, 'updateAgent').mockResolvedValue('update result');
      const getCurrentSpy = jest.spyOn(agentsTool as any, 'getCurrentAgent').mockResolvedValue('me result');
      const getGroupsSpy = jest.spyOn(agentsTool as any, 'listAgentGroups').mockResolvedValue('groups result');
      const getRolesSpy = jest.spyOn(agentsTool as any, 'listAgentRoles').mockResolvedValue('roles result');

      await expect(agentsTool.execute({ action: 'list', params: {} })).resolves.toBe('list result');
      await expect(agentsTool.execute({ action: 'get', params: {} })).resolves.toBe('get result');
      await expect(agentsTool.execute({ action: 'update', params: {} })).resolves.toBe('update result');
      await expect(agentsTool.execute({ action: 'get_current', params: {} })).resolves.toBe('me result');
      await expect(agentsTool.execute({ action: 'list_groups', params: {} })).resolves.toBe('groups result');
      await expect(agentsTool.execute({ action: 'list_roles', params: {} })).resolves.toBe('roles result');

      expect(listSpy).toHaveBeenCalledWith({});
      expect(getSpy).toHaveBeenCalledWith({});
      expect(updateSpy).toHaveBeenCalledWith({});
      expect(getCurrentSpy).toHaveBeenCalledWith({});
      expect(getGroupsSpy).toHaveBeenCalledWith({});
      expect(getRolesSpy).toHaveBeenCalledWith({});
    });

    it('should handle unknown action', async () => {
      const result = await agentsTool.execute({ action: 'unknown', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toContain('Unknown action: unknown');
    });

    it('should handle errors in action methods', async () => {
      jest.spyOn(agentsTool as any, 'listAgents').mockRejectedValue(new Error('List failed'));

      const result = await agentsTool.execute({ action: 'list', params: {} });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('List failed');
    });
  });

  describe('listAgents', () => {
    const mockAgents: Agent[] = [
      { id: 1, contact: { name: 'Agent 1', email: 'agent1@example.com' } } as Agent,
      { id: 2, contact: { name: 'Agent 2', email: 'agent2@example.com' } } as Agent,
    ];

    it('should list agents with default parameters', async () => {
      mockClient.get.mockResolvedValue(mockAgents);

      const result = await agentsTool['listAgents']({});
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/agents', {
        params: {
          page: 1,
          per_page: 30,
        },
      });

      expect(parsed.success).toBe(true);
      expect(parsed.agents).toEqual(mockAgents);
      expect(parsed.count).toBe(2);
    });

    it('should list agents with filters', async () => {
      mockClient.get.mockResolvedValue(mockAgents);

      const params = {
        page: 2,
        per_page: 50,
        email: 'specific@example.com',
        mobile: '+1-555-0123',
        phone: '+1-555-0124',
        state: 'fulltime' as const,
      };

      await agentsTool['listAgents'](params);

      expect(mockClient.get).toHaveBeenCalledWith('/agents', {
        params: {
          page: 2,
          per_page: 50,
          email: 'specific@example.com',
          mobile: '+1-555-0123',
          phone: '+1-555-0124',
          state: 'fulltime',
        },
      });
    });

    it('should validate state enum values', async () => {
      const invalidParams = {
        state: 'invalid_state',
      };

      await expect(agentsTool['listAgents'](invalidParams)).rejects.toThrow();
    });

    it('should validate pagination limits', async () => {
      const invalidParams = {
        per_page: 150, // Over limit
      };

      await expect(agentsTool['listAgents'](invalidParams)).rejects.toThrow();
    });
  });

  describe('getAgent', () => {
    const mockAgent: Agent = {
      id: 123,
      contact: {
        name: 'Test Agent',
        email: 'agent@example.com',
      },
      occasional: false,
      signature: 'Best regards,\\nTest Agent',
    } as Agent;

    it('should get agent by id', async () => {
      mockClient.get.mockResolvedValue(mockAgent);

      const params = {
        agent_id: 123,
      };

      const result = await agentsTool['getAgent'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/agents/123');

      expect(parsed.success).toBe(true);
      expect(parsed.agent).toEqual(mockAgent);
    });

    it('should validate required agent_id', async () => {
      const invalidParams = {};

      await expect(agentsTool['getAgent'](invalidParams)).rejects.toThrow();
    });
  });

  describe('updateAgent', () => {
    const mockAgent: Agent = {
      id: 123,
      contact: {
        name: 'Updated Agent',
        email: 'updated@example.com',
      },
      occasional: true,
    } as Agent;

    it('should update agent with basic fields', async () => {
      mockClient.put.mockResolvedValue(mockAgent);

      const params = {
        agent_id: 123,
        occasional: true,
        signature: 'New signature',
        ticket_scope: 2,
      };

      const result = await agentsTool['updateAgent'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.put).toHaveBeenCalledWith('/agents/123', {
        occasional: true,
        signature: 'New signature',
        ticket_scope: 2,
      });

      expect(parsed.success).toBe(true);
      expect(parsed.agent).toEqual(mockAgent);
      expect(parsed.message).toBe('Agent ID 123 updated successfully');
    });

    it('should update agent with arrays', async () => {
      mockClient.put.mockResolvedValue(mockAgent);

      const params = {
        agent_id: 456,
        group_ids: [1, 2, 3],
        role_ids: [10, 20],
        skill_ids: [100, 200, 300],
      };

      await agentsTool['updateAgent'](params);

      expect(mockClient.put).toHaveBeenCalledWith('/agents/456', {
        group_ids: [1, 2, 3],
        role_ids: [10, 20],
        skill_ids: [100, 200, 300],
      });
    });

    it('should update agent with contact information', async () => {
      mockClient.put.mockResolvedValue(mockAgent);

      const params = {
        agent_id: 789,
        contact: {
          name: 'New Name',
          email: 'new.email@example.com',
          phone: '+1-555-0123',
          mobile: '+1-555-0124',
          job_title: 'Senior Agent',
          language: 'en',
          time_zone: 'UTC',
        },
      };

      await agentsTool['updateAgent'](params);

      expect(mockClient.put).toHaveBeenCalledWith('/agents/789', {
        contact: {
          name: 'New Name',
          email: 'new.email@example.com',
          phone: '+1-555-0123',
          mobile: '+1-555-0124',
          job_title: 'Senior Agent',
          language: 'en',
          time_zone: 'UTC',
        },
      });
    });

    it('should validate required agent_id', async () => {
      const invalidParams = {
        occasional: true,
        // Missing agent_id
      };

      await expect(agentsTool['updateAgent'](invalidParams)).rejects.toThrow();
    });

    it('should validate ticket_scope range', async () => {
      const invalidParams = {
        agent_id: 123,
        ticket_scope: 5, // Out of range (1-3)
      };

      await expect(agentsTool['updateAgent'](invalidParams)).rejects.toThrow();
    });

    it('should validate contact email format', async () => {
      const invalidParams = {
        agent_id: 123,
        contact: {
          email: 'invalid-email',
        },
      };

      await expect(agentsTool['updateAgent'](invalidParams)).rejects.toThrow();
    });

    it('should validate array types', async () => {
      const invalidParams = {
        agent_id: 123,
        group_ids: ['1', '2'], // Should be numbers
      };

      await expect(agentsTool['updateAgent'](invalidParams)).rejects.toThrow();
    });
  });

  describe('getCurrentAgent', () => {
    const mockCurrentAgent: Agent = {
      id: 999,
      contact: {
        name: 'Current Agent',
        email: 'current@example.com',
      },
    } as Agent;

    it('should get current agent information', async () => {
      mockClient.get.mockResolvedValue(mockCurrentAgent);

      const result = await agentsTool['getCurrentAgent']({});
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/agents/me');

      expect(parsed.success).toBe(true);
      expect(parsed.agent).toEqual(mockCurrentAgent);
    });
  });

  describe('getAgentGroups', () => {
    const mockGroups = [
      { id: 1, name: 'Support Group', description: 'Main support team' },
      { id: 2, name: 'Sales Group', description: 'Sales team' },
    ];

    it('should get agent groups', async () => {
      mockClient.get.mockResolvedValue(mockGroups);

      const params = {
        agent_id: 123,
      };

      const result = await agentsTool['listAgentGroups'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/agents/123/groups');

      expect(parsed.success).toBe(true);
      expect(parsed.groups).toEqual(mockGroups);
      expect(parsed.count).toBe(2);
    });

    it('should validate required agent_id', async () => {
      const invalidParams = {};

      await expect(agentsTool['listAgentGroups'](invalidParams)).rejects.toThrow();
    });
  });

  describe('getAgentRoles', () => {
    const mockRoles = [
      { id: 10, name: 'Admin', description: 'Administrator role' },
      { id: 20, name: 'Agent', description: 'Standard agent role' },
    ];

    it('should get agent roles', async () => {
      mockClient.get.mockResolvedValue(mockRoles);

      const params = {
        agent_id: 123,
      };

      const result = await agentsTool['listAgentRoles'](params);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/agents/123/roles');

      expect(parsed.success).toBe(true);
      expect(parsed.roles).toEqual(mockRoles);
      expect(parsed.count).toBe(2);
    });

    it('should validate required agent_id', async () => {
      const invalidParams = {};

      await expect(agentsTool['listAgentRoles'](invalidParams)).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle validation errors properly', async () => {
      const result = await agentsTool.execute({
        action: 'get',
        params: {}, // Missing required agent_id
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBeDefined();
    });

    it('should handle client errors properly', async () => {
      mockClient.get.mockRejectedValue(new Error('API Error'));

      const result = await agentsTool.execute({
        action: 'list',
        params: {},
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('API Error');
    });

    it('should handle network errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network timeout'));

      const result = await agentsTool.execute({
        action: 'get_current',
        params: {},
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Network timeout');
    });
  });

  describe('edge cases', () => {
    it('should handle empty agent list', async () => {
      mockClient.get.mockResolvedValue([]);

      const result = await agentsTool['listAgents']({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.agents).toEqual([]);
      expect(parsed.count).toBe(0);
    });

    it('should handle null response from client', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await agentsTool['getAgent']({ agent_id: 123 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.agent).toBeNull();
    });

    it('should handle empty groups and roles', async () => {
      mockClient.get.mockResolvedValue([]);

      const groupsResult = await agentsTool['listAgentGroups']({ agent_id: 123 });
      const rolesResult = await agentsTool['listAgentRoles']({ agent_id: 123 });

      const groupsParsed = JSON.parse(groupsResult);
      const rolesParsed = JSON.parse(rolesResult);

      expect(groupsParsed.groups).toEqual([]);
      expect(rolesParsed.roles).toEqual([]);
    });

    it('should handle partial contact updates', async () => {
      mockClient.put.mockResolvedValue({ id: 123 } as Agent);

      const params = {
        agent_id: 123,
        contact: {
          name: 'Only Name Update',
        },
      };

      await agentsTool['updateAgent'](params);

      expect(mockClient.put).toHaveBeenCalledWith('/agents/123', {
        contact: {
          name: 'Only Name Update',
        },
      });
    });

    it('should handle empty arrays in update', async () => {
      mockClient.put.mockResolvedValue({ id: 123 } as Agent);

      const params = {
        agent_id: 123,
        group_ids: [],
        role_ids: [],
        skill_ids: [],
      };

      await agentsTool['updateAgent'](params);

      expect(mockClient.put).toHaveBeenCalledWith('/agents/123', {
        group_ids: [],
        role_ids: [],
        skill_ids: [],
      });
    });
  });

  describe('data transformation', () => {
    it('should preserve agent structure in responses', async () => {
      const complexAgent = {
        id: 123,
        contact: {
          name: 'Complex Agent',
          email: 'complex@example.com',
          phone: '+1-555-0123',
          mobile: '+1-555-0124',
          job_title: 'Senior Support Agent',
          language: 'en',
          time_zone: 'Pacific Time (US & Canada)',
          address: '123 Main St',
        },
        occasional: false,
        signature: 'Best regards,\\nComplex Agent\\nSupport Team',
        ticket_scope: 1,
        group_ids: [1, 2, 3],
        role_ids: [10, 20],
        skill_ids: [100, 200, 300],
        available: true,
        available_since: '2023-01-01T09:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
      };

      mockClient.get.mockResolvedValue(complexAgent);

      const result = await agentsTool['getAgent']({ agent_id: 123 });
      const parsed = JSON.parse(result);

      expect(parsed.agent).toEqual(complexAgent);
    });

    it('should handle special characters in signatures', async () => {
      mockClient.put.mockResolvedValue({ id: 123 } as Agent);

      const params = {
        agent_id: 123,
        signature: 'Best regards,\\n\\nJohn Doe\\n📧 john@example.com\\n📞 +1-555-0123',
      };

      await agentsTool['updateAgent'](params);

      expect(mockClient.put).toHaveBeenCalledWith('/agents/123', {
        signature: 'Best regards,\\n\\nJohn Doe\\n📧 john@example.com\\n📞 +1-555-0123',
      });
    });
  });
});