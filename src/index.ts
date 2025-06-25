#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';

import { FreshdeskClient } from './api/client.js';
import { FreshdeskConfig } from './core/types.js';
import { TicketsTool } from './tools/tickets.js';
import { ContactsTool } from './tools/contacts.js';
import { AgentsTool } from './tools/agents.js';
import { CompaniesTool } from './tools/companies.js';
import { ConversationsTool } from './tools/conversations.js';
import { createLogger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const logger = createLogger('mcp-server');

// Configuration schema
const ConfigSchema = z.object({
  FRESHDESK_DOMAIN: z.string(),
  FRESHDESK_API_KEY: z.string(),
  FRESHDESK_MAX_RETRIES: z.string().optional(),
  FRESHDESK_TIMEOUT: z.string().optional(),
  FRESHDESK_RATE_LIMIT: z.string().optional(),
});

class FreshdeskMCPServer {
  private server: Server;
  private client: FreshdeskClient;
  private tools: Map<string, any>;

  constructor() {
    this.server = new Server(
      {
        name: 'freshdesk-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize tools map
    this.tools = new Map();

    // Parse and validate configuration
    const config = this.loadConfiguration();

    // Initialize Freshdesk client
    this.client = new FreshdeskClient(config);

    // Initialize tools
    this.initializeTools();

    // Setup request handlers
    this.setupHandlers();

    logger.info('Freshdesk MCP Server initialized');
  }

  private loadConfiguration(): FreshdeskConfig {
    try {
      const env = ConfigSchema.parse(process.env);

      return {
        domain: env.FRESHDESK_DOMAIN,
        apiKey: env.FRESHDESK_API_KEY,
        maxRetries: env.FRESHDESK_MAX_RETRIES ? parseInt(env.FRESHDESK_MAX_RETRIES, 10) : 3,
        timeout: env.FRESHDESK_TIMEOUT ? parseInt(env.FRESHDESK_TIMEOUT, 10) : 30000,
        rateLimitPerMinute: env.FRESHDESK_RATE_LIMIT ? parseInt(env.FRESHDESK_RATE_LIMIT, 10) : 50,
      };
    } catch (error) {
      logger.error('Configuration error:', error);
      throw new Error('Invalid configuration. Please check your environment variables.');
    }
  }

  private initializeTools(): void {
    // Create tool instances
    const ticketsTool = new TicketsTool(this.client);
    const contactsTool = new ContactsTool(this.client);
    const agentsTool = new AgentsTool(this.client);
    const companiesTool = new CompaniesTool(this.client);
    const conversationsTool = new ConversationsTool(this.client);

    // Register tools
    this.tools.set('tickets_manage', ticketsTool);
    this.tools.set('contacts_manage', contactsTool);
    this.tools.set('agents_manage', agentsTool);
    this.tools.set('companies_manage', companiesTool);
    this.tools.set('conversations_manage', conversationsTool);

    logger.info(`Initialized ${this.tools.size} tools`);
  }

  private setupHandlers(): void {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => tool.definition);
      return { tools };
    });

    // Handle call tool request
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        logger.debug(`Executing tool: ${name}`, { args });
        const result = await tool.execute(args);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      } catch (error) {
        logger.error(`Tool execution error for ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: error instanceof Error ? error.message : 'An unknown error occurred',
              }),
            },
          ],
        };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Freshdesk MCP Server started on stdio transport');
  }

  async testConnection(): Promise<void> {
    // Skip connection test if running in mock mode
    if (process.env['SKIP_CONNECTION_TEST'] === 'true') {
      logger.info('Skipping connection test (mock mode)');
      return;
    }

    try {
      const connected = await this.client.testConnection();
      if (connected) {
        logger.info('Successfully connected to Freshdesk API');
      } else {
        logger.error('Failed to connect to Freshdesk API');
        process.exit(1);
      }
    } catch (error) {
      logger.error('Connection test failed:', error);
      process.exit(1);
    }
  }
}

// Main entry point
async function main() {
  try {
    const server = new FreshdeskMCPServer();
    
    // Test connection before starting
    await server.testConnection();
    
    // Start the server
    await server.start();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down Freshdesk MCP Server');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down Freshdesk MCP Server');
  process.exit(0);
});

// Run the server
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});