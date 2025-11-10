import type { FastifyRequest, FastifyReply } from 'fastify';
import { HealthResponse } from '../models/faq.model.js';

export default class HealthController {
  /**
   * Health check endpoint
   */
  static async getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<HealthResponse> {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    };

    reply.code(200);
    return response;
  }
}

