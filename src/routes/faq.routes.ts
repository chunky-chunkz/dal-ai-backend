import { FastifyInstance } from 'fastify';
import { getAllFaqs, getFaqById, createFaq, updateFaq, deleteFaq } from '../controllers/faq.controller.js';

export async function faqRoutes(fastify: FastifyInstance) {
  // Get all FAQs
  fastify.get('/api/faqs', {
    schema: {
      description: 'Get all FAQ entries',
      tags: ['faqs'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              answer: { type: 'string' },
              synonyms: { 
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, getAllFaqs);

  // Get FAQ by ID
  fastify.get('/api/faqs/:id', {
    schema: {
      description: 'Get FAQ by ID',
      tags: ['faqs'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            answer: { type: 'string' },
            synonyms: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, getFaqById);

  // Create new FAQ (optional CRUD)
  fastify.post('/api/faqs', {
    schema: {
      description: 'Create new FAQ entry',
      tags: ['faqs'],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1 },
          answer: { type: 'string', minLength: 1 },
          synonyms: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['title', 'answer']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            answer: { type: 'string' },
            synonyms: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, createFaq);

  // Update FAQ (optional CRUD)
  fastify.put('/api/faqs/:id', {
    schema: {
      description: 'Update FAQ entry',
      tags: ['faqs'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1 },
          answer: { type: 'string', minLength: 1 },
          synonyms: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['title', 'answer']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            answer: { type: 'string' },
            synonyms: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, updateFaq);

  // Delete FAQ (optional CRUD)
  fastify.delete('/api/faqs/:id', {
    schema: {
      description: 'Delete FAQ entry',
      tags: ['faqs'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            deletedId: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, deleteFaq);
}
