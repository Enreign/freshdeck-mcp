import { z } from 'zod';
import { BaseTool } from '../../src/tools/base.js';
import { FreshdeskClient } from '../../src/api/client.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

// Create a concrete implementation for testing
class TestTool extends BaseTool {
  get definition(): Tool {
    return this.createTool(
      'test_tool',
      'A test tool for unit testing',
      z.object({
        name: z.string(),
        age: z.number().optional(),
        active: z.boolean(),
        tags: z.array(z.string()),
        status: z.enum(['active', 'inactive']),
        nested: z.object({
          value: z.string(),
          count: z.number(),
        }).optional(),
      })
    );
  }

  async execute(args: any): Promise<any> {
    return { result: 'success', args };
  }
}

describe('BaseTool', () => {
  let mockClient: jest.Mocked<FreshdeskClient>;
  let testTool: TestTool;

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

    testTool = new TestTool(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with client', () => {
      expect(testTool['client']).toBe(mockClient);
    });
  });

  describe('createTool', () => {
    it('should create tool definition with correct structure', () => {
      const definition = testTool.definition;

      expect(definition.name).toBe('test_tool');
      expect(definition.description).toBe('A test tool for unit testing');
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.type).toBe('object');
    });

    it('should generate correct JSON schema for properties', () => {
      const definition = testTool.definition;
      const properties = definition.inputSchema.properties;

      expect(properties?.['name']).toEqual({ type: 'string' });
      expect(properties?.['age']).toEqual({ type: 'number' });
      expect(properties?.['active']).toEqual({ type: 'boolean' });
      expect(properties?.['tags']).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
      expect(properties?.['status']).toEqual({
        type: 'string',
        enum: ['active', 'inactive'],
      });
    });

    it('should handle nested objects correctly', () => {
      const definition = testTool.definition;
      const properties = definition.inputSchema.properties;

      expect(properties?.['nested']).toEqual({
        type: 'object',
        properties: {
          value: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['value', 'count'],
      });
    });

    it('should identify required fields correctly', () => {
      const definition = testTool.definition;
      const required = (definition.inputSchema as any).required;

      expect(required).toContain('name');
      expect(required).toContain('active');
      expect(required).toContain('tags');
      expect(required).toContain('status');
      expect(required).not.toContain('age');
      expect(required).not.toContain('nested');
    });
  });

  describe('zodToJsonSchema', () => {
    it('should handle empty objects', () => {
      class EmptyTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('empty', 'Empty tool', z.object({}));
        }
        async execute(): Promise<any> { return {}; }
      }

      const emptyTool = new EmptyTool(mockClient);
      const definition = emptyTool.definition;

      expect(definition.inputSchema.properties).toEqual({});
    });

    it('should handle complex nested schemas', () => {
      const complexSchema = z.object({
        user: z.object({
          profile: z.object({
            settings: z.object({
              theme: z.enum(['light', 'dark']),
              notifications: z.array(z.string()),
            }),
          }),
        }),
      });

      class ComplexTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('complex', 'Complex tool', complexSchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const complexTool = new ComplexTool(mockClient);
      const definition = complexTool.definition;

      expect(definition.inputSchema.properties?.['user']).toEqual({
        type: 'object',
        properties: {
          profile: {
            type: 'object',
            properties: {
              settings: {
                type: 'object',
                properties: {
                  theme: {
                    type: 'string',
                    enum: ['light', 'dark'],
                  },
                  notifications: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['theme', 'notifications'],
              },
            },
            required: ['settings'],
          },
        },
        required: ['profile'],
      });
    });
  });

  describe('zodTypeToJsonSchema', () => {
    it('should handle all primitive types', () => {
      const primitiveSchema = z.object({
        str: z.string(),
        num: z.number(),
        bool: z.boolean(),
      });

      class PrimitiveTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('primitive', 'Primitive tool', primitiveSchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const primitiveTool = new PrimitiveTool(mockClient);
      const definition = primitiveTool.definition;

      expect(definition.inputSchema.properties?.['str']).toEqual({ type: 'string' });
      expect(definition.inputSchema.properties?.['num']).toEqual({ type: 'number' });
      expect(definition.inputSchema.properties?.['bool']).toEqual({ type: 'boolean' });
    });

    it('should handle arrays with different element types', () => {
      const arraySchema = z.object({
        strings: z.array(z.string()),
        numbers: z.array(z.number()),
        objects: z.array(z.object({ id: z.number() })),
      });

      class ArrayTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('array', 'Array tool', arraySchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const arrayTool = new ArrayTool(mockClient);
      const definition = arrayTool.definition;

      expect(definition.inputSchema.properties?.['strings']).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
      expect(definition.inputSchema.properties?.['numbers']).toEqual({
        type: 'array',
        items: { type: 'number' },
      });
      expect(definition.inputSchema.properties?.['objects']).toEqual({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
      });
    });

    it('should handle optional fields', () => {
      const optionalSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable(),
      });

      class OptionalTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('optional', 'Optional tool', optionalSchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const optionalTool = new OptionalTool(mockClient);
      const definition = optionalTool.definition;

      expect(definition.inputSchema.properties?.['required']).toEqual({ type: 'string' });
      expect(definition.inputSchema.properties?.['optional']).toEqual({ type: 'string' });
      expect(definition.inputSchema.properties?.['nullable']).toEqual({ type: 'string' });
    });

    it('should handle enum types', () => {
      const enumSchema = z.object({
        status: z.enum(['pending', 'approved', 'rejected']),
        priority: z.enum(['low', 'medium', 'high']),
      });

      class EnumTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('enum', 'Enum tool', enumSchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const enumTool = new EnumTool(mockClient);
      const definition = enumTool.definition;

      expect(definition.inputSchema.properties?.['status']).toEqual({
        type: 'string',
        enum: ['pending', 'approved', 'rejected'],
      });
      expect(definition.inputSchema.properties?.['priority']).toEqual({
        type: 'string',
        enum: ['low', 'medium', 'high'],
      });
    });

    it('should handle unknown types gracefully', () => {
      // Create a mock zod type that doesn't match any known types
      const unknownType = {
        _type: 'ZodUnknown',
      } as any;

      const result = testTool['zodTypeToJsonSchema'](unknownType);

      expect(result).toEqual({ type: 'string' });
    });
  });

  describe('formatResponse', () => {
    it('should format simple objects as JSON', () => {
      const data = { id: 1, name: 'test' };
      const formatted = testTool['formatResponse'](data);

      expect(formatted).toBe(JSON.stringify(data, null, 2));
    });

    it('should format arrays as JSON', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const formatted = testTool['formatResponse'](data);

      expect(formatted).toBe(JSON.stringify(data, null, 2));
    });

    it('should format complex nested objects', () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'Test User',
            settings: ['setting1', 'setting2'],
          },
        },
      };
      const formatted = testTool['formatResponse'](data);

      expect(formatted).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle null and undefined values', () => {
      expect(testTool['formatResponse'](null)).toBe('null');
      expect(testTool['formatResponse'](undefined)).toBe('undefined');
    });

    it('should handle primitive values', () => {
      expect(testTool['formatResponse']('string')).toBe('"string"');
      expect(testTool['formatResponse'](123)).toBe('123');
      expect(testTool['formatResponse'](true)).toBe('true');
    });
  });

  describe('handleError', () => {
    it('should format error with message and code', () => {
      const error = {
        message: 'Test error',
        code: 'TEST_ERROR',
      };

      const formatted = testTool['handleError'](error);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({
        error: true,
        message: 'Test error',
        code: 'TEST_ERROR',
      });
    });

    it('should format error with message but no code', () => {
      const error = {
        message: 'Test error without code',
      };

      const formatted = testTool['handleError'](error);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({
        error: true,
        message: 'Test error without code',
        code: 'UNKNOWN_ERROR',
      });
    });

    it('should handle error without message', () => {
      const error = {
        code: 'TEST_ERROR',
      };

      const formatted = testTool['handleError'](error);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({
        error: true,
        message: 'An unknown error occurred',
      });
    });

    it('should handle null or undefined error', () => {
      const formattedNull = testTool['handleError'](null);
      const formattedUndefined = testTool['handleError'](undefined);

      expect(JSON.parse(formattedNull)).toEqual({
        error: true,
        message: 'An unknown error occurred',
      });

      expect(JSON.parse(formattedUndefined)).toEqual({
        error: true,
        message: 'An unknown error occurred',
      });
    });

    it('should handle string errors', () => {
      const formatted = testTool['handleError']('String error');
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({
        error: true,
        message: 'An unknown error occurred',
      });
    });

    it('should handle Error objects', () => {
      const error = new Error('Standard error');
      (error as any).code = 'STANDARD_ERROR';

      const formatted = testTool['handleError'](error);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({
        error: true,
        message: 'Standard error',
        code: 'STANDARD_ERROR',
      });
    });
  });

  describe('execute method', () => {
    it('should be implemented by subclass', async () => {
      const result = await testTool.execute({ test: 'data' });

      expect(result).toEqual({
        result: 'success',
        args: { test: 'data' },
      });
    });
  });

  describe('integration with client', () => {
    it('should have access to client methods', () => {
      expect(testTool['client']).toBe(mockClient);
      expect(testTool['client'].get).toBeDefined();
      expect(testTool['client'].post).toBeDefined();
      expect(testTool['client'].put).toBeDefined();
      expect(testTool['client'].patch).toBeDefined();
      expect(testTool['client'].delete).toBeDefined();
    });
  });

  describe('schema validation edge cases', () => {
    it('should handle deeply nested optional objects', () => {
      const deepSchema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              value: z.string(),
            }).optional(),
          }).optional(),
        }),
      });

      class DeepTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('deep', 'Deep nesting tool', deepSchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const deepTool = new DeepTool(mockClient);
      const definition = deepTool.definition;

      expect(definition.inputSchema.properties?.['level1']).toBeDefined();
      expect((definition.inputSchema as any).required).toEqual(['level1']);
    });

    it('should handle arrays of optional elements', () => {
      const arrayOptionalSchema = z.object({
        items: z.array(z.string().optional()),
        required_items: z.array(z.string()),
      });

      class ArrayOptionalTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('array_optional', 'Array optional tool', arrayOptionalSchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const tool = new ArrayOptionalTool(mockClient);
      const definition = tool.definition;

      expect(definition.inputSchema.properties?.['items']).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should handle mixed type schemas', () => {
      const mixedSchema = z.object({
        stringOrNumber: z.union([z.string(), z.number()]),
        optionalEnum: z.enum(['a', 'b', 'c']).optional(),
      });

      class MixedTool extends BaseTool {
        get definition(): Tool {
          return this.createTool('mixed', 'Mixed types tool', mixedSchema);
        }
        async execute(): Promise<any> { return {}; }
      }

      const tool = new MixedTool(mockClient);
      const definition = tool.definition;

      // Union types should default to string
      expect(definition.inputSchema.properties?.['stringOrNumber']).toEqual({ type: 'string' });
      expect(definition.inputSchema.properties?.['optionalEnum']).toEqual({
        type: 'string',
        enum: ['a', 'b', 'c'],
      });
    });
  });
});