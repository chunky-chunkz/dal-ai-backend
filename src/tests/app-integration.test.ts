import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app';
import { FastifyInstance } from 'fastify';

describe('App Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
    });
  });

  describe('Authentication Routes', () => {
    it('should have local auth routes available', async () => {
      // Test local auth register endpoint exists
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {} // Invalid payload to trigger validation error
      });

      // Should return validation error (400), not 404
      expect(response.statusCode).toBe(400);
    });

    it('should have Microsoft auth status endpoint available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/ms/enabled'
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('enabled');
      expect(data).toHaveProperty('provider');
      expect(data.provider).toBe('microsoft');
    });

    it('should have user profile endpoint available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me'
      });

      // Should return 401 unauthorized (not 404)
      expect(response.statusCode).toBe(401);
    });

    it('should have auth providers endpoint available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/providers'
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('local');
      expect(data).toHaveProperty('microsoft');
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET'
        }
      });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Route Registration', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route'
      });

      expect(response.statusCode).toBe(404);
      
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Not Found');
    });
  });
});

console.log('✅ App integration tests completed');
