import { FastifyInstance } from 'fastify';
import { HealthController } from '../controllers/health.controller.js';

export async function healthRoutes(fastify: FastifyInstance) {
  // Health check route
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
            timestamp: { type: 'string' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, HealthController.getHealth);
}
