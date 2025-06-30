import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FreshdeskClient } from '../api/client.js';
import { FreshdeskConfig } from '../core/types.js';
import { ToolRegistry } from '../core/registry.js';
import { PermissionDiscoveryService } from '../auth/permission-discovery.js';
import { UserPermissions } from '../auth/permissions.js';
import { createLogger } from '../utils/logger.js';
import { EnhancedBaseTool } from '../tools/enhanced-base.js';
import {
  ServerError,
  ProtocolError,
  ToolExecutionError,
} from '../utils/errors.js';

// Import enhanced tools
import { TicketsEnhancedTool } from '../tools/tickets-enhanced.js';
import { ContactsEnhancedTool } from '../tools/contacts-enhanced.js';
import { AgentsEnhancedTool } from '../tools/agents-enhanced.js';
import { CompaniesEnhancedTool } from '../tools/companies-enhanced.js';
import { ConversationsEnhancedTool } from '../tools/conversations-enhanced.js';
import { DiscoveryTool } from '../tools/discovery-tool.js';

export interface ServerMetrics {
  uptime: number;
  requestsTotal: number;
  requestsSuccess: number;
  requestsFailed: number;
  averageResponseTime: number;
  activeConnections: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    api: boolean;
    auth: boolean;
    rateLimit: boolean;
  };
}

export class EnhancedFreshdeskServer {
  private server?: Server;
  private transport?: StdioServerTransport;
  private client: FreshdeskClient;
  private toolRegistry: ToolRegistry;
  private permissionDiscovery: PermissionDiscoveryService;
  private userPermissions?: UserPermissions;
  private logger;
  private startTime: Date;
  private metrics: ServerMetrics;
  private config: FreshdeskConfig;

