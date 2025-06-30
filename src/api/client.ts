import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { FreshdeskConfig, RateLimitInfo } from '../core/types.js';
import { Authenticator } from '../auth/authenticator.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { parseAxiosError, isRetryableError, FreshdeskError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { TicketsAPI, ContactsAPI, AgentsAPI, CompaniesAPI, ConversationsAPI } from './resources/index.js';

const logger = createLogger('api-client');

export class FreshdeskClient {
  private axios: AxiosInstance;
  private authenticator: Authenticator;
  private rateLimiter: RateLimiter;
  private config: FreshdeskConfig;

  // Resource APIs
  public tickets: TicketsAPI;
  public contacts: ContactsAPI;
  public agents: AgentsAPI;
  public companies: CompaniesAPI;
  public conversations: ConversationsAPI;

  constructor(config: FreshdeskConfig) {
    this.config = config;
    this.authenticator = new Authenticator(config);
    this.rateLimiter = new RateLimiter(
      config.rateLimitPerMinute || 50,
      1 // 1 minute window
    );

    this.axios = axios.create({
      baseURL: this.authenticator.getBaseUrl(),
      timeout: config.timeout || 30000,
      headers: this.authenticator.getAuthHeader(),
    });

    // Request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug({
          method: config.method,
          url: config.url,
          params: config.params,
        }, 'API request');
        return config;
      },
      (error) => {
        logger.error({ error }, 'Request interceptor error');
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and rate limit updates
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug({
          status: response.status,
          url: response.config.url,
        }, 'API response');
        
        // Update rate limiter from headers
        this.rateLimiter.updateFromHeaders(response.headers);
        
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error({
            status: error.response.status,
            url: error.config?.url,
            data: error.response.data,
          }, 'API error response');
        } else {
          logger.error({ error }, 'API request failed');
        }
        return Promise.reject(error);
      }
    );

    // Initialize resource APIs
    this.tickets = new TicketsAPI(this);
    this.contacts = new ContactsAPI(this);
    this.agents = new AgentsAPI(this);
    this.companies = new CompaniesAPI(this);
    this.conversations = new ConversationsAPI(this);
  }

  public async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    switch (method) {
      case 'GET':
        return this.get<T>(path, config);
      case 'POST':
        return this.post<T>(path, data, config);
      case 'PUT':
        return this.put<T>(path, data, config);
      case 'DELETE':
        return this.delete<T>(path, config);
      case 'PATCH':
        return this.patch<T>(path, data, config);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  private async executeWithRetry<T>(
    request: () => Promise<AxiosResponse<T>>,
    retries: number = 0
  ): Promise<T> {
    try {
      // Check rate limit before making request
      await this.rateLimiter.checkLimit();
      
      const response = await request();
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const freshdeskError = parseAxiosError(error);
        
        // Handle retryable errors
        if (isRetryableError(freshdeskError) && retries < (this.config.maxRetries || 3)) {
          const delay = this.calculateRetryDelay(retries, freshdeskError);
          logger.info({
            error: freshdeskError.message,
            retries: retries + 1,
            delay,
          }, 'Retrying request');
          
          await this.delay(delay);
          return this.executeWithRetry(request, retries + 1);
        }
        
        throw freshdeskError;
      }
      
      throw error;
    }
  }

  private calculateRetryDelay(retryCount: number, error: FreshdeskError): number {
    // For rate limit errors, use the retry-after value if available
    if (error.code === 'RATE_LIMIT_ERROR' && (error as any).retryAfter) {
      return (error as any).retryAfter * 1000;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, retryCount), 30000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(() => this.axios.get<T>(path, config));
  }

  public async post<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(() => this.axios.post<T>(path, data, config));
  }

  public async put<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(() => this.axios.put<T>(path, data, config));
  }

  public async patch<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(() => this.axios.patch<T>(path, data, config));
  }

  public async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(() => this.axios.delete<T>(path, config));
  }

  public getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getRateLimitInfo();
  }

  public async testConnection(): Promise<boolean> {
    try {
      // Test with a simple API call to get current agent
      await this.get('/agents/me');
      logger.info('API connection test successful');
      return true;
    } catch (error) {
      logger.error({ error }, 'API connection test failed');
      return false;
    }
  }
}