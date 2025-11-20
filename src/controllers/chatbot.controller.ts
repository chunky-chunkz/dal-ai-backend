import type { FastifyRequest, FastifyReply } from 'fastify';
import { AnswerRequest, AnswerRequestSchema, AnswerResponse } from '../models/faq.model.js';

// Upstream-URL zu deinem SSH-Server (übers ngrok)
const UPSTREAM_URL =
  process.env.LLM_SERVER_URL ??
  'https://jonas-clearstoried-implicitly.ngrok-free.dev';

export class ChatbotController {
  /**
   * Initialize the controller
   * (falls du später mal was brauchst – aktuell leer)
   */
  async initialize(): Promise<void> {
    console.log('🔗 ChatbotController initialized with upstream:', UPSTREAM_URL);
    // hier könnte man später z.B. Health-Checks machen
    return;
  }

  /**
   * Handle POST /api/answer requests
   */
  async getAnswer(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<AnswerResponse> {
    try {
      // Request-Body validieren
      const validatedBody = AnswerRequestSchema.parse(request.body);
      const answerRequest: AnswerRequest = validatedBody;

      request.log.info(`📤 Forwarding request to upstream: ${UPSTREAM_URL}/api/answer`);

      // 🔹 Request an deinen SSH-Server (DAL-AI) weiterleiten
      const upstreamResponse = await fetch(`${UPSTREAM_URL}/api/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(answerRequest),
      });

      if (!upstreamResponse.ok) {
        const text = await upstreamResponse.text();
        request.log.error(
          {
            status: upstreamResponse.status,
            body: text,
          },
          'Upstream LLM server returned error'
        );

        reply.code(500);
        return {
          answer: 'Upstream LLM error. Please try again later.',
          confidence: 0,
        };
      }

      const data = (await upstreamResponse.json()) as AnswerResponse;

      request.log.info('✅ Received response from upstream');

      reply.code(200);
      return data;
    } catch (error) {
      request.log.error(
        `Error in getAnswer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Zod-Validierungsfehler
      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          answer: 'Invalid request format. Please provide a valid question.',
          confidence: 0,
        };
      }

      // Fallback bei Netzwerk / sonstigen Fehlern
      reply.code(500);
      return {
        answer: 'Internal server error. Please try again later.',
        confidence: 0,
      };
    }
  }
}
