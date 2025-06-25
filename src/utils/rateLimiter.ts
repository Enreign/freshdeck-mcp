import { RateLimitInfo } from '../core/types.js';
import { RateLimitError } from './errors.js';

interface RateLimitState {
  count: number;
  resetAt: Date;
}

export class RateLimiter {
  private state: RateLimitState;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = 50, windowMinutes: number = 1) {
    this.limit = limit;
    this.windowMs = windowMinutes * 60 * 1000;
    this.state = {
      count: 0,
      resetAt: new Date(Date.now() + this.windowMs),
    };
  }

  public async checkLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if expired
    if (now >= this.state.resetAt.getTime()) {
      this.state = {
        count: 0,
        resetAt: new Date(now + this.windowMs),
      };
    }

    // Check if limit exceeded
    if (this.state.count >= this.limit) {
      const waitTime = Math.ceil((this.state.resetAt.getTime() - now) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Please wait ${waitTime} seconds before retrying.`,
        waitTime
      );
    }

    // Increment counter
    this.state.count++;
  }

  public getRateLimitInfo(): RateLimitInfo {
    const now = Date.now();
    
    // Reset if window expired
    if (now >= this.state.resetAt.getTime()) {
      this.state = {
        count: 0,
        resetAt: new Date(now + this.windowMs),
      };
    }

    return {
      limit: this.limit,
      remaining: Math.max(0, this.limit - this.state.count),
      resetAt: this.state.resetAt,
    };
  }

  public updateFromHeaders(headers: Record<string, any>): void {
    // Freshdesk returns rate limit info in headers
    const limit = headers['x-ratelimit-total'];
    const remaining = headers['x-ratelimit-remaining'];
    // const used = headers['x-ratelimit-used-current-request']; // For future use
    
    if (limit && remaining !== undefined) {
      this.state.count = this.limit - parseInt(remaining, 10);
    }
  }

  public reset(): void {
    this.state = {
      count: 0,
      resetAt: new Date(Date.now() + this.windowMs),
    };
  }

  public getWaitTime(): number {
    const now = Date.now();
    if (this.state.count < this.limit) {
      return 0;
    }
    return Math.max(0, this.state.resetAt.getTime() - now);
  }
}