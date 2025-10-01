/**
 * Aufgabe: Vitest + Supertest E2E-Tests.
 * - /health -> 200, {status:"ok"}
 * - /api/answer mit bekannter Frage -> 200, confidence >= 0.7
 * - /api/answer mit Unsinn -> 200, confidence <= 0.4
 * - /api/answer mit invalid body -> 400
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { buildApp } from '../app';

describe('Answer API E2E Tests', () => {
  let app: FastifyInstance;
  let server: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    server = app.server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('POST /api/answer', () => {
    it('should return answer with high confidence for known question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Wie kann ich meine Rechnung einsehen?' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
      expect(typeof response.body.answer).toBe('string');
      expect(response.body.answer.length).toBeGreaterThan(0);
    });

    it('should return answer with high confidence for roaming question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Was kostet Roaming im Ausland?' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
      expect(response.body.answer.toLowerCase()).toMatch(/roaming|ausland|eu/);
    });

    it('should return answer with high confidence for SIM question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Meine SIM-Karte funktioniert nicht' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
      expect(response.body.answer.toLowerCase()).toMatch(/sim|karte|ersatz/);
    });

    it('should return low confidence for nonsense question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'xyz completely unrelated alien spaceship quantum flux' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeLessThanOrEqual(0.4);
      expect(typeof response.body.answer).toBe('string');
    });

    it('should return low confidence for random words', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'blubberfish wonderbread flying carpets' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeLessThanOrEqual(0.4);
    });

    it('should return 400 for missing question field', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('question');
    });

    it('should return 400 for empty question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: '' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for question too short', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'hi' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('fewer than 3 characters');
    });

    it('should return 400 for invalid body structure', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ invalidField: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(server)
        .post('/api/answer')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});