import pino from 'pino';

export const logger = pino({
  name: 'freshdesk-mcp',
  level: process.env['LOG_LEVEL'] || 'info',
  transport: process.env['NODE_ENV'] !== 'production' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export function createLogger(component: string) {
  return logger.child({ component });
}