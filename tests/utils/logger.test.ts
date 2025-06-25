// Mock pino before any imports
const mockChildLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
};

const mockLogger = {
  child: jest.fn().mockReturnValue(mockChildLogger),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
};

const mockPino = jest.fn().mockReturnValue(mockLogger);

jest.mock('pino', () => mockPino);

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset environment variables
    delete process.env['LOG_LEVEL'];
    delete process.env['NODE_ENV'];
    
    // Reset mock
    mockPino.mockReturnValue(mockLogger);
    mockLogger.child.mockReturnValue(mockChildLogger);
  });

  describe('logger configuration', () => {
    it('should create logger with default configuration', () => {
      // Import after setup
      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith({
        name: 'freshdesk-mcp',
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      });
    });

    it('should use custom log level from environment', () => {
      process.env['LOG_LEVEL'] = 'debug';

      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });

    it('should not use pretty transport in production', () => {
      process.env['NODE_ENV'] = 'production';

      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith({
        name: 'freshdesk-mcp',
        level: 'info',
        transport: undefined,
      });
    });

    it('should handle empty LOG_LEVEL environment variable', () => {
      process.env['LOG_LEVEL'] = '';

      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info', // Should fallback to default
        })
      );
    });
  });

  describe('createLogger', () => {
    it('should create child logger with component name', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      const componentLogger = createLogger('test-component');

      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'test-component' });
      expect(componentLogger).toBeDefined();
    });

    it('should create child logger for different components', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      createLogger('api-client');
      createLogger('authenticator');
      createLogger('rate-limiter');

      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'api-client' });
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'authenticator' });
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'rate-limiter' });
    });

    it('should handle empty component name', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      const componentLogger = createLogger('');

      expect(mockLogger.child).toHaveBeenCalledWith({ component: '' });
      expect(componentLogger).toBeDefined();
    });

    it('should handle special characters in component name', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      createLogger('test-component_with-special@chars');

      expect(mockLogger.child).toHaveBeenCalledWith({ 
        component: 'test-component_with-special@chars' 
      });
    });

    it('should handle unicode characters in component name', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      createLogger('测试组件');

      expect(mockLogger.child).toHaveBeenCalledWith({ component: '测试组件' });
    });
  });

  describe('logger methods', () => {
    let componentLogger: any;

    beforeEach(() => {
      const { createLogger } = require('../../src/utils/logger.js');
      componentLogger = createLogger('test');
    });

    it('should expose standard logging methods', () => {
      expect(componentLogger.debug).toBeDefined();
      expect(componentLogger.info).toBeDefined();
      expect(componentLogger.warn).toBeDefined();
      expect(componentLogger.error).toBeDefined();
      expect(componentLogger.fatal).toBeDefined();
      expect(componentLogger.trace).toBeDefined();
    });

    it('should call debug method', () => {
      componentLogger.debug('debug message');
      componentLogger.debug({ data: 'test' }, 'debug with object');

      expect(componentLogger.debug).toHaveBeenCalledWith('debug message');
      expect(componentLogger.debug).toHaveBeenCalledWith({ data: 'test' }, 'debug with object');
    });

    it('should call info method', () => {
      componentLogger.info('info message');
      componentLogger.info({ data: 'test' }, 'info with object');

      expect(componentLogger.info).toHaveBeenCalledWith('info message');
      expect(componentLogger.info).toHaveBeenCalledWith({ data: 'test' }, 'info with object');
    });

    it('should call warn method', () => {
      componentLogger.warn('warning message');
      componentLogger.warn({ error: 'minor issue' }, 'warning with object');

      expect(componentLogger.warn).toHaveBeenCalledWith('warning message');
      expect(componentLogger.warn).toHaveBeenCalledWith({ error: 'minor issue' }, 'warning with object');
    });

    it('should call error method', () => {
      componentLogger.error('error message');
      componentLogger.error({ error: new Error('test') }, 'error with object');

      expect(componentLogger.error).toHaveBeenCalledWith('error message');
      expect(componentLogger.error).toHaveBeenCalledWith({ error: new Error('test') }, 'error with object');
    });
  });

  describe('environment variable validation', () => {
    const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

    validLogLevels.forEach(level => {
      it(`should accept valid log level: ${level}`, () => {
        process.env['LOG_LEVEL'] = level;

        require('../../src/utils/logger.js');

        expect(mockPino).toHaveBeenCalledWith(
          expect.objectContaining({
            level: level,
          })
        );
      });
    });

    it('should handle invalid log level gracefully', () => {
      process.env['LOG_LEVEL'] = 'invalid';

      require('../../src/utils/logger.js');

      // Pino will handle invalid levels internally
      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'invalid', // Passed as-is, pino handles validation
        })
      );
    });
  });

  describe('transport configuration', () => {
    it('should configure pretty transport with correct options', () => {
      process.env['NODE_ENV'] = 'development';

      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        })
      );
    });

    it('should disable transport in production environment', () => {
      process.env['NODE_ENV'] = 'production';

      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: undefined,
        })
      );
    });

    it('should use pretty transport when NODE_ENV is not set', () => {
      delete process.env['NODE_ENV'];

      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        })
      );
    });

    it('should use pretty transport for test environment', () => {
      process.env['NODE_ENV'] = 'test';

      require('../../src/utils/logger.js');

      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        })
      );
    });
  });

  describe('logger instance', () => {
    it('should export main logger instance', () => {
      const { logger } = require('../../src/utils/logger.js');
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('object');
    });

    it('should export createLogger function', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      expect(createLogger).toBeDefined();
      expect(typeof createLogger).toBe('function');
    });
  });

  describe('multiple component loggers', () => {
    it('should create independent component loggers', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      createLogger('component1');
      createLogger('component2');

      expect(mockLogger.child).toHaveBeenCalledTimes(2);
      expect(mockLogger.child).toHaveBeenNthCalledWith(1, { component: 'component1' });
      expect(mockLogger.child).toHaveBeenNthCalledWith(2, { component: 'component2' });
    });

    it('should allow same component name multiple times', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      createLogger('same-component');
      createLogger('same-component');

      expect(mockLogger.child).toHaveBeenCalledTimes(2);
      expect(mockLogger.child).toHaveBeenNthCalledWith(1, { component: 'same-component' });
      expect(mockLogger.child).toHaveBeenNthCalledWith(2, { component: 'same-component' });
    });
  });

  describe('edge cases', () => {
    it('should handle null component name', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      createLogger(null as any);

      expect(mockLogger.child).toHaveBeenCalledWith({ component: null });
    });

    it('should handle undefined component name', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      createLogger(undefined as any);

      expect(mockLogger.child).toHaveBeenCalledWith({ component: undefined });
    });

    it('should handle very long component names', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      const longName = 'a'.repeat(1000);
      createLogger(longName);

      expect(mockLogger.child).toHaveBeenCalledWith({ component: longName });
    });

    it('should handle component names with newlines', () => {
      const { createLogger } = require('../../src/utils/logger.js');
      const nameWithNewlines = 'component\nwith\nnewlines';
      createLogger(nameWithNewlines);

      expect(mockLogger.child).toHaveBeenCalledWith({ component: nameWithNewlines });
    });
  });
});