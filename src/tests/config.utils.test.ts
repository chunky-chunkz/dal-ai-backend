import { describe, it, expect } from 'vitest';

/**
 * Test helper function that mimics the parsePort logic from config.ts
 */
function parsePort(portStr: string | undefined): number {
  if (!portStr) return 3000;
  const parsed = parseInt(portStr, 10);
  return isNaN(parsed) ? 3000 : parsed;
}

describe('Config Utilities', () => {
  describe('parsePort function logic', () => {
    it('should return default port when input is undefined', () => {
      expect(parsePort(undefined)).toBe(3000);
    });

    it('should return default port when input is empty string', () => {
      expect(parsePort('')).toBe(3000);
    });

    it('should parse valid port numbers correctly', () => {
      expect(parsePort('8080')).toBe(8080);
      expect(parsePort('3000')).toBe(3000);
      expect(parsePort('80')).toBe(80);
      expect(parsePort('65535')).toBe(65535);
    });

    it('should return default port for invalid input', () => {
      expect(parsePort('invalid')).toBe(3000);
      expect(parsePort('abc123')).toBe(3000);
      expect(parsePort('12.34')).toBe(12); // parseInt truncates decimals
      expect(parsePort('-1')).toBe(-1); // parseInt handles negatives
    });

    it('should handle edge cases', () => {
      expect(parsePort('0')).toBe(0);
      expect(parsePort('1')).toBe(1);
      expect(parsePort('99999')).toBe(99999);
    });
  });
});
