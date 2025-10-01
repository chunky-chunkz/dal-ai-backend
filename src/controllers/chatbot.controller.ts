import { FastifyRequest, FastifyReply } from 'fastify';
import { ChatbotService } from '../services/chatbot.service.js';
import { AnswerRequest, AnswerRequestSchema, AnswerResponse } from '../models/faq.model.js';

export class ChatbotController {
  private chatbotService: ChatbotService;

  constructor() {
    this.chatbotService = new ChatbotService();
  }

  /**
   * Initialize the controller
   */
  async initialize(): Promise<void> {
    await this.chatbotService.initialize();
  }

  /**
   * Handle POST /api/answer requests
   */
  async getAnswer(request: FastifyRequest, reply: FastifyReply): Promise<AnswerResponse> {
    try {
      // Validate request body
      const validatedBody = AnswerRequestSchema.parse(request.body);
      const answerRequest: AnswerRequest = validatedBody;

      // Process the question
      const response = await this.chatbotService.getAnswer(answerRequest);

      reply.code(200);
      return response;

    } catch (error) {
      request.log.error(`Error in getAnswer: ${error instanceof Error ? error.message : String(error)}`);

      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          answer: 'Invalid request format. Please provide a valid question.',
          confidence: 0
        };
      }

      reply.code(500);
      return {
        answer: 'Internal server error. Please try again later.',
        confidence: 0
      };
    }
  }
}
