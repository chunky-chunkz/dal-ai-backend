import { FastifyInstance } from 'fastify';
import { ChatbotController } from '../controllers/chatbot.controller.js';

// Create a singleton instance of the controller
const chatbotController = new ChatbotController();

export async function chatbotRoutes(fastify: FastifyInstance) {
  // Initialize the controller when routes are registered
  await chatbotController.initialize();

  // POST /api/answer
  fastify.post('/api/answer', {
    schema: {
      description: 'Get answer for a question',
      tags: ['chatbot'],
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { 
            type: 'string',
            minLength: 1,
            description: 'The question to ask the chatbot'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        },
        400: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            confidence: { type: 'number' }
          }
        },
        500: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            confidence: { type: 'number' }
          }
        }
      }
    }
  }, chatbotController.getAnswer.bind(chatbotController));
}
