/**
 * Aufgabe: POST /api/feedback -> 200, {ok:true}; invalid -> 400
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { buildApp } from '../src/app';

describe('Feedback API E2E Tests', () => {
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

  describe('POST /api/feedback', () => {
    it('should return 200 with ok:true for valid positive feedback', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: 'Wie kann ich meine Rechnung einsehen?',
          helpful: true,
          sourceId: '1'
        })
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should return 200 with ok:true for valid negative feedback', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: 'Was kostet Roaming im Ausland?',
          helpful: false,
          sourceId: '2'
        })
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should return 200 with ok:true for feedback without sourceId', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: 'Meine SIM-Karte funktioniert nicht',
          helpful: false
        })
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should return 200 with ok:true for long question', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: 'Ich habe ein Problem mit meiner monatlichen Rechnung und verstehe nicht alle Positionen. Können Sie mir dabei helfen?',
          helpful: true,
          sourceId: '3'
        })
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should return 400 for missing question field', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          helpful: true,
          sourceId: '1'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('question');
    });

    it('should return 400 for missing helpful field', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: 'Test question',
          sourceId: '1'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('helpful');
    });

    it('should return 400 for empty question', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: '',
          helpful: true
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid helpful value', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: 'Test question',
          helpful: 'maybe'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for completely invalid body', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          invalidField: 'test',
          anotherInvalid: 123
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for null values', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: null,
          helpful: null
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for wrong data types', async () => {
      const response = await request(server)
        .post('/api/feedback')
        .send({
          question: 123,
          helpful: 'yes'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});
