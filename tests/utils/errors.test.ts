import { AxiosError } from 'axios';
import {
  FreshdeskError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  PermissionError,
  parseAxiosError,
  isRetryableError,
} from '../../src/utils/errors.js';
import { ApiError } from '../../src/core/types.js';

describe('Error Classes', () => {
  describe('FreshdeskError', () => {
    it('should create error with message and code', () => {
      const error = new FreshdeskError('Test error', 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('FreshdeskError');
      expect(error.statusCode).toBeUndefined();
    });

    it('should create error with status code', () => {
      const error = new FreshdeskError('Test error', 'TEST_ERROR', 500);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should extend Error class', () => {
      const error = new FreshdeskError('Test error', 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FreshdeskError);
    });

    it('should have proper error stack', () => {
      const error = new FreshdeskError('Test error', 'TEST_ERROR');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('FreshdeskError');
    });
  });

  describe('AuthenticationError', () => {
    it('should create with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error).toBeInstanceOf(FreshdeskError);
    });

    it('should create with custom message', () => {
      const error = new AuthenticationError('Invalid API key');

      expect(error.message).toBe('Invalid API key');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('RateLimitError', () => {
    it('should create with default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBeUndefined();
    });

    it('should create with custom message and retry after', () => {
      const error = new RateLimitError('Custom rate limit message', 60);

      expect(error.message).toBe('Custom rate limit message');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });

    it('should have rate limit properties', () => {
      const error = new RateLimitError();
      error.limit = 100;
      error.remaining = 0;

      expect(error.limit).toBe(100);
      expect(error.remaining).toBe(0);
    });
  });

  describe('ValidationError', () => {
    it('should create with message only', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBeUndefined();
    });

    it('should create with message and field', () => {
      const error = new ValidationError('Email is required', 'email');

      expect(error.message).toBe('Email is required');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe('email');
    });
  });

  describe('NotFoundError', () => {
    it('should create with resource name only', () => {
      const error = new NotFoundError('Ticket');

      expect(error.message).toBe('Ticket not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should create with resource name and string id', () => {
      const error = new NotFoundError('Ticket', 'abc123');

      expect(error.message).toBe('Ticket with id abc123 not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should create with resource name and numeric id', () => {
      const error = new NotFoundError('Ticket', 123);

      expect(error.message).toBe('Ticket with id 123 not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('PermissionError', () => {
    it('should create with default message', () => {
      const error = new PermissionError();

      expect(error.message).toBe('Permission denied');
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.statusCode).toBe(403);
    });

    it('should create with custom message', () => {
      const error = new PermissionError('Insufficient privileges');

      expect(error.message).toBe('Insufficient privileges');
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.statusCode).toBe(403);
    });
  });
});

describe('parseAxiosError', () => {
  const createAxiosError = (
    status: number,
    data?: any,
    headers?: Record<string, string>,
    url?: string,
    message?: string
  ): AxiosError => {
    return {
      name: 'AxiosError',
      message: message || `Request failed with status code ${status}`,
      isAxiosError: true,
      toJSON: () => ({}),
      response: {
        status,
        data,
        headers: headers || {},
        statusText: '',
        config: { url } as any,
      },
      config: { url } as any,
    } as AxiosError;
  };

  describe('network errors', () => {
    it('should handle network error without response', () => {
      const axiosError: AxiosError = {
        name: 'AxiosError',
        message: 'Network Error',
        isAxiosError: true,
        toJSON: () => ({}),
        config: {} as any,
      } as AxiosError;

      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(FreshdeskError);
      expect(error.message).toBe('Network Error');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBeUndefined();
    });

    it('should handle network error with custom message', () => {
      const axiosError: AxiosError = {
        name: 'AxiosError',
        message: 'Connection timeout',
        isAxiosError: true,
        toJSON: () => ({}),
        config: {} as any,
      } as AxiosError;

      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Connection timeout');
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('should handle network error without message', () => {
      const axiosError: AxiosError = {
        name: 'AxiosError',
        isAxiosError: true,
        toJSON: () => ({}),
        config: {} as any,
      } as AxiosError;

      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Network error occurred');
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('401 Unauthorized', () => {
    it('should parse 401 error without API error data', () => {
      const axiosError = createAxiosError(401);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid API key');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
    });

    it('should parse 401 error with API error message', () => {
      const apiError: ApiError = {
        message: 'API key is invalid',
        code: 'INVALID_API_KEY',
      };
      const axiosError = createAxiosError(401, apiError);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('API key is invalid');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('403 Forbidden', () => {
    it('should parse 403 error without API error data', () => {
      const axiosError = createAxiosError(403);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(PermissionError);
      expect(error.message).toBe('Access forbidden');
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.statusCode).toBe(403);
    });

    it('should parse 403 error with API error message', () => {
      const apiError: ApiError = {
        message: 'You do not have permission to access this resource',
        code: 'ACCESS_DENIED',
      };
      const axiosError = createAxiosError(403, apiError);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(PermissionError);
      expect(error.message).toBe('You do not have permission to access this resource');
    });
  });

  describe('404 Not Found', () => {
    it('should parse 404 error without URL', () => {
      const axiosError = createAxiosError(404);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should parse 404 error with URL', () => {
      const axiosError = createAxiosError(404, null, {}, '/api/v2/tickets/123');
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Resource with id /api/v2/tickets/123 not found');
    });
  });

  describe('429 Rate Limit', () => {
    it('should parse 429 error without retry-after header', () => {
      const axiosError = createAxiosError(429);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect((error as RateLimitError).retryAfter).toBeUndefined();
    });

    it('should parse 429 error with retry-after header', () => {
      const axiosError = createAxiosError(
        429,
        null,
        { 'retry-after': '60' }
      );
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfter).toBe(60);
    });

    it('should parse 429 error with API error message', () => {
      const apiError: ApiError = {
        message: 'Rate limit exceeded. Try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      };
      const axiosError = createAxiosError(429, apiError);
      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Rate limit exceeded. Try again later.');
    });
  });

  describe('400 Bad Request', () => {
    it('should parse 400 error as validation error', () => {
      const axiosError = createAxiosError(400);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should parse 400 error with field and errors', () => {
      const apiError: ApiError = {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        field: 'email',
        errors: [
          { field: 'email', message: 'Email is required', code: 'REQUIRED' },
          { field: 'email', message: 'Email format is invalid', code: 'INVALID_FORMAT' },
        ],
      };
      const axiosError = createAxiosError(400, apiError);
      const error = parseAxiosError(axiosError) as ValidationError;

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.field).toBe('email');
      expect(error.errors).toHaveLength(2);
      expect(error.errors![0]).toEqual({
        field: 'email',
        message: 'Email is required',
        code: 'REQUIRED',
      });
    });
  });

  describe('422 Unprocessable Entity', () => {
    it('should parse 422 error as validation error', () => {
      const axiosError = createAxiosError(422);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400); // ValidationError always uses 400
    });

    it('should parse 422 error with validation details', () => {
      const apiError: ApiError = {
        message: 'Entity validation failed',
        code: 'VALIDATION_ERROR',
        errors: [
          { field: 'subject', message: 'Subject cannot be empty', code: 'EMPTY' },
        ],
      };
      const axiosError = createAxiosError(422, apiError);
      const error = parseAxiosError(axiosError) as ValidationError;

      expect(error.message).toBe('Entity validation failed');
      expect(error.errors).toHaveLength(1);
    });
  });

  describe('500+ Server Errors', () => {
    it('should parse 500 error as generic error', () => {
      const axiosError = createAxiosError(500);
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(FreshdeskError);
      expect(error.message).toBe('Request failed with status 500');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should parse 503 error with API error data', () => {
      const apiError: ApiError = {
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      };
      const axiosError = createAxiosError(503, apiError);
      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
    });

    it('should handle server error with errors array', () => {
      const apiError: ApiError = {
        message: 'Multiple server errors',
        code: 'SERVER_ERROR',
        errors: [
          { field: 'system', message: 'Database connection failed', code: 'DB_ERROR' },
        ],
      };
      const axiosError = createAxiosError(500, apiError);
      const error = parseAxiosError(axiosError);

      expect(error.errors).toHaveLength(1);
      expect(error.errors?.[0]?.message).toBe('Database connection failed');
    });
  });

  describe('unknown status codes', () => {
    it('should handle unknown status codes', () => {
      const axiosError = createAxiosError(418); // I'm a teapot
      const error = parseAxiosError(axiosError);

      expect(error).toBeInstanceOf(FreshdeskError);
      expect(error.message).toBe('Request failed with status 418');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(418);
    });

    it('should handle unknown status with API error', () => {
      const apiError: ApiError = {
        message: 'Custom error message',
        code: 'CUSTOM_ERROR',
      };
      const axiosError = createAxiosError(418, apiError);
      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Custom error message');
      expect(error.code).toBe('CUSTOM_ERROR');
    });
  });

  describe('malformed responses', () => {
    it('should handle null response data', () => {
      const axiosError = createAxiosError(500, null);
      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Request failed with status 500');
      expect(error.code).toBe('API_ERROR');
    });

    it('should handle undefined response data', () => {
      const axiosError = createAxiosError(500, undefined);
      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Request failed with status 500');
      expect(error.code).toBe('API_ERROR');
    });

    it('should handle empty response data', () => {
      const axiosError = createAxiosError(500, {});
      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Request failed with status 500');
      expect(error.code).toBe('API_ERROR');
    });

    it('should handle malformed API error data', () => {
      const axiosError = createAxiosError(500, { invalid: 'data' });
      const error = parseAxiosError(axiosError);

      expect(error.message).toBe('Request failed with status 500');
      expect(error.code).toBe('API_ERROR');
    });
  });
});

describe('isRetryableError', () => {
  it('should return true for network errors', () => {
    const error = new FreshdeskError('Network error', 'NETWORK_ERROR');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for rate limit errors', () => {
    const error = new RateLimitError();
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 500 errors', () => {
    const error = new FreshdeskError('Internal server error', 'SERVER_ERROR', 500);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 502 errors', () => {
    const error = new FreshdeskError('Bad gateway', 'BAD_GATEWAY', 502);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 503 errors', () => {
    const error = new FreshdeskError('Service unavailable', 'SERVICE_UNAVAILABLE', 503);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for 504 errors', () => {
    const error = new FreshdeskError('Gateway timeout', 'GATEWAY_TIMEOUT', 504);
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for authentication errors', () => {
    const error = new AuthenticationError();
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for permission errors', () => {
    const error = new PermissionError();
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for validation errors', () => {
    const error = new ValidationError('Invalid input');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for not found errors', () => {
    const error = new NotFoundError('Resource');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for 4xx client errors', () => {
    const error = new FreshdeskError('Client error', 'CLIENT_ERROR', 400);
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for errors without status code', () => {
    const error = new FreshdeskError('Generic error', 'GENERIC_ERROR');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should handle edge case status codes', () => {
    // Test boundary conditions
    const error499 = new FreshdeskError('Client error', 'CLIENT_ERROR', 499);
    expect(isRetryableError(error499)).toBe(false);

    const error500 = new FreshdeskError('Server error', 'SERVER_ERROR', 500);
    expect(isRetryableError(error500)).toBe(true);

    const error599 = new FreshdeskError('Server error', 'SERVER_ERROR', 599);
    expect(isRetryableError(error599)).toBe(true);
  });
});

describe('Error serialization', () => {
  it('should preserve error properties when serialized', () => {
    const error = new FreshdeskError('Test error', 'TEST_ERROR', 500);
    error.field = 'test_field';
    error.errors = [{ field: 'test', message: 'Test message', code: 'TEST' }];

    const serialized = JSON.parse(JSON.stringify(error));

    expect(serialized.message).toBe('Test error');
    expect(serialized.code).toBe('TEST_ERROR');
    expect(serialized.statusCode).toBe(500);
    expect(serialized.field).toBe('test_field');
    expect(serialized.errors).toHaveLength(1);
  });

  it('should handle circular references in errors array', () => {
    const error = new FreshdeskError('Test error', 'TEST_ERROR');
    const circularError = { field: 'test', message: 'Test', code: 'TEST', parent: error };
    error.errors = [circularError as any];

    // Should not throw when stringifying
    expect(() => JSON.stringify(error)).not.toThrow();
  });
});

describe('Error inheritance chain', () => {
  it('should maintain proper inheritance chain', () => {
    const authError = new AuthenticationError();
    
    expect(authError instanceof Error).toBe(true);
    expect(authError instanceof FreshdeskError).toBe(true);
    expect(authError instanceof AuthenticationError).toBe(true);
  });

  it('should work with instanceof checks', () => {
    const errors = [
      new AuthenticationError(),
      new RateLimitError(),
      new ValidationError('test'),
      new NotFoundError('test'),
      new PermissionError(),
    ];

    errors.forEach(error => {
      expect(error instanceof FreshdeskError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });
});