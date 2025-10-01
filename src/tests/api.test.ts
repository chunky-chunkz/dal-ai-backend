import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { buildApp } from '../app';

describe('API Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.server)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        version: expect.any(String)
      });
    });
  });

  describe('POST /api/answer', () => {
    it('should return answer for valid question', async () => {
      const response = await request(app.server)
        .post('/api/answer')
        .send({ question: 'What is your refund policy?' })
        .expect(200);

      expect(response.body).toMatchObject({
        answer: expect.any(String),
        confidence: expect.any(Number)
      });

      if (response.body.sourceId) {
        expect(response.body.sourceId).toEqual(expect.any(String));
      }

      expect(response.body.confidence).toBeGreaterThan(0);
      expect(response.body.confidence).toBeLessThanOrEqual(1);
      expect(response.body.answer).toContain('30-day');
    });

    it('should return answer for shipping question', async () => {
      const response = await request(app.server)
        .post('/api/answer')
        .send({ question: 'How long does delivery take?' })
        .expect(200);

      expect(response.body).toMatchObject({
        answer: expect.any(String),
        confidence: expect.any(Number)
      });

      if (response.body.sourceId) {
        expect(response.body.sourceId).toEqual(expect.any(String));
      }

      expect(response.body.confidence).toBeGreaterThan(0);
      expect(response.body.answer.toLowerCase()).toMatch(/shipping|delivery|days/);
    });

    it('should return answer for payment question', async () => {
      const response = await request(app.server)
        .post('/api/answer')
        .send({ question: 'What payment methods do you accept?' })
        .expect(200);

      expect(response.body).toMatchObject({
        answer: expect.any(String),
        confidence: expect.any(Number)
      });

      if (response.body.sourceId) {
        expect(response.body.sourceId).toEqual(expect.any(String));
      }

      expect(response.body.confidence).toBeGreaterThan(0);
      expect(response.body.answer.toLowerCase()).toMatch(/payment|credit|card|paypal/);
    });

    it('should return default answer for unmatched question', async () => {
      const response = await request(app.server)
        .post('/api/answer')
        .send({ question: 'completelyunmatchablequestionxyz789' })
        .expect(200);

      expect(response.body).toMatchObject({
        answer: expect.any(String),
        confidence: 0.3 // Answer service returns 0.3 for uncertain answers
      });

      expect(response.body.answer).toContain("Ich bin unsicher");
      expect(response.body.sourceId).toBeUndefined();
    });

    it('should return 400 for empty question', async () => {
      await request(app.server)
        .post('/api/answer')
        .send({ question: '' })
        .expect(400);
    });

    it('should return 400 for missing question', async () => {
      await request(app.server)
        .post('/api/answer')
        .send({})
        .expect(400);
    });

    it('should handle invalid JSON', async () => {
      await request(app.server)
        .post('/api/answer')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400); // JSON parse errors return 400 in new error handler
    });
  });

  describe('POST /api/feedback', () => {
    it('should accept positive feedback', async () => {
      const response = await request(app.server)
        .post('/api/feedback')
        .send({
          question: 'What is your refund policy?',
          helpful: true,
          sourceId: '1'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true
      });
    });

    it('should accept negative feedback', async () => {
      const response = await request(app.server)
        .post('/api/feedback')
        .send({
          question: 'What is your refund policy?',
          helpful: false,
          sourceId: '1'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true
      });
    });

    it('should accept feedback without sourceId', async () => {
      const response = await request(app.server)
        .post('/api/feedback')
        .send({
          question: 'Some question without match',
          helpful: false
        })
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true
      });
    });

    it('should return 400 for missing question', async () => {
      await request(app.server)
        .post('/api/feedback')
        .send({
          helpful: true
        })
        .expect(400);
    });

    it('should return 400 for missing helpful field', async () => {
      await request(app.server)
        .post('/api/feedback')
        .send({
          question: 'Some question'
        })
        .expect(400);
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app.server)
        .get('/api/unknown')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        statusCode: 404
      });
    });
  });
});
