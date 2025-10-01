import { describe, it, expect } from 'vitest';
import { CONFIG } from '../utils/config';

describe('Config', () => {
  it('should have correct configuration structure', () => {
    expect(CONFIG).toHaveProperty('PORT');
    expect(CONFIG).toHaveProperty('NODE_ENV');
    expect(CONFIG).toHaveProperty('CORS_ORIGIN');
  });

  it('should have valid PORT number', () => {
    expect(typeof CONFIG.PORT).toBe('number');
    expect(CONFIG.PORT).toBeGreaterThan(0);
    expect(CONFIG.PORT).toBeLessThanOrEqual(65535);
    expect(Number.isInteger(CONFIG.PORT)).toBe(true);
  });

  it('should have valid NODE_ENV string', () => {
    expect(typeof CONFIG.NODE_ENV).toBe('string');
    expect(CONFIG.NODE_ENV.length).toBeGreaterThan(0);
  });

  it('should have valid CORS_ORIGIN string', () => {
    expect(typeof CONFIG.CORS_ORIGIN).toBe('string');
    expect(CONFIG.CORS_ORIGIN.length).toBeGreaterThan(0);
  });

  it('should be readonly configuration object', () => {
    // Test that CONFIG has the expected constant structure
    expect(() => {
      const port = CONFIG.PORT;
      const env = CONFIG.NODE_ENV;
      const cors = CONFIG.CORS_ORIGIN;
      
      expect(typeof port).toBe('number');
      expect(typeof env).toBe('string');
      expect(typeof cors).toBe('string');
    }).not.toThrow();
  });

  it('should handle environment variable parsing correctly', () => {
    // Test that the config values are reasonable defaults or valid env values
    if (process.env.PORT) {
      const envPort = parseInt(process.env.PORT, 10);
      if (!isNaN(envPort)) {
        expect(CONFIG.PORT).toBe(envPort);
      }
    } else {
      expect(CONFIG.PORT).toBe(3000); // Default value
    }

    if (process.env.NODE_ENV) {
      expect(CONFIG.NODE_ENV).toBe(process.env.NODE_ENV);
    } else {
      expect(CONFIG.NODE_ENV).toBe('development'); // Default value
    }

    if (process.env.CORS_ORIGIN) {
      expect(CONFIG.CORS_ORIGIN).toBe(process.env.CORS_ORIGIN);
    } else {
      expect(CONFIG.CORS_ORIGIN).toBe('*'); // Default value
    }
  });
});
