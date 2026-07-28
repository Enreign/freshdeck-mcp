import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FreshdeskClient } from '../api/client.js';
import { z } from 'zod';

export abstract class BaseTool {
  protected client: FreshdeskClient;
  
  constructor(client: FreshdeskClient) {
    this.client = client;
  }

  abstract get definition(): Tool;
  abstract execute(args: any): Promise<any>;

  protected createTool(
    name: string,
    description: string,
    inputSchema: z.ZodType<any>
  ): Tool {
    const schema = this.zodToJsonSchema(inputSchema);
    return {
      name,
      description,
      inputSchema: {
        type: 'object',
        ...schema,
      },
    };
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
    if (schema instanceof z.ZodString) {
      return { type: 'string' };
    } else if (schema instanceof z.ZodNumber) {
      return { type: 'number' };
    } else if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    } else if (schema instanceof z.ZodArray) {
      return { 
        type: 'array',
        items: this.zodTypeToJsonSchema(schema.element),
      };
    } else if (schema instanceof z.ZodObject) {
      const objectSchema = this.zodToJsonSchema(schema);
      return {
        type: 'object',
        ...objectSchema,
      };
    } else if (schema instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(schema.unwrap());
    } else if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema.options,
      };
    }
    
    return { type: 'string' };
  }

  protected formatResponse(data: any): string {
    if (data === undefined) {
      return 'undefined';
    }
    return JSON.stringify(data, null, 2);
  }

  protected handleError(error: any): string {
    if (error && error.message) {
      const result: Record<string, unknown> = {
        error: true,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      };

      if (Array.isArray(error.errors) && error.errors.length > 0) {
        result['errors'] = error.errors.map((e: any) => {
          if (e && typeof e === 'object') {
            const clean: Record<string, unknown> = {};
            if (e.field !== undefined) clean['field'] = e.field;
            if (e.message !== undefined) clean['message'] = e.message;
            if (e.code !== undefined) clean['code'] = e.code;
            return clean;
          }
          return e;
        });
      }

      if (error.field !== undefined && error.field !== null && error.field !== '') {
        result['field'] = error.field;
      }

      if (error.statusCode !== undefined) {
        result['statusCode'] = error.statusCode;
      }

      return JSON.stringify(result);
    }
    return JSON.stringify({
      error: true,
      message: 'An unknown error occurred',
    });
  }
}