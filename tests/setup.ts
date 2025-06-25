import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment
process.env['NODE_ENV'] = 'test';

// Mock timers for rate limit tests
jest.useFakeTimers();

// Global test utilities
export const mockApiResponse = <T>(data: T, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
});

export const mockApiError = (status: number, message: string, code?: string) => ({
  response: {
    status,
    data: {
      message,
      code: code || 'ERROR',
    },
    headers: {},
  },
  isAxiosError: true,
  config: {},
  message,
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});