  constructor(config: FreshdeskConfig) {
    this.config = config;
    this.logger = createLogger('mcp-server');
    this.client = new FreshdeskClient(config);
    this.toolRegistry = new ToolRegistry();
    this.permissionDiscovery = new PermissionDiscoveryService(this.client);
    this.startTime = new Date();
    this.metrics = {
      uptime: 0,
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      activeConnections: 0,
    };
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Enhanced Freshdesk MCP Server...');

      // Initialize MCP server
      this.initializeMCPServer();

      // Test connection (skip in test mode)
      if (process.env['NODE_ENV'] !== 'test' && process.env['SKIP_CONNECTION_TEST'] !== 'true') {
        this.logger.info('Testing API connection...');
        const connected = await this.client.testConnection();
        if (!connected) {
          throw new ServerError('Failed to connect to Freshdesk API');
        }
        this.logger.info('API connection established');
      }

      // Discover user permissions
      if (process.env['NODE_ENV'] !== 'test' && process.env['SKIP_PERMISSION_DISCOVERY'] !== 'true') {
        this.logger.info('Discovering user permissions...');
        try {
          this.userPermissions = await this.permissionDiscovery.discoverUserPermissions();
          this.logger.info('Permission discovery completed', {
            accessLevel: this.userPermissions.accessLevel,
            isReadOnly: this.userPermissions.isReadOnly,
            permissionCount: this.userPermissions.permissions.size,
          });
        } catch (error) {
          this.logger.warn('Permission discovery failed, proceeding with default permissions', error);
          // Create default permissions if discovery fails
          this.userPermissions = this.createDefaultPermissions();
        }
      } else {
        // Use default permissions in test mode
        this.userPermissions = this.createDefaultPermissions();
      }

      // Register tools based on permissions
      await this.registerTools();

      this.logger.info('Enhanced Freshdesk MCP Server initialized successfully');
    } catch (error) {
      this.logger.fatal('Failed to initialize server', error);
      throw error;
    }
  }

  private createDefaultPermissions(): UserPermissions {
    const { AccessLevel, Permission } = require('../auth/permissions.js');
    return {
      accessLevel: AccessLevel.WRITE,
      isReadOnly: false,
      canWrite: true,
      canDelete: false,
      isAdmin: false,
      permissions: new Set([
        Permission.TICKETS_READ,
        Permission.TICKETS_WRITE,
        Permission.CONTACTS_READ,
        Permission.CONTACTS_WRITE,
        Permission.AGENTS_READ,
        Permission.COMPANIES_READ,
        Permission.CONVERSATIONS_READ,
        Permission.SEARCH,
      ]),
      capabilities: {
        tickets: { read: true, write: true, delete: false },
        contacts: { read: true, write: true, delete: false },
        agents: { read: true, write: false, admin: false },
        companies: { read: true, write: false, delete: false },
        conversations: { read: true, write: false },
        products: { read: true, write: false },
        groups: { read: true, write: false },
        customFields: { read: false, write: false },
        solutions: { read: true, write: false },
        timeEntries: { read: false, write: false },
        analytics: { read: false },
        automations: { read: false, write: false },
        export: { data: true },
        search: { enabled: true },
      },
    };
  }

  private initializeMCPServer(): void {
    this.server = new Server(
      {
        name: 'freshdesk-mcp-enhanced',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.transport = new StdioServerTransport();

    // Set up request handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolRegistry.listTools(),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      this.metrics.requestsTotal++;
      this.metrics.activeConnections++;

      try {
        if (!request.params || typeof request.params !== 'object') {
          throw new ProtocolError('Request params are required');
        }

        const { name, arguments: args } = request.params as { name?: string; arguments?: unknown };

        if (!name || typeof name !== 'string') {
          throw new ProtocolError('Tool name is required and must be a string');
        }

        const result = await this.handleToolExecution(name, args);

        this.metrics.requestsSuccess++;
        this.updateResponseTime(Date.now() - startTime);

        return result;
      } catch (error) {
        this.metrics.requestsFailed++;
        this.logger.error('Tool execution failed', error);
        
        if (error instanceof ProtocolError || error instanceof ToolExecutionError) {
          throw error;
        }
        
        const toolName = request.params && typeof request.params === 'object' && 'name' in request.params
          ? (request.params as any).name
          : 'unknown';
        
        throw new ToolExecutionError(
          error instanceof Error ? error.message : 'Unknown error during tool execution',
          toolName,
          error instanceof Error ? error : undefined
        );
      } finally {
        this.metrics.activeConnections--;
      }
    });
  }

  private async handleToolExecution(toolName: string, params: unknown): Promise<any> {
    const tool = this.toolRegistry.getTool(toolName);
    
    if (!tool) {
      throw new ToolExecutionError(`Tool not found: ${toolName}`, toolName);
    }

    // Check permissions
    if (this.userPermissions && !tool.isAvailableForUser(this.userPermissions)) {
      const missingPermissions = tool.getMissingPermissions(this.userPermissions);
      throw new ToolExecutionError(
        `Insufficient permissions for tool ${toolName}. Missing: ${missingPermissions.join(', ')}`,
        toolName
      );
    }

    // Execute tool
    const result = await tool.execute(params);
    
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async registerTools(): Promise<void> {
    this.logger.info('Registering Freshdesk tools...');

    const toolsToRegister: EnhancedBaseTool[] = [
      new TicketsEnhancedTool(this.client),
      new ContactsEnhancedTool(this.client),
      new AgentsEnhancedTool(this.client),
      new CompaniesEnhancedTool(this.client),
      new ConversationsEnhancedTool(this.client),
      new DiscoveryTool(this.client, this.toolRegistry, this.userPermissions),
    ];

    let registeredCount = 0;
    let skippedCount = 0;

    for (const tool of toolsToRegister) {
      try {
        // Check if user has permission to use this tool
        if (this.userPermissions && !tool.isAvailableForUser(this.userPermissions)) {
          const missingPermissions = tool.getMissingPermissions(this.userPermissions);
          this.logger.debug(`Skipping ${tool.name} - insufficient permissions. Missing: ${missingPermissions.join(', ')}`);
          skippedCount++;
          continue;
        }
        
        this.toolRegistry.registerTool(tool);
        registeredCount++;
        this.logger.debug(`${tool.name} registered successfully`);
      } catch (error) {
        this.logger.error(`Failed to register ${tool.name}:`, error);
      }
    }

    this.logger.info(`Tool registration complete: ${registeredCount} registered, ${skippedCount} skipped`);
    
    if (skippedCount > 0) {
      this.logger.info(`${skippedCount} tools were skipped due to insufficient permissions.`);
    }
  }

  async start(): Promise<void> {
    if (!this.server || !this.transport) {
      throw new ServerError('Server not initialized');
    }

    try {
      this.logger.info('Starting Enhanced Freshdesk MCP Server...');
      await this.server.connect(this.transport);
      this.logger.info('Enhanced Freshdesk MCP Server started successfully');
    } catch (error) {
      this.logger.fatal('Failed to start server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Enhanced Freshdesk MCP Server...');
      
      if (this.server) {
        await this.server.close();
      }

      this.logger.info('Enhanced Freshdesk MCP Server stopped successfully');
    } catch (error) {
      this.logger.error('Error while stopping server', error);
      throw error;
    }
  }

  private updateResponseTime(responseTime: number): void {
    const currentAverage = this.metrics.averageResponseTime;
    const totalRequests = this.metrics.requestsSuccess + this.metrics.requestsFailed;
    this.metrics.averageResponseTime =
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests;
  }

  getHealth(): HealthStatus {
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      status: 'healthy',
      version: '2.0.0',
      uptime,
      checks: {
        api: true,
        auth: true,
        rateLimit: true,
      },
    };
  }

  getMetrics(): ServerMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}