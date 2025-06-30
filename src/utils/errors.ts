import { ApiError } from '../core/types.js';
import { AxiosError } from 'axios';

export class FreshdeskError extends Error {
  public code: string;
  public statusCode?: number;
  public field?: string;
  public errors?: Array<{ field: string; message: string; code: string }>;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'FreshdeskError';
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    const result: any = {
      name: this.name,
      message: this.message,
      code: this.code,
    };

    if (this.statusCode !== undefined) {
      result.statusCode = this.statusCode;
    }

    if (this.field !== undefined) {
      result.field = this.field;
    }

    if (this.errors !== undefined) {
      // Handle potential circular references by creating a clean copy
      try {
        result.errors = this.errors.map(error => ({
          field: error.field,
          message: error.message,
          code: error.code,
        }));
      } catch {
        result.errors = '[Circular Reference]';
      }
    }

    if (this.stack !== undefined) {
      result.stack = this.stack;
    }

    return result;
  }
}

export class AuthenticationError extends FreshdeskError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class RateLimitError extends FreshdeskError {
  public retryAfter?: number;
  public limit?: number;
  public remaining?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends FreshdeskError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

export class NotFoundError extends FreshdeskError {
  constructor(resource: string, id?: string | number) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
  }
}

export class PermissionError extends FreshdeskError {
  constructor(message = 'Permission denied') {
    super(message, 'PERMISSION_ERROR', 403);
  }
}

export function parseAxiosError(error: AxiosError): FreshdeskError {
  if (!error.response) {
    return new FreshdeskError(
      error.message || 'Network error occurred',
      'NETWORK_ERROR'
    );
  }

  const { status, data } = error.response;
  const apiError = data as ApiError;

  switch (status) {
    case 401:
      return new AuthenticationError(apiError?.message || 'Invalid API key');
    
    case 403:
      return new PermissionError(apiError?.message || 'Access forbidden');
    
    case 404:
      return new NotFoundError('Resource', error.config?.url);
    
    case 429:
      const retryAfter = error.response.headers['retry-after'];
      return new RateLimitError(
        apiError?.message || 'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) : undefined
      );
    
    case 400:
    case 422:
      const validationError = new ValidationError(
        apiError?.message || 'Validation failed'
      );
      if (apiError?.errors) {
        validationError.errors = apiError.errors;
      }
      if (apiError?.field) {
        validationError.field = apiError.field;
      }
      return validationError;
    
    default:
      const genericError = new FreshdeskError(
        apiError?.message || `Request failed with status ${status}`,
        apiError?.code || 'API_ERROR',
        status
      );
      if (apiError?.errors) {
        genericError.errors = apiError.errors;
      }
      return genericError;
  }
}

export function isRetryableError(error: FreshdeskError): boolean {
  // Retry on network errors, rate limits, and 5xx errors
  if (error.code === 'NETWORK_ERROR') return true;
  if (error.code === 'RATE_LIMIT_ERROR') return true;
  if (error.statusCode && error.statusCode >= 500) return true;
  return false;
}

export class ServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export class ToolExecutionError extends Error {
  public readonly toolName: string;
  public readonly originalError?: Error;

  constructor(message: string, toolName: string, originalError?: Error) {
    super(message);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.originalError = originalError;
  }
}