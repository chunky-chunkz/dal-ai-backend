import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

describe('AnswerController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/answer', () => {
    it('should return answer for valid question with minimum length', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'return'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('answer');
      expect(body).toHaveProperty('confidence');
      expect(body).toHaveProperty('timestamp');
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
      expect(body.answer).toContain('30-day');
    });

    it('should return answer for shipping question', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'How long does shipping take?'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.answer.toLowerCase()).toMatch(/shipping|delivery|days/);
      expect(body).toHaveProperty('sourceId');
      expect(body).toHaveProperty('timestamp');
    });

    it('should return answer for payment question', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'What payment methods do you accept?'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.answer.toLowerCase()).toMatch(/payment|credit|card/);
      expect(body).toHaveProperty('sourceId');
    });

    it('should return uncertain answer for unmatched question', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'completely unrelated question about aliens'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.confidence).toBe(0.3);
      expect(body.answer).toBe('Ich bin unsicher – soll ich ein Ticket erstellen?');
      expect(body.sourceId).toBeUndefined();
    });

    it('should return 400 for question shorter than 3 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'hi'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error'); // Fastify uses this by default
      expect(body.message).toContain('3 characters');
    });

    it('should return 400 for empty question', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: ''
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
      expect(body.message).toContain('3 characters');
    });

    it('should return 400 for missing question field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
      expect(body.message).toContain('question');
    });

    it('should handle type coercion for numeric question', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 123
        }
      });

      // Fastify will coerce 123 to "123", which is >= 3 chars, so it should succeed
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('answer');
      expect(body).toHaveProperty('confidence');
      expect(body).toHaveProperty('timestamp');
    });

    it('should handle invalid JSON gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: '{"invalid": json}',
        headers: {
          'content-type': 'application/json'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should include timestamp in response', async () => {
      const beforeTime = new Date().toISOString();
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: {
          question: 'test question'
        }
      });

      const afterTime = new Date().toISOString();
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('timestamp');
      
      const responseTime = new Date(body.timestamp).toISOString();
      expect(responseTime >= beforeTime).toBe(true);
      expect(responseTime <= afterTime).toBe(true);
    });
  });
});
