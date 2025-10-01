/**
 * E2E tests for /api/answer and /api/answer/stream endpoints
 * Requirements:
 * - /api/answer with known question -> 200, has answer string, confidence >= 0.55 (if index built)
 * - invalid body -> 400
 * - stream endpoint returns text/event-stream, emits some tokens, ends with [DONE]
 * - Mock vectorStore for deterministic tests or run with a small fixture index
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { buildApp } from '../src/app.js';

describe('Answer API E2E Tests', () => {
  let app: FastifyInstance;
  let server: any;

  beforeAll(async () => {
    // Build app with test configuration
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

      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /api/answer - JSON Endpoint', () => {
    it('should return answer with confidence >= 0.55 for known payment question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Wie bezahle ich meine Rechnung?' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.55);
      expect(typeof response.body.answer).toBe('string');
      expect(response.body.answer.length).toBeGreaterThan(10);
      
      // Should have sourceId if matched from index
      if (response.body.confidence > 0.7) {
        expect(response.body).toHaveProperty('sourceId');
      }
    });

    it('should return answer with confidence >= 0.55 for known internet question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Internet ist langsam, was kann ich tun?' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.55);
      expect(response.body.answer.toLowerCase()).toMatch(/internet|speedtest|geschwindigkeit|langsam/);
    });

    it('should handle sensitive questions with guardrails (high confidence escalation)', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Ich möchte kündigen wegen rechtlicher Probleme' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.9); // Guardrails give high confidence
      expect(response.body.answer.toLowerCase()).toMatch(/support|ticket|spezialisten|rechtlich/);
    });

    it('should handle PII questions with guardrails (masked and escalated)', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Meine Email ist test@example.com, brauche Hilfe' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeGreaterThanOrEqual(0.9);
      expect(response.body.answer.toLowerCase()).toMatch(/persönlich|mitarbeiter|support|ticket/);
    });

    it('should return low confidence for nonsense question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'xyz alien spaceship quantum flux dimensions' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.confidence).toBeLessThanOrEqual(0.4);
      expect(typeof response.body.answer).toBe('string');
    });

    // Invalid input tests
    it('should return 400 for missing question field', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.details).toBeInstanceOf(Array);
      expect(response.body.details[0]).toHaveProperty('field', 'question');
      expect(response.body.details[0]).toHaveProperty('message', 'Required');
    });

    it('should return 400 for question too short', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: 'Hi' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.details[0]).toHaveProperty('message', 'Question must be at least 3 characters long');
    });

    it('should return 400 for question too long', async () => {
      const longQuestion = 'A'.repeat(501);
      const response = await request(server)
        .post('/api/answer')
        .send({ question: longQuestion })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.details[0]).toHaveProperty('message', 'Question must not exceed 500 characters');
    });

    it('should return 400 for empty question', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ question: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    it('should return 400 for invalid body structure', async () => {
      const response = await request(server)
        .post('/api/answer')
        .send({ invalidField: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(server)
        .post('/api/answer')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Fastify should handle malformed JSON and return 400
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/answer/stream - Server-Sent Events Endpoint', () => {
    it('should return text/event-stream for valid question with tokens and [DONE]', async () => {
      const question = encodeURIComponent('Wie bezahle ich meine Rechnung?');
      
      const response = await request(server)
        .get(`/api/answer/stream?question=${question}`)
        .expect(200);

      // Check SSE headers
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
      
      // Check response contains streaming data and completion marker
      expect(response.text).toMatch(/data: /); // Should have data events
      expect(response.text).toContain('data: [DONE]'); // Should end with [DONE]
      
      // Extract actual content (remove SSE formatting)
      const dataLines = response.text.split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.substring(6))
        .filter(line => line && line !== '[DONE]');
      
      const streamedContent = dataLines.join('');
      expect(streamedContent.length).toBeGreaterThan(10); // Should have substantial content
    });

    it('should stream sensitive question with fast guardrails escalation', async () => {
      const question = encodeURIComponent('Ich möchte kündigen wegen rechtlicher Probleme');
      
      const response = await request(server)
        .get(`/api/answer/stream?question=${question}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.text).toContain('data: [DONE]');
      
      // Should contain escalation response
      const streamedContent = response.text.split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.substring(6))
        .filter(line => line && line !== '[DONE]')
        .join('')
        .toLowerCase();
      
      expect(streamedContent).toMatch(/support|ticket|spezialisten|rechtlich/);
    });

    it('should stream PII question with masking and escalation', async () => {
      const question = encodeURIComponent('Meine Email ist user@test.com, brauche Hilfe');
      
      const response = await request(server)
        .get(`/api/answer/stream?question=${question}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.text).toContain('data: [DONE]');
      
      const streamedContent = response.text.split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.substring(6))
        .filter(line => line && line !== '[DONE]')
        .join('')
        .toLowerCase();
      
      // Should be escalated, not contain the original email
      expect(streamedContent).toMatch(/persönlich|mitarbeiter|support/);
      expect(streamedContent).not.toContain('user@test.com'); // Email should be masked
    });

    it('should stream multiple data events for longer responses', async () => {
      const question = encodeURIComponent('Internet ist langsam, was kann ich tun?');
      
      const response = await request(server)
        .get(`/api/answer/stream?question=${question}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      
      // Count data events (should be multiple for streaming)
      const dataEvents = response.text.split('\n')
        .filter(line => line.startsWith('data: '))
        .length;
      
      expect(dataEvents).toBeGreaterThan(5); // Should have multiple streaming chunks
      expect(response.text).toContain('data: [DONE]');
    });

    // Invalid query parameter tests
    it('should return 400 for missing question parameter', async () => {
      const response = await request(server)
        .get('/api/answer/stream')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'Invalid query parameters');
      expect(response.body.details[0]).toHaveProperty('field', 'question');
      expect(response.body.details[0]).toHaveProperty('message', 'Required');
    });

    it('should return 400 for question too short in stream', async () => {
      const question = encodeURIComponent('Hi');
      
      const response = await request(server)
        .get(`/api/answer/stream?question=${question}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.details[0]).toHaveProperty('message', 'Question must be at least 3 characters long');
    });

    it('should return 400 for question too long in stream', async () => {
      const longQuestion = encodeURIComponent('A'.repeat(501));
      
      const response = await request(server)
        .get(`/api/answer/stream?question=${longQuestion}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.details[0]).toHaveProperty('message', 'Question must not exceed 500 characters');
    });

    it('should return 400 for empty question in stream', async () => {
      const response = await request(server)
        .get('/api/answer/stream?question=')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    it('should handle special characters in URL encoding', async () => {
      const question = encodeURIComponent('Was kostet Roaming in der EU? €-Preise?');
      
      const response = await request(server)
        .get(`/api/answer/stream?question=${question}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.text).toContain('data: [DONE]');
    });
  });

  describe('Integration Tests - Caching and Performance', () => {
    it('should serve cached responses faster on second request', async () => {
      const question = 'Wie bezahle ich meine Rechnung?';
      
      // First request (cache miss)
      const start1 = Date.now();
      const response1 = await request(server)
        .post('/api/answer')
        .send({ question })
        .expect(200);
      const time1 = Date.now() - start1;
      
      // Second request (cache hit)
      const start2 = Date.now();
      const response2 = await request(server)
        .post('/api/answer')
        .send({ question })
        .expect(200);
      const time2 = Date.now() - start2;
      
      // Results should be identical
      expect(response1.body.answer).toBe(response2.body.answer);
      expect(response1.body.confidence).toBe(response2.body.confidence);
      
      // Second request should be significantly faster (cache hit)
      if (response1.body.confidence > 0.7) { // Only if we got a good answer worth caching
        expect(time2).toBeLessThan(time1 * 0.5); // At least 50% faster
      }
    });

    it('should handle concurrent requests without issues', async () => {
      const question = 'Internet ist langsam';
      
      // Send 5 concurrent requests
      const promises = Array(5).fill(null).map(() =>
        request(server)
          .post('/api/answer')
          .send({ question })
          .expect(200)
      );
      
      const responses = await Promise.all(promises);
      
      // All responses should be valid
      responses.forEach(response => {
        expect(response.body).toHaveProperty('answer');
        expect(response.body).toHaveProperty('confidence');
        expect(response.body).toHaveProperty('timestamp');
      });
      
      // All responses should be identical (same question)
      const firstAnswer = responses[0].body.answer;
      responses.forEach(response => {
        expect(response.body.answer).toBe(firstAnswer);
      });
    });

    it('should handle both JSON and streaming for same question consistently', async () => {
      const question = 'Wie bezahle ich meine Rechnung?';
      
      // Get JSON response
      const jsonResponse = await request(server)
        .post('/api/answer')
        .send({ question })
        .expect(200);
      
      // Get streaming response
      const encodedQuestion = encodeURIComponent(question);
      const streamResponse = await request(server)
        .get(`/api/answer/stream?question=${encodedQuestion}`)
        .expect(200);
      
      // Extract streamed content
      const streamedContent = streamResponse.text.split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.substring(6))
        .filter(line => line && line !== '[DONE]')
        .join('');
      
      // Both should give similar answers for the same question
      expect(jsonResponse.body.answer).toBe(streamedContent);
    });
  });
});
