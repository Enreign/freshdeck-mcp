import { FreshdeskConfig } from '../core/types.js';

export class Authenticator {
  private apiKey: string;
  private domain: string;

  constructor(config: FreshdeskConfig) {
    this.apiKey = config.apiKey;
    this.domain = config.domain;

    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('API key is required for Freshdesk authentication');
    }

    if (!this.domain) {
      throw new Error('Domain is required for Freshdesk authentication');
    }

    // Validate domain format
    if (!this.validateDomain(this.domain)) {
      throw new Error('Invalid domain format. Expected format: yourcompany.freshdesk.com or yourcompany');
    }
  }

  public validateDomain(domain: string): boolean {
    // Reject empty or whitespace-only domains
    if (!domain || domain.trim() === '') {
      return false;
    }

    // Reject localhost and IP addresses for security
    if (domain === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
      return false;
    }

    // Reject domains with consecutive hyphens
    if (domain.includes('--')) {
      return false;
    }

    // Accept both full domain and subdomain only (minimum 2 characters)
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;
    const fullDomainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.freshdesk\.com$/;

    return domainPattern.test(domain) || fullDomainPattern.test(domain);
  }

  public getAuthHeader(): Record<string, string> {
    // Freshdesk uses Basic Auth with API key as username and 'X' as password
    const credentials = Buffer.from(`${this.apiKey}:X`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  public getBaseUrl(): string {
    // Ensure domain has .freshdesk.com suffix
    const fullDomain = this.domain.includes('.freshdesk.com')
      ? this.domain
      : `${this.domain}.freshdesk.com`;

    return `https://${fullDomain}/api/v2`;
  }

  public validateApiKey(apiKey?: string | null): boolean {
    // Called with no argument: validate the stored key (length check only, legacy behaviour)
    if (apiKey === undefined) {
      return this.apiKey.length > 0 && this.apiKey.length <= 64;
    }
    // Called with an explicit value: strict format validation
    if (apiKey === null) {
      return false;
    }
    // Alphanumeric, hyphens, underscores only; min 4, max 64 chars
    return /^[a-zA-Z0-9_-]{4,64}$/.test(apiKey);
  }

  public getDomain(): string {
    return this.domain;
  }

  public maskApiKey(): string {
    if (this.apiKey.length <= 8) {
      return '****';
    }
    return `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`;
  }
}
