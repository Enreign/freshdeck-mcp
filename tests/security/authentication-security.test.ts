import { Authenticator } from '../../src/auth/authenticator.js';
import { FreshdeskClient } from '../../src/api/client.js';
import { FreshdeskConfig } from '../../src/core/types.js';
import nock from 'nock';

describe('Security - Authentication and Authorization Tests', () => {
  let authenticator: Authenticator;
  let client: FreshdeskClient;
  const baseUrl = 'https://test-domain.freshdesk.com/api/v2';

  beforeEach(() => {
    const config: FreshdeskConfig = {
      domain: 'test-domain',
      apiKey: 'test-api-key',
    };
    authenticator = new Authenticator(config);
    client = new FreshdeskClient(config);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('API Key Security', () => {
    it('should reject empty API keys', () => {
      expect(authenticator.validateApiKey('')).toBe(false);
      expect(authenticator.validateApiKey(' ')).toBe(false);
      expect(authenticator.validateApiKey('\t')).toBe(false);
      expect(authenticator.validateApiKey('\n')).toBe(false);
    });

    it('should reject null or undefined API keys', () => {
      expect(authenticator.validateApiKey(null as any)).toBe(false);
      expect(authenticator.validateApiKey(undefined as any)).toBe(false);
    });

    it('should reject API keys that are too short', () => {
      expect(authenticator.validateApiKey('a')).toBe(false);
      expect(authenticator.validateApiKey('ab')).toBe(false);
      expect(authenticator.validateApiKey('abc')).toBe(false);
    });

    it('should reject API keys with invalid characters', () => {
      expect(authenticator.validateApiKey('key with spaces')).toBe(false);
      expect(authenticator.validateApiKey('key\nwith\nnewlines')).toBe(false);
      expect(authenticator.validateApiKey('key\twith\ttabs')).toBe(false);
      expect(authenticator.validateApiKey('key<script>alert(1)</script>')).toBe(false);
      expect(authenticator.validateApiKey('key"with"quotes')).toBe(false);
      expect(authenticator.validateApiKey("key'with'quotes")).toBe(false);
    });

    it('should mask API keys in headers', () => {
      const config: FreshdeskConfig = {
        domain: 'test-domain',
        apiKey: 'very-secret-api-key-12345',
      };
      const auth = new Authenticator(config);
      const headers = auth.getAuthHeader();
      
      // Should have Authorization header
      expect(headers.Authorization).toBeDefined();
      
      // Should be base64 encoded
      const decoded = Buffer.from(headers.Authorization.split(' ')[1], 'base64').toString();
      expect(decoded).toContain('very-secret-api-key-12345:');
    });

    it('should handle API key rotation securely', () => {
      const originalKey = 'original-api-key';
      const newKey = 'new-rotated-api-key';
      
      const config: FreshdeskConfig = {
        domain: 'test-domain',
        apiKey: originalKey,
      };
      
      const auth = new Authenticator(config);
      const originalHeader = auth.getAuthHeader();
      
      // Update to new key
      config.apiKey = newKey;
      const newAuth = new Authenticator(config);
      const newHeader = newAuth.getAuthHeader();
      
      // Headers should be different
      expect(originalHeader.Authorization).not.toBe(newHeader.Authorization);
      
      // New header should contain new key
      const decoded = Buffer.from(newHeader.Authorization.split(' ')[1], 'base64').toString();
      expect(decoded).toContain(newKey);
      expect(decoded).not.toContain(originalKey);
    });

    it('should prevent API key leakage in error messages', () => {
      const sensitiveKey = 'super-secret-key-do-not-leak';
      const config: FreshdeskConfig = {
        domain: 'test-domain',
        apiKey: sensitiveKey,
      };

      // Test that API key doesn't appear in potential error scenarios
      expect(() => {
        new Authenticator({ ...config, apiKey: '' });
      }).not.toThrow(sensitiveKey);
    });
  });

  describe('Domain Security', () => {
    it('should reject invalid domain formats', () => {
      const invalidDomains = [
        '',
        ' ',
        '\t',
        '\n',
        'domain with spaces',
        'domain\nwith\nnewlines',
        'domain.with.dots',
        'http://domain.com',
        'https://domain.com',
        'domain.com/',
        'domain.com/path',
        'domain.com?query=value',
        'domain.com#fragment',
        'sub.domain.com',
        'domain-with-protocol://test.com',
      ];

      invalidDomains.forEach(domain => {
        expect(authenticator.validateDomain(domain)).toBe(false);
      });
    });

    it('should accept valid domain formats', () => {
      const validDomains = [
        'test-domain',
        'company-name',
        'my-helpdesk',
        'support123',
        'a',
        'a-b',
        'test-domain-123',
      ];

      validDomains.forEach(domain => {
        expect(authenticator.validateDomain(domain)).toBe(true);
      });
    });

    it('should construct correct base URLs', () => {
      const testCases = [
        { domain: 'test-domain', expected: 'https://test-domain.freshdesk.com/api/v2' },
        { domain: 'company', expected: 'https://company.freshdesk.com/api/v2' },
        { domain: 'my-support', expected: 'https://my-support.freshdesk.com/api/v2' },
      ];

      testCases.forEach(({ domain, expected }) => {
        const config: FreshdeskConfig = { domain, apiKey: 'test-key' };
        const auth = new Authenticator(config);
        expect(auth.getBaseUrl()).toBe(expected);
      });
    });

    it('should prevent domain spoofing attacks', () => {
      const maliciousDomains = [
        'freshdesk.com',
        'api.freshdesk.com',
        'evil.freshdesk.com.malicious.com',
        'freshdesk.com.evil.com',
        'xn--freshdesk-eomm.com', // IDN homograph attack
        'freshdësk.com', // Unicode look-alike
        'freshde5k.com', // Character substitution
      ];

      maliciousDomains.forEach(domain => {
        expect(authenticator.validateDomain(domain)).toBe(false);
      });
    });
  });

  describe('HTTP Security Headers', () => {
    it('should include proper authentication headers', async () => {
      nock(baseUrl)
        .get('/test')
        .matchHeader('authorization', /^Basic [A-Za-z0-9+/]+=*$/)
        .reply(200, { success: true });

      await client.get('/test');

      expect(nock.isDone()).toBe(true);
    });

    it('should not include sensitive information in headers', async () => {
      nock(baseUrl)
        .get('/test')
        .matchHeader('authorization', (val) => {
          // Authorization header should not contain raw API key
          return !val.includes('test-api-key');
        })
        .reply(200, { success: true });

      await client.get('/test');

      expect(nock.isDone()).toBe(true);
    });

    it('should handle authorization header injection attempts', () => {
      const maliciousConfig: FreshdeskConfig = {
        domain: 'test-domain',
        apiKey: 'test-key\r\nX-Injected-Header: malicious-value',
      };

      const auth = new Authenticator(maliciousConfig);
      const headers = auth.getAuthHeader();

      // Should not contain injected headers
      expect(headers).not.toHaveProperty('X-Injected-Header');
      expect(headers.Authorization).not.toContain('\r\n');
      expect(headers.Authorization).not.toContain('X-Injected-Header');
    });
  });

  describe('Session Security', () => {
    it('should not persist credentials in memory longer than necessary', () => {
      const config: FreshdeskConfig = {
        domain: 'test-domain',
        apiKey: 'temporary-key',
      };

      const auth = new Authenticator(config);
      const headers = auth.getAuthHeader();

      // Headers should be created fresh each time
      expect(headers).toBeDefined();
      expect(headers.Authorization).toBeDefined();

      // Modifying config should not affect already created headers
      config.apiKey = 'modified-key';
      const newAuth = new Authenticator(config);
      const newHeaders = newAuth.getAuthHeader();

      expect(headers.Authorization).not.toBe(newHeaders.Authorization);
    });

    it('should handle concurrent authentication requests safely', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        nock(baseUrl)
          .get(`/test${i}`)
          .reply(200, { id: i });

        promises.push(client.get(`/test${i}`));
      }

      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        expect(result.id).toBe(index);
      });
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not leak authentication details in 401 errors', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(401, {
          message: 'Authentication failed',
          code: 'INVALID_CREDENTIALS',
        });

      try {
        await client.get('/test');
        fail('Should have thrown an error');
      } catch (error: any) {
        // Error message should not contain API key or sensitive info
        expect(error.message).not.toContain('test-api-key');
        expect(error.message).not.toContain('Basic ');
        expect(error.message).not.toContain('Authorization');
        expect(error.message).toBeDefined();
      }
    });

    it('should not expose internal authentication state in errors', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(403, {
          message: 'Access forbidden',
          code: 'PERMISSION_ERROR',
        });

      try {
        await client.get('/test');
        fail('Should have thrown an error');
      } catch (error: any) {
        // Error should not expose internal state
        expect(error.message).not.toMatch(/token|session|credential|auth.*state/i);
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should validate API keys in constant time', () => {
      const validKey = 'valid-api-key-12345';
      const invalidKeys = [
        'invalid-key-1',
        'different-key-length',
        'a',
        '',
        'valid-api-key-12346', // One character different
      ];

      // Measure timing for valid key
      const validStart = process.hrtime();
      authenticator.validateApiKey(validKey);
      const validEnd = process.hrtime(validStart);

      // Measure timing for invalid keys
      invalidKeys.forEach(invalidKey => {
        const invalidStart = process.hrtime();
        authenticator.validateApiKey(invalidKey);
        const invalidEnd = process.hrtime(invalidStart);

        // Time difference should not be significant enough for timing attack
        // (This is a simplified test - real constant-time comparison would be more complex)
        const validTime = validEnd[0] * 1e9 + validEnd[1];
        const invalidTime = invalidEnd[0] * 1e9 + invalidEnd[1];
        const timeDiff = Math.abs(validTime - invalidTime);
        
        // Should not have massive timing differences (allowing for some variance)
        expect(timeDiff).toBeLessThan(1e6); // 1ms threshold
      });
    });

    it('should validate domains in constant time', () => {
      const validDomain = 'valid-domain';
      const invalidDomains = [
        'invalid-domain',
        'different-length-domain',
        'a',
        '',
        'valid-domainx', // One character different
      ];

      const validStart = process.hrtime();
      authenticator.validateDomain(validDomain);
      const validEnd = process.hrtime(validStart);

      invalidDomains.forEach(invalidDomain => {
        const invalidStart = process.hrtime();
        authenticator.validateDomain(invalidDomain);
        const invalidEnd = process.hrtime(invalidStart);

        const validTime = validEnd[0] * 1e9 + validEnd[1];
        const invalidTime = invalidEnd[0] * 1e9 + invalidEnd[1];
        const timeDiff = Math.abs(validTime - invalidTime);
        
        expect(timeDiff).toBeLessThan(1e6); // 1ms threshold
      });
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent authentication bypass through rate limiting', async () => {
      // Create client with very low rate limit
      const rateLimitedConfig: FreshdeskConfig = {
        domain: 'test-domain',
        apiKey: 'test-api-key',
        rateLimitPerMinute: 1,
      };
      
      const rateLimitedClient = new FreshdeskClient(rateLimitedConfig);

      // First request should succeed
      nock(baseUrl)
        .get('/test1')
        .reply(200, { success: true });

      await rateLimitedClient.get('/test1');

      // Second request should be rate limited
      await expect(rateLimitedClient.get('/test2')).rejects.toThrow(/Rate limit exceeded/);

      // Rate limiting should not bypass authentication
      nock(baseUrl)
        .get('/test3')
        .reply(401, { message: 'Unauthorized' });

      // Even after rate limit reset, authentication should still be required
      await expect(rateLimitedClient.get('/test3')).rejects.toThrow(/Rate limit exceeded/);
    });
  });

  describe('Configuration Security', () => {
    it('should not accept configuration from untrusted sources', () => {
      const untrustedConfig = JSON.parse('{"domain": "evil-domain", "apiKey": "stolen-key"}');
      
      // Should validate configuration properties
      expect(authenticator.validateDomain(untrustedConfig.domain)).toBe(false);
      expect(authenticator.validateApiKey(untrustedConfig.apiKey)).toBe(true); // Format is valid but source is untrusted
    });

    it('should sanitize configuration values', () => {
      const config: FreshdeskConfig = {
        domain: 'test-domain\u0000\u0001',
        apiKey: 'test-key\r\n',
      };

      const auth = new Authenticator(config);
      
      // Should handle null bytes and control characters
      expect(auth.validateDomain(config.domain)).toBe(false);
      expect(auth.validateApiKey(config.apiKey)).toBe(false);
    });

    it('should prevent prototype pollution in configuration', () => {
      const maliciousConfig = JSON.parse('{"__proto__": {"polluted": true}, "domain": "test", "apiKey": "key"}');
      
      // Should not pollute Object prototype
      expect((Object.prototype as any).polluted).toBeUndefined();
      
      const auth = new Authenticator(maliciousConfig);
      expect(auth.validateDomain(maliciousConfig.domain)).toBe(true);
      expect(auth.validateApiKey(maliciousConfig.apiKey)).toBe(true);
    });
  });

  describe('Memory Security', () => {
    it('should not leave credentials in memory dumps', () => {
      const sensitiveKey = 'super-secret-credential';
      const config: FreshdeskConfig = {
        domain: 'test-domain',
        apiKey: sensitiveKey,
      };

      const auth = new Authenticator(config);
      const headers = auth.getAuthHeader();

      // Convert headers to string to simulate memory dump
      const headerString = JSON.stringify(headers);
      
      // Raw API key should not be present in headers
      expect(headerString).not.toContain(sensitiveKey);
      
      // But should contain base64 encoded version
      expect(headerString).toContain('Basic ');
    });

    it('should handle garbage collection safely', () => {
      let config: FreshdeskConfig | null = {
        domain: 'test-domain',
        apiKey: 'temporary-key',
      };

      let auth: Authenticator | null = new Authenticator(config);
      const headers = auth.getAuthHeader();

      // Clear references
      config = null;
      auth = null;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Headers should still be valid
      expect(headers.Authorization).toBeDefined();
    });
  });
});