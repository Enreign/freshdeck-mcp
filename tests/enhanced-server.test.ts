import { EnhancedFreshdeskServer } from '../src/server/enhanced-server';
import { FreshdeskConfig } from '../src/core/types';

describe('Enhanced Freshdesk Server', () => {
  let server: EnhancedFreshdeskServer;
  const mockConfig: FreshdeskConfig = {
    domain: 'test',
    apiKey: 'test-key',
    maxRetries: 3,
    timeout: 30000,
    rateLimitPerMinute: 50,
  };

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    process.env['SKIP_CONNECTION_TEST'] = 'true';
    process.env['SKIP_PERMISSION_DISCOVERY'] = 'true';
  });

  afterEach(() => {
    delete process.env['NODE_ENV'];
    delete process.env['SKIP_CONNECTION_TEST'];
    delete process.env['SKIP_PERMISSION_DISCOVERY'];
  });

  it('should create server instance', () => {
    server = new EnhancedFreshdeskServer(mockConfig);
    expect(server).toBeDefined();
  });

  it('should initialize server', async () => {
    server = new EnhancedFreshdeskServer(mockConfig);
    await expect(server.initialize()).resolves.not.toThrow();
  });

  it('should return health status', async () => {
    server = new EnhancedFreshdeskServer(mockConfig);
    await server.initialize();
    
    const health = server.getHealth();
    expect(health).toMatchObject({
      status: 'healthy',
      version: '2.0.0',
      uptime: expect.any(Number),
      checks: {
        api: true,
        auth: true,
        rateLimit: true,
      },
    });
  });

  it('should return metrics', async () => {
    server = new EnhancedFreshdeskServer(mockConfig);
    await server.initialize();
    
    const metrics = server.getMetrics();
    expect(metrics).toMatchObject({
      uptime: expect.any(Number),
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      activeConnections: 0,
    });
  });
});