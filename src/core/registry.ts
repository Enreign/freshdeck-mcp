import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../utils/logger.js';
import { EnhancedBaseTool } from '../tools/enhanced-base.js';

export class ToolRegistry {
  private tools: Map<string, EnhancedBaseTool>;
  private logger;

  constructor() {
    this.tools = new Map();
    this.logger = createLogger('tool-registry');
  }

  registerTool(tool: EnhancedBaseTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }
    
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  getTool(name: string): EnhancedBaseTool | undefined {
    return this.tools.get(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    }));
  }

  size(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }

  getAllTools(): EnhancedBaseTool[] {
    return Array.from(this.tools.values());
  }

  hasPermissionForTool(toolName: string, userPermissions: any): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return false;
    }
    return tool.isAvailableForUser(userPermissions);
  }
}