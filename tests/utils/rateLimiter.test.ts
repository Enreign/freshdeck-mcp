import { RateLimiter } from '../../src/utils/rateLimiter.js';
import { RateLimitError } from '../../src/utils/errors.js';
// import { RateLimitInfo } from '../../src/core/types.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let originalDateNow: () => number;

  beforeEach(() => {
    originalDateNow = Date.now;
    // Mock Date.now to control time in tests
    Date.now = jest.fn(() => 1000000000000); // Fixed timestamp
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      rateLimiter = new RateLimiter();
      const info = rateLimiter.getRateLimitInfo();

      expect(info.limit).toBe(50);
      expect(info.remaining).toBe(50);
      expect(info.resetAt).toBeInstanceOf(Date);
    });

    it('should initialize with custom values', () => {
      rateLimiter = new RateLimiter(100, 2);
      const info = rateLimiter.getRateLimitInfo();

      expect(info.limit).toBe(100);
      expect(info.remaining).toBe(100);
      expect(info.resetAt.getTime()).toBe(1000000000000 + (2 * 60 * 1000));
    });

    it('should set initial state correctly', () => {
      rateLimiter = new RateLimiter(10, 1);
      const info = rateLimiter.getRateLimitInfo();

      expect(info.limit).toBe(10);
      expect(info.remaining).toBe(10);
      expect(info.resetAt.getTime()).toBe(1000000000000 + 60000);
    });
  });

  describe('checkLimit', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(3, 1); // Small limit for easy testing
    });

    it('should allow requests under the limit', async () => {
      await expect(rateLimiter.checkLimit()).resolves.toBeUndefined();
      await expect(rateLimiter.checkLimit()).resolves.toBeUndefined();
      await expect(rateLimiter.checkLimit()).resolves.toBeUndefined();

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(0);
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      // Use up all available requests
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      // Next request should fail
      await expect(rateLimiter.checkLimit()).rejects.toThrow(RateLimitError);
    });

    it('should include wait time in error message', async () => {
      // Use up all available requests
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      try {
        await rateLimiter.checkLimit();
        fail('Should have thrown RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as Error).message).toMatch(/Please wait \d+ seconds/);
        expect((error as RateLimitError).retryAfter).toBeGreaterThan(0);
      }
    });

    it('should reset window when time expires', async () => {
      // Use up all available requests
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      // Mock time advancing past the reset time
      const advancedTime = 1000000000000 + 61000; // 61 seconds later
      Date.now = jest.fn(() => advancedTime);

      // Should allow new requests after reset
      await expect(rateLimiter.checkLimit()).resolves.toBeUndefined();

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(2); // 3 - 1 (just used)
      expect(info.resetAt.getTime()).toBe(advancedTime + 60000);
    });

    it('should increment count correctly', async () => {
      const initialInfo = rateLimiter.getRateLimitInfo();
      expect(initialInfo.remaining).toBe(3);

      await rateLimiter.checkLimit();
      const afterFirstInfo = rateLimiter.getRateLimitInfo();
      expect(afterFirstInfo.remaining).toBe(2);

      await rateLimiter.checkLimit();
      const afterSecondInfo = rateLimiter.getRateLimitInfo();
      expect(afterSecondInfo.remaining).toBe(1);
    });

    it('should handle concurrent requests correctly', async () => {
      rateLimiter = new RateLimiter(5, 1);

      // Make 5 concurrent requests
      const promises = Array(5).fill(null).map(() => rateLimiter.checkLimit());
      await Promise.all(promises);

      // All should succeed
      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(0);

      // Next request should fail
      await expect(rateLimiter.checkLimit()).rejects.toThrow(RateLimitError);
    });
  });

  describe('getRateLimitInfo', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(10, 2);
    });

    it('should return correct rate limit info', () => {
      const info = rateLimiter.getRateLimitInfo();

      expect(info).toEqual({
        limit: 10,
        remaining: 10,
        resetAt: expect.any(Date),
      });
    });

    it('should update remaining count after requests', async () => {
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(8);
    });

    it('should reset info when window expires', () => {
      // Use some requests
      rateLimiter.checkLimit();
      rateLimiter.checkLimit();

      // Mock time advancing past reset
      const advancedTime = 1000000000000 + (2 * 60 * 1000) + 1000; // 2 minutes + 1 second
      Date.now = jest.fn(() => advancedTime);

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(10); // Reset to full limit
      expect(info.resetAt.getTime()).toBe(advancedTime + (2 * 60 * 1000));
    });

    it('should never return negative remaining count', async () => {
      // Use up all requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit();
      }

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(0);
    });
  });

  describe('updateFromHeaders', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(100, 1);
    });

    it('should update count from Freshdesk headers', () => {
      const headers = {
        'x-ratelimit-total': '100',
        'x-ratelimit-remaining': '75',
        'x-ratelimit-used-current-request': '1',
      };

      rateLimiter.updateFromHeaders(headers);

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(75);
    });

    it('should handle missing headers gracefully', () => {
      const headers = {};

      rateLimiter.updateFromHeaders(headers);

      // Should not throw error and maintain current state
      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(100);
    });

    it('should handle partial headers', () => {
      const headers = {
        'x-ratelimit-total': '100',
        // Missing remaining header
      };

      rateLimiter.updateFromHeaders(headers);

      // Should not update state without both headers
      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(100);
    });

    it('should parse string numbers correctly', () => {
      const headers = {
        'x-ratelimit-total': '50',
        'x-ratelimit-remaining': '25',
      };

      rateLimiter.updateFromHeaders(headers);

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(25);
    });

    it('should handle zero remaining', () => {
      const headers = {
        'x-ratelimit-total': '100',
        'x-ratelimit-remaining': '0',
      };

      rateLimiter.updateFromHeaders(headers);

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(0);
    });

    it('should handle invalid header values', () => {
      const headers = {
        'x-ratelimit-total': 'invalid',
        'x-ratelimit-remaining': 'also-invalid',
      };

      rateLimiter.updateFromHeaders(headers);

      // Should handle gracefully and not crash
      const info = rateLimiter.getRateLimitInfo();
      expect(info).toBeDefined();
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(5, 1);
    });

    it('should reset count and reset time', async () => {
      // Use some requests
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      let info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(3);

      rateLimiter.reset();

      info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(5);
      expect(info.resetAt.getTime()).toBe(1000000000000 + 60000);
    });

    it('should allow full limit after reset', async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit();
      }

      // Should throw error
      await expect(rateLimiter.checkLimit()).rejects.toThrow(RateLimitError);

      // Reset and try again
      rateLimiter.reset();
      await expect(rateLimiter.checkLimit()).resolves.toBeUndefined();
    });
  });

  describe('getWaitTime', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter(2, 1);
    });

    it('should return 0 when under limit', async () => {
      await rateLimiter.checkLimit();

      const waitTime = rateLimiter.getWaitTime();
      expect(waitTime).toBe(0);
    });

    it('should return wait time when at limit', async () => {
      // Exhaust the limit
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      const waitTime = rateLimiter.getWaitTime();
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(60000); // Should be less than window size
    });

    it('should return 0 when window has expired', async () => {
      // Exhaust the limit
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      // Mock time advancing past reset
      const advancedTime = 1000000000000 + 61000;
      Date.now = jest.fn(() => advancedTime);

      const waitTime = rateLimiter.getWaitTime();
      expect(waitTime).toBe(0);
    });

    it('should calculate accurate wait time', async () => {
      // Exhaust the limit
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      // Mock time advancing by 30 seconds
      const advancedTime = 1000000000000 + 30000;
      Date.now = jest.fn(() => advancedTime);

      const waitTime = rateLimiter.getWaitTime();
      expect(waitTime).toBe(30000); // Should wait 30 more seconds
    });
  });

  describe('edge cases', () => {
    it('should handle zero limit', () => {
      rateLimiter = new RateLimiter(0, 1);

      const info = rateLimiter.getRateLimitInfo();
      expect(info.limit).toBe(0);
      expect(info.remaining).toBe(0);
    });

    it('should handle very large limits', () => {
      rateLimiter = new RateLimiter(Number.MAX_SAFE_INTEGER, 1);

      const info = rateLimiter.getRateLimitInfo();
      expect(info.limit).toBe(Number.MAX_SAFE_INTEGER);
      expect(info.remaining).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle very short windows', async () => {
      rateLimiter = new RateLimiter(2, 0.001); // 0.001 minutes = 0.06 seconds

      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      // Should throw error immediately
      await expect(rateLimiter.checkLimit()).rejects.toThrow(RateLimitError);

      // Wait for window to expire
      const advancedTime = 1000000000000 + 100;
      Date.now = jest.fn(() => advancedTime);

      // Should allow new requests
      await expect(rateLimiter.checkLimit()).resolves.toBeUndefined();
    });

    it('should handle fractional remaining from headers', () => {
      const headers = {
        'x-ratelimit-total': '100',
        'x-ratelimit-remaining': '50.5', // Fractional value
      };

      rateLimiter = new RateLimiter(100, 1);
      rateLimiter.updateFromHeaders(headers);

      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(50); // Should be truncated to integer
    });
  });

  describe('time synchronization', () => {
    it('should handle system clock changes', async () => {
      rateLimiter = new RateLimiter(2, 1);

      // Use one request
      await rateLimiter.checkLimit();

      // Mock system clock going backwards
      const pastTime = 1000000000000 - 30000; // 30 seconds in the past
      Date.now = jest.fn(() => pastTime);

      // Should still function correctly (not reset window)
      const info = rateLimiter.getRateLimitInfo();
      expect(info.remaining).toBe(1);
    });

    it('should handle very large time jumps forward', async () => {
      rateLimiter = new RateLimiter(2, 1);

      // Use both requests
      await rateLimiter.checkLimit();
      await rateLimiter.checkLimit();

      // Mock huge time jump forward
      const futureTime = 1000000000000 + (365 * 24 * 60 * 60 * 1000); // 1 year later
      Date.now = jest.fn(() => futureTime);

      // Should reset and allow new requests
      await expect(rateLimiter.checkLimit()).resolves.toBeUndefined();
    });
  });

  describe('performance', () => {
    it('should handle many rapid requests efficiently', async () => {
      rateLimiter = new RateLimiter(1000, 1);

      const start = Date.now();
      
      // Make many requests
      for (let i = 0; i < 500; i++) {
        await rateLimiter.checkLimit();
      }

      const end = Date.now();
      const duration = end - start;

      // Should complete quickly (this is a rough performance test)
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });
});