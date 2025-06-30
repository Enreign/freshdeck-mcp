import { z } from 'zod';
import { EnhancedBaseTool } from './enhanced-base.js';
import { FreshdeskClient } from '../api/client.js';
import { AccessLevel } from '../auth/permissions.js';

const DiscoverySchema = z.object({
  action: z.enum(['list_tools', 'get_permissions', 'get_capabilities']).describe('Discovery action to perform'),
  params: z.object({
    tool_name: z.string().describe('Name of the tool to get details for').optional(),
  }).describe('Parameters for the action'),
});

export class DiscoveryTool extends EnhancedBaseTool {
  private toolRegistry: any;
  private userPermissions: any;

  constructor(client: FreshdeskClient, toolRegistry: any, userPermissions: any) {
    super(
      'discovery',
      'Discover available tools, permissions, and capabilities in the Freshdesk MCP server',
      DiscoverySchema,
      {
        requiredPermissions: [],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Tool discovery and capability information',
      },
      client
    );
    this.toolRegistry = toolRegistry;
    this.userPermissions = userPermissions;
  }

  async execute(args: any): Promise<any> {
    try {
      const { action } = args;

      switch (action) {
        case 'list_tools':
          return await this.listAvailableTools();
        case 'get_permissions':
          return await this.getCurrentPermissions();
        case 'get_capabilities':
          return await this.getCapabilities();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async listAvailableTools(): Promise<string> {
    const allTools = this.toolRegistry.getAllTools();
    const toolInfo = allTools.map((tool: any) => {
      const isAvailable = this.userPermissions ? tool.isAvailableForUser(this.userPermissions) : true;
      const missingPermissions = this.userPermissions && !isAvailable 
        ? tool.getMissingPermissions(this.userPermissions) 
        : [];

      return {
        name: tool.name,
        description: tool.description,
        available: isAvailable,
        requiredAccessLevel: tool.permissionMetadata.minimumAccessLevel,
        requiredPermissions: tool.permissionMetadata.requiredPermissions,
        missingPermissions: missingPermissions,
      };
    });

    const availableCount = toolInfo.filter((t: any) => t.available).length;
    const totalCount = toolInfo.length;

    return this.formatResponse({
      message: `${availableCount} of ${totalCount} tools are available with current permissions`,
      tools: toolInfo,
    });
  }

  private async getCurrentPermissions(): Promise<string> {
    if (!this.userPermissions) {
      return this.formatResponse({
        message: 'Permission discovery was not performed',
        permissions: null,
      });
    }

    return this.formatResponse({
      message: 'Current user permissions',
      permissions: {
        accessLevel: this.userPermissions.accessLevel,
        isReadOnly: this.userPermissions.isReadOnly,
        canWrite: this.userPermissions.canWrite,
        canDelete: this.userPermissions.canDelete,
        isAdmin: this.userPermissions.isAdmin,
        permissions: Array.from(this.userPermissions.permissions),
        capabilities: this.userPermissions.capabilities,
      },
    });
  }

  private async getCapabilities(): Promise<string> {
    if (!this.userPermissions) {
      return this.formatResponse({
        message: 'Permission discovery was not performed',
        capabilities: null,
      });
    }

    const capabilities = this.userPermissions.capabilities;
    const summary = {
      tickets: {
        available: capabilities.tickets.read || capabilities.tickets.write,
        operations: this.getAvailableOperations(capabilities.tickets),
      },
      contacts: {
        available: capabilities.contacts.read || capabilities.contacts.write,
        operations: this.getAvailableOperations(capabilities.contacts),
      },
      agents: {
        available: capabilities.agents.read || capabilities.agents.write,
        operations: this.getAvailableOperations(capabilities.agents),
      },
      companies: {
        available: capabilities.companies.read || capabilities.companies.write,
        operations: this.getAvailableOperations(capabilities.companies),
      },
      conversations: {
        available: capabilities.conversations.read || capabilities.conversations.write,
        operations: this.getAvailableOperations(capabilities.conversations),
      },
      search: {
        available: capabilities.search.enabled,
      },
      export: {
        available: capabilities.export.data,
      },
    };

    return this.formatResponse({
      message: 'Available capabilities based on current permissions',
      capabilities: summary,
      detailed: capabilities,
    });
  }

  private getAvailableOperations(capability: any): string[] {
    const operations = [];
    if (capability.read) operations.push('read', 'list', 'search');
    if (capability.write) operations.push('create', 'update');
    if (capability.delete) operations.push('delete');
    if (capability.admin) operations.push('admin');
    return operations;
  }
}