import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FreshdeskClient } from '../api/client.js';
import { z } from 'zod';
import { createLogger } from '../utils/logger.js';
import { Permission, AccessLevel, UserPermissions, ToolPermissionMetadata } from '../auth/permissions.js';

export abstract class EnhancedBaseTool {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: any;
  public readonly permissionMetadata: ToolPermissionMetadata;
  
  protected client: FreshdeskClient;
  protected logger;

  constructor(
    name: string,
    description: string,
    parameters: z.ZodType<any>,
    permissionMetadata: ToolPermissionMetadata,
    client: FreshdeskClient
  ) {
    this.name = name;
    this.description = description;
    this.parameters = this.zodToJsonSchema(parameters);
    this.permissionMetadata = permissionMetadata;
    this.client = client;
    this.logger = createLogger(`tool-${name}`);
  }

  abstract execute(args: any): Promise<any>;

  /**
   * Check if this tool is available for the given user permissions
   */
  isAvailableForUser(userPermissions: UserPermissions): boolean {
    // Check minimum access level
    const accessLevelOrder = {
      [AccessLevel.READ]: 0,
      [AccessLevel.WRITE]: 1,
      [AccessLevel.DELETE]: 2,
      [AccessLevel.ADMIN]: 3,
    };

    const userAccessLevel = accessLevelOrder[userPermissions.accessLevel];
    const requiredAccessLevel = accessLevelOrder[this.permissionMetadata.minimumAccessLevel];

    if (userAccessLevel < requiredAccessLevel) {
      return false;
    }

    // Check specific permissions
    for (const requiredPermission of this.permissionMetadata.requiredPermissions) {
      if (!userPermissions.permissions.has(requiredPermission)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a list of missing permissions for this tool
   */
  getMissingPermissions(userPermissions: UserPermissions): Permission[] {
    const missing: Permission[] = [];

    for (const requiredPermission of this.permissionMetadata.requiredPermissions) {
      if (!userPermissions.permissions.has(requiredPermission)) {
        missing.push(requiredPermission);
      }
    }

    return missing;
  }

  /**
   * Get the MCP tool definition
   */
  get definition(): Tool {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        ...this.parameters,
      },
    };
  }

  protected formatResponse(data: any): string {
    if (data === undefined) {
      return 'undefined';
    }
    return JSON.stringify(data, null, 2);
  }

  protected handleError(error: any): string {
    this.logger.error(`Error in ${this.name}:`, error);
    
    if (error && error.message) {
      return JSON.stringify({
        error: true,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      });
    }
    return JSON.stringify({
      error: true,
      message: 'An unknown error occurred',
    });
  }

  private zodToJsonSchema(schema: z.ZodType<any>): Record<string, any> {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJsonSchema(value as z.ZodType<any>);
        
        // Check if field is required
        if (!(value as any).isOptional()) {
          required.push(key);
        }
      }

      const result: Record<string, any> = { properties };
      if (required.length > 0) {
        result['required'] = required;
      }
      return result;
    }

    return {};
  }

  private zodTypeToJsonSchema(schema: z.ZodType<any>): any {
    // Handle descriptions
    const description = (schema as any)._def?.description;
    let result: any = {};

    if (schema instanceof z.ZodString) {
      result = { type: 'string' };
      if ((schema as any)._def?.checks) {
        const checks = (schema as any)._def.checks;
        const emailCheck = checks.find((c: any) => c.kind === 'email');
        if (emailCheck) {
          result.format = 'email';
        }
      }
    } else if (schema instanceof z.ZodNumber) {
      result = { type: 'number' };
      if ((schema as any)._def?.checks) {
        const checks = (schema as any)._def.checks;
        const minCheck = checks.find((c: any) => c.kind === 'min');
        const maxCheck = checks.find((c: any) => c.kind === 'max');
        if (minCheck) result.minimum = minCheck.value;
        if (maxCheck) result.maximum = maxCheck.value;
      }
    } else if (schema instanceof z.ZodBoolean) {
      result = { type: 'boolean' };
    } else if (schema instanceof z.ZodArray) {
      result = { 
        type: 'array',
        items: this.zodTypeToJsonSchema(schema.element),
      };
    } else if (schema instanceof z.ZodObject) {
      const objectSchema = this.zodToJsonSchema(schema);
      result = {
        type: 'object',
        ...objectSchema,
      };
    } else if (schema instanceof z.ZodOptional) {
      result = this.zodTypeToJsonSchema(schema.unwrap());
    } else if (schema instanceof z.ZodEnum) {
      result = {
        type: 'string',
        enum: schema.options,
      };
    } else if (schema instanceof z.ZodRecord) {
      result = {
        type: 'object',
        additionalProperties: true,
      };
    } else {
      result = { type: 'string' };
    }

    if (description) {
      result.description = description;
    }

    return result;
  }
}