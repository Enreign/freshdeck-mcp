#!/usr/bin/env node

import { z } from 'zod';
import dotenv from 'dotenv';
import { EnhancedFreshdeskServer } from './server/enhanced-server.js';
import { FreshdeskConfig } from './core/types.js';
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

function loadConfiguration(): FreshdeskConfig {
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

// Main entry point
async function main() {
  try {
    // Parse and validate configuration
    const config = loadConfiguration();
    
    // Create server instance
    const server = new EnhancedFreshdeskServer(config);
    
    // Initialize server
    await server.initialize();
    
    // Start the server
    await server.start();
    
    // Log server health
    const health = server.getHealth();
    logger.info('Server health:', health);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the server
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});