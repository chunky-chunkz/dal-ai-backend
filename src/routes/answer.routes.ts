import { FastifyInstance } from 'fastify';
import { postAnswer, streamAnswer } from '../controllers/answer.controller.js';
import { optionalAuth } from '../middleware/authGuard.js';

/**
 * Route registrieren für POST /api/answer -> Controller
 * Prefix kommt in app.ts via /api
 */
export async function answerRoutes(fastify: FastifyInstance) {
  // POST /answer (wird zu /api/answer durch app-level prefix)
  fastify.post('/answer', {
    preHandler: optionalAuth,
    schema: {
      description: 'Get an answer for a question using AI/heuristic search',
      tags: ['Answer'],
      summary: 'Answer a question',
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            minLength: 3,
            description: 'The question to get an answer for (minimum 3 characters)'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            answer: {
              type: 'string',
              description: 'The answer to the question'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score of the answer (0-1)'
            },
            sourceId: {
              type: 'string',
              description: 'ID of the source FAQ (if found)'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO timestamp of when the answer was generated'
            }
          },
          required: ['answer', 'confidence', 'timestamp']
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              },
              description: 'Detailed validation errors'
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    }
  } as any, postAnswer);

  // GET /answer/stream - Server-Sent Events streaming answer
  fastify.get('/answer/stream', {
    preHandler: optionalAuth,
    schema: {
      description: 'Get a streaming answer for a question using Server-Sent Events',
      tags: ['Answer'],
      summary: 'Stream answer tokens in real-time',
      querystring: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            minLength: 3,
            maxLength: 500,
            description: 'The question to get an answer for (minimum 3 characters)'
          },
          sessionId: {
            type: 'string',
            description: 'Optional session ID for conversation continuity'
          }
        }
      },
      response: {
        200: {
          description: 'Server-Sent Events stream',
          type: 'string',
          contentType: 'text/event-stream'
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              },
              description: 'Detailed validation errors'
            }
          }
        }
      }
    }
  } as any, streamAnswer);
}
