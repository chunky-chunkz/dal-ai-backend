import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';

// Mock pino module
vi.mock('pino');
vi.mock('../utils/config', () => ({
  CONFIG: {
    NODE_ENV: 'development'
  }
}));

describe('Logger', () => {
  const mockPino = vi.mocked(pino);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPino.mockReturnValue({} as any);
  });

  it('should create logger with pretty transport in development', async () => {
    vi.doMock('../utils/config', () => ({
      CONFIG: {
        NODE_ENV: 'development'
      }
    }));

    await import('../utils/logger');

    expect(mockPino).toHaveBeenCalledWith({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    });
  });

  it('should create logger without pretty transport in production', async () => {
    vi.doMock('../utils/config', () => ({
      CONFIG: {
        NODE_ENV: 'production'
      }
    }));

    // Clear module cache to get fresh import
    vi.resetModules();
    await import('../utils/logger');

    expect(mockPino).toHaveBeenCalledWith({
      level: 'info'
    });
  });

  it('should use info level in production', async () => {
    vi.doMock('../utils/config', () => ({
      CONFIG: {
        NODE_ENV: 'production'
      }
    }));

    vi.resetModules();
    await import('../utils/logger');

    const callArgs = mockPino.mock.calls[0][0];
    expect(callArgs).toHaveProperty('level', 'info');
  });

  it('should use debug level in development', async () => {
    vi.doMock('../utils/config', () => ({
      CONFIG: {
        NODE_ENV: 'development'
      }
    }));

    vi.resetModules();
    await import('../utils/logger');

    const callArgs = mockPino.mock.calls[0][0];
    expect(callArgs).toHaveProperty('level', 'debug');
  });

  it('should export logger as default', async () => {
    const mockLogger = { info: vi.fn(), debug: vi.fn() };
    mockPino.mockReturnValue(mockLogger as any);
    
    vi.resetModules();
    const { default: logger } = await import('../utils/logger');
    
    expect(logger).toBe(mockLogger);
  });
});
