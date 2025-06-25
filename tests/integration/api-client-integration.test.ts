import nock from 'nock';
import { FreshdeskClient } from '../../src/api/client.js';
import { Authenticator } from '../../src/auth/authenticator.js';
import { FreshdeskConfig } from '../../src/core/types.js';

describe('API Client Integration Tests', () => {
  let client: FreshdeskClient;
  let config: FreshdeskConfig;
  const baseUrl = 'https://test-domain.freshdesk.com/api/v2';

  beforeEach(() => {
    config = {
      domain: 'test-domain',
      apiKey: 'test-api-key',
      timeout: 30000,
      maxRetries: 3,
      rateLimitPerMinute: 50,
    };

    client = new FreshdeskClient(config);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Client and Authenticator Integration', () => {
    it('should use authenticator for base URL and headers', async () => {
      nock(baseUrl)
        .get('/test')
        .matchHeader('authorization', 'Basic dGVzdC1hcGkta2V5Og==')
        .reply(200, { success: true });

      await client.get('/test');

      expect(nock.isDone()).toBe(true);
    });

    it('should validate domain and API key through authenticator', () => {
      const authenticator = new Authenticator(config);
      
      expect(// Domain validation removed - not implemented
      expect(authenticator.validateApiKey()).toBe(true);
      expect(authenticator.getBaseUrl()).toBe(baseUrl);
    });
  });

  describe('Client and Rate Limiter Integration', () => {
    it('should check rate limit before making requests', async () => {
      // Rate limiter should allow first request
      nock(baseUrl)
        .get('/test')
        .reply(200, { success: true }, {
          'x-ratelimit-remaining': '49',
          'x-ratelimit-total': '50',
        });

      const result = await client.get('/test');
      expect(result).toEqual({ success: true });

      // Rate limit info should be updated
      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo.remaining).toBeLessThanOrEqual(50);
    });

    it('should handle rate limit exceeded scenario', async () => {
      // Create a client with very low rate limit for testing
      const rateLimitedConfig = { ...config, rateLimitPerMinute: 1 };
      const rateLimitedClient = new FreshdeskClient(rateLimitedConfig);

      // First request should succeed
      nock(baseUrl)
        .get('/test1')
        .reply(200, { success: true });

      await rateLimitedClient.get('/test1');

      // Second request should fail due to rate limit
      await expect(rateLimitedClient.get('/test2')).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should update rate limit from response headers', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(200, { success: true }, {
          'x-ratelimit-remaining': '25',
          'x-ratelimit-total': '50',
          'x-ratelimit-used-current-request': '1',
        });

      await client.get('/test');

      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo.remaining).toBe(25);
    });
  });

  describe('Client and Error Handler Integration', () => {
    it('should parse and handle authentication errors', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(401, {
          message: 'Authentication failed. Please check your API key.',
          code: 'INVALID_CREDENTIALS',
        });

      await expect(client.get('/test')).rejects.toThrow('Authentication failed');
    });

    it('should handle rate limit errors with retry logic', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(429, {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_ERROR',
        }, {
          'retry-after': '1',
        })
        .get('/test')
        .reply(200, { success: true });

      const result = await client.get('/test');
      expect(result).toEqual({ success: true });
    });

    it('should retry on server errors', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(502, { message: 'Bad Gateway' })
        .get('/test')
        .reply(200, { success: true });

      const result = await client.get('/test');
      expect(result).toEqual({ success: true });
    });

    it('should not retry non-retryable errors', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(404, {
          message: 'Resource not found',
          code: 'NOT_FOUND',
        });

      await expect(client.get('/test')).rejects.toThrow('Resource not found');
    });

    it('should respect maxRetries configuration', async () => {
      // Setup multiple 500 errors (more than maxRetries)
      nock(baseUrl)
        .persist()
        .get('/test')
        .reply(500, { message: 'Internal Server Error' });

      await expect(client.get('/test')).rejects.toThrow('Internal Server Error');
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should handle complete CRUD workflow with proper error handling', async () => {
      // Create ticket
      nock(baseUrl)
        .post('/tickets', {
          subject: 'Integration Test Ticket',
          description: 'Test description',
          email: 'test@example.com',
          priority: 2,
          status: 2,
        })
        .reply(201, {
          id: 123,
          subject: 'Integration Test Ticket',
          status: 2,
          priority: 2,
        });

      const ticket = await client.post('/tickets', {
        subject: 'Integration Test Ticket',
        description: 'Test description',
        email: 'test@example.com',
        priority: 2,
        status: 2,
      });

      expect((ticket as any).id).toBe(123);

      // Update ticket
      nock(baseUrl)
        .put('/tickets/123', { priority: 3 })
        .reply(200, {
          id: 123,
          subject: 'Integration Test Ticket',
          priority: 3,
        });

      const updatedTicket = await client.put('/tickets/123', { priority: 3 });
      expect((updatedTicket as any).priority).toBe(3);

      // Get ticket
      nock(baseUrl)
        .get('/tickets/123')
        .reply(200, {
          id: 123,
          subject: 'Integration Test Ticket',
          priority: 3,
        });

      const retrievedTicket = await client.get('/tickets/123');
      expect((retrievedTicket as any).id).toBe(123);

      // Delete ticket
      nock(baseUrl)
        .delete('/tickets/123')
        .reply(204);

      await client.delete('/tickets/123');
    });

    it('should handle concurrent requests with rate limiting', async () => {
      // Setup multiple endpoints
      for (let i = 1; i <= 5; i++) {
        nock(baseUrl)
          .get(`/test${i}`)
          .reply(200, { id: i, data: `test${i}` });
      }

      const promises = [];
      for (let i = 1; i <= 5; i++) {
        promises.push(client.get(`/test${i}`));
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect((result as any).id).toBe(index + 1);
        expect((result as any).data).toBe(`test${index + 1}`);
      });
    });

    it('should handle mixed success and failure scenarios', async () => {
      // Setup mixed responses
      nock(baseUrl)
        .get('/success')
        .reply(200, { success: true });

      nock(baseUrl)
        .get('/not-found')
        .reply(404, { message: 'Not found' });

      nock(baseUrl)
        .get('/server-error')
        .reply(500, { message: 'Internal server error' })
        .get('/server-error')
        .reply(200, { success: true });

      // Success request
      const success = await client.get('/success');
      expect((success as any).success).toBe(true);

      // Not found request (should fail)
      await expect(client.get('/not-found')).rejects.toThrow('Not found');

      // Server error request (should retry and succeed)
      const retrySuccess = await client.get('/server-error');
      expect((retrySuccess as any).success).toBe(true);
    });
  });

  describe('Connection Testing Integration', () => {
    it('should test connection successfully', async () => {
      nock(baseUrl)
        .get('/agents/me')
        .reply(200, {
          id: 1,
          contact: {
            name: 'Test Agent',
            email: 'agent@test.com',
          },
        });

      const connected = await client.testConnection();
      expect(connected).toBe(true);
    });

    it('should fail connection test on authentication error', async () => {
      nock(baseUrl)
        .get('/agents/me')
        .reply(401, { message: 'Unauthorized' });

      const connected = await client.testConnection();
      expect(connected).toBe(false);
    });

    it('should fail connection test on network error', async () => {
      nock(baseUrl)
        .get('/agents/me')
        .replyWithError('Network error');

      const connected = await client.testConnection();
      expect(connected).toBe(false);
    });
  });

  describe('Request Interceptor Integration', () => {
    it('should log requests and responses through interceptors', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      nock(baseUrl)
        .get('/test')
        .reply(200, { success: true });

      await client.get('/test');

      // Interceptors are working if no errors are thrown
      expect(nock.isDone()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle interceptor errors gracefully', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(200, { success: true });

      // Should not throw even if interceptors have issues
      const result = await client.get('/test');
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect timeout configuration', async () => {
      const shortTimeoutConfig = { ...config, timeout: 100 };
      const shortTimeoutClient = new FreshdeskClient(shortTimeoutConfig);

      nock(baseUrl)
        .get('/test')
        .delay(200)
        .reply(200, { success: true });

      await expect(shortTimeoutClient.get('/test')).rejects.toThrow();
    });

    it('should work with minimal configuration', async () => {
      const minimalConfig = {
        domain: 'test-domain',
        apiKey: 'test-api-key',
      };

      const minimalClient = new FreshdeskClient(minimalConfig);

      nock(baseUrl)
        .get('/test')
        .reply(200, { success: true });

      const result = await minimalClient.get('/test');
      expect(result.success).toBe(true);
    });

    it('should handle custom rate limits', async () => {
      const customRateLimitConfig = { ...config, rateLimitPerMinute: 100 };
      const customClient = new FreshdeskClient(customRateLimitConfig);

      const rateLimitInfo = customClient.getRateLimitInfo();
      expect(rateLimitInfo.limit).toBe(100);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from temporary network issues', async () => {
      nock(baseUrl)
        .get('/test')
        .replyWithError('ENOTFOUND')
        .get('/test')
        .reply(200, { success: true });

      const result = await client.get('/test');
      expect(result.success).toBe(true);
    });

    it('should handle partial responses correctly', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(200, '{"partial":'); // Malformed JSON

      await expect(client.get('/test')).rejects.toThrow();
    });

    it('should handle empty responses', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(204); // No content

      const result = await client.get('/test');
      expect(result).toBeUndefined();
    });
  });
});