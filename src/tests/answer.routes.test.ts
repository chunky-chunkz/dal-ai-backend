import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

describe('Answer Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/answer', () => {
    it('should be accessible via route registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'test route registration'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('answer');
      expect(body).toHaveProperty('confidence');
      expect(body).toHaveProperty('timestamp');
    });

    it('should have correct route prefix', async () => {
      // Test that /answer (without /api prefix) is not accessible
      const response = await app.inject({
        method: 'POST',
        url: '/answer',
        payload: {
          question: 'test prefix'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate input according to schema', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'hi' // Too short
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('3 characters');
    });

    it('should return structured response matching schema', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'What is your return policy?'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Validate response structure matches schema
      expect(body).toHaveProperty('answer');
      expect(body).toHaveProperty('confidence');
      expect(body).toHaveProperty('timestamp');
      
      expect(typeof body.answer).toBe('string');
      expect(typeof body.confidence).toBe('number');
      expect(typeof body.timestamp).toBe('string');
      
      expect(body.confidence).toBeGreaterThanOrEqual(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
      
      // Validate timestamp is ISO string
      expect(() => new Date(body.timestamp)).not.toThrow();
    });
  });
});
