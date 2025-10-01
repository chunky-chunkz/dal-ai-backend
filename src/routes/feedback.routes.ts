import { FastifyInstance } from 'fastify';
import { feedbackController } from '../controllers/feedback.controller.js';

export async function feedbackRoutes(fastify: FastifyInstance) {
  // POST /api/feedback
  fastify.post('/api/feedback', {
    schema: {
      description: 'Submit feedback for an answer',
      tags: ['feedback'],
      body: {
        type: 'object',
        required: ['question', 'helpful'],
        properties: {
          question: { 
            type: 'string',
            minLength: 1,
            description: 'The original question that was asked'
          },
          helpful: {
            type: 'boolean',
            description: 'Whether the answer was helpful or not'
          },
          sourceId: {
            type: 'string',
            description: 'Optional ID of the FAQ that provided the answer'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['ok'],
          properties: {
            ok: { 
              type: 'boolean',
              enum: [true],
              description: 'Success indicator'
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          required: ['ok'],
          properties: {
            ok: { 
              type: 'boolean',
              enum: [false],
              description: 'Error indicator'
            }
          }
        }
      }
    }
  }, feedbackController.submitFeedback.bind(feedbackController));
}
