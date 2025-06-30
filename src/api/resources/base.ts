import { FreshdeskClient } from '../client.js';

export abstract class BaseResource {
  protected client: FreshdeskClient;

  constructor(client: FreshdeskClient) {
    this.client = client;
  }

  protected buildQueryString(params: Record<string, any>): string {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    
    const queryString = queryParams.toString();
    return queryString ? `?${queryString}` : '';
  }
}