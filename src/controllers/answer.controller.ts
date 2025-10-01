/**
 * Task: Extract or create sessionId:
 * - Read from cookie "sid" or header "x-session-id"; if missing, create UUID and set cookie.
 * - Pass sessionId down to service so the memory can be updated per conversation.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { answerQuestion } from '../services/answer.service.js';
import { ragLocalAnswerStream } from '../ai/rag.local.js';

/**
 * Input validation schema for answer requests
 */
const AnswerRequestSchema = z.object({
  question: z.string()
    .min(3, 'Question must be at least 3 characters long')
    .max(500, 'Question must not exceed 500 characters')
    .trim()
});

/**
 * Input validation schema for streaming answer requests (query parameters)
 */
const AnswerStreamQuerySchema = z.object({
  question: z.string()
    .min(3, 'Question must be at least 3 characters long')
    .max(500, 'Question must not exceed 500 characters')
    .trim()
});

/**
 * Extract or create sessionId from request (supports both header and query param for SSE)
 * @param request Fastify request object
 * @returns sessionId string
 */
function extractOrCreateSessionId(request: FastifyRequest): string {
  // Try to get sessionId from header first
  const headerSessionId = request.headers['x-session-id'] as string;
  if (headerSessionId && typeof headerSessionId === 'string' && headerSessionId.trim().length > 0) {
    return headerSessionId.trim();
  }
  
  // For SSE, also check query parameters (since SSE can't send custom headers)
  const queryParams = request.query as { sessionId?: string };
  const querySessionId = queryParams.sessionId;
  if (querySessionId && typeof querySessionId === 'string' && querySessionId.trim().length > 0) {
    return querySessionId.trim();
  }
  
  // Generate new sessionId if not found
  const newSessionId = uuidv4();
  return newSessionId;
}

/**
 * Handle POST /api/answer requests - Normal JSON response
 * @param request Fastify request object
 * @param reply Fastify reply object
 */
export async function postAnswer(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<void> {
  try {
    // Zod validation for request body
    const validationResult = AnswerRequestSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      await reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid input data',
        details: validationResult.error.errors.map(err => ({
          field: err.path.join('.') || 'question',
          message: err.message
        }))
      });
      return;
    }

    const { question } = validationResult.data;

    // Extract or create sessionId
    const sessionId = extractOrCreateSessionId(request);

    // Extract user ID from session (for memory system)
    const userId = request.userId; // Set by auth middleware if user is logged in

    // If user is logged in, extract and store memories from the question
    // NOTE: Memory processing is now handled by the new memory system in answer.service.ts
    // if (userId) {
    //   await processAndStoreMemories(question, userId);
    // }

    // Get user memories for context (if user is logged in)
    // NOTE: Memory context is now handled by the new memory system in answer.service.ts
    let memoryContext = '';
    // if (userId) {
    //   memoryContext = await createMemoryContext(userId);
    // }

    // Call answer service with sessionId, memory context, and userId for memory integration
    const result = await answerQuestion(question, sessionId, memoryContext, userId);

    // Return JSON response
    await reply.status(200).send({
      answer: result.answer,
      confidence: result.confidence,
      sourceId: result.sourceId, // undefined if no match
      timestamp: result.timestamp,
      sessionId: sessionId
    });

  } catch (error) {
    // Log error for debugging but never expose stack traces to client
    console.error('Error in answer controller:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      // Don't log stack trace in production
      stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
    });
    
    // Return safe error response
    await reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your request',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle GET /api/answer/stream - Server-Sent Events streaming
 * Task: Implement SSE controller for GET /api/answer/stream?question=...
 * Requirements:
 * - Validate query param "question" (min length 3, zod).
 * - Set SSE headers with CORS_ORIGIN support
 * - Use ragLocalAnswerStream with AbortSignal support
 * - Handle client disconnect gracefully
 * - Never leak stack traces; on error send "[ERROR]" then end.
 * 
 * Robust Disconnect Handling:
 * - Create AbortController per request; pass signal to ragLocalAnswerStream/localLLM.stream
 * - req.raw.on("close", () => controller.abort()) for client disconnects
 * - Catch AbortError separately; do not log as error; just end gracefully
 * - Clean up event listeners to prevent memory leaks
 */
export async function streamAnswer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const abortController = new AbortController();
  let streamClosed = false;
  
  // Event listener cleanup function
  const handleDisconnect = () => {
    if (!streamClosed) {
      console.log('Client disconnected from stream');
      streamClosed = true;
      abortController.abort();
    }
  };

  const cleanup = () => {
    request.raw.removeListener('close', handleDisconnect);
    request.raw.removeListener('aborted', handleDisconnect);
  };
  
  try {
    // Parse question from query parameters (?question=...)
    const queryParams = request.query as { question?: string };
    
    // Zod validation for query parameters
    const validationResult = AnswerStreamQuerySchema.safeParse({
      question: queryParams.question
    });
    
    if (!validationResult.success) {
      await reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: validationResult.error.errors.map(err => ({
          field: err.path.join('.') || 'question',
          message: err.message
        }))
      });
      return;
    }

    const { question } = validationResult.data;

    // Extract or create sessionId
    const sessionId = extractOrCreateSessionId(request);

    // Set Server-Sent Events headers as specified
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    await reply.type('text/event-stream');
    await reply.headers({
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': corsOrigin
    });

    // Helper function to send SSE data
    const send = (data: string): void => {
      if (streamClosed) return;
      try {
        reply.raw.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error('Error writing to stream:', error);
        streamClosed = true;
      }
    };

    // Attach event listeners for client disconnect
    request.raw.on('close', handleDisconnect);
    request.raw.on('aborted', handleDisconnect);

    // Use ragLocalAnswerStream with AbortSignal and sessionId
    const stream = ragLocalAnswerStream(question, abortController.signal, 3, false, sessionId);
    
    // Set up token passthrough
    stream.onToken((chunk: string) => {
      send(chunk);
    });

    // Wait for completion
    const result = await stream.done();
    
    if (!streamClosed) {
      // Log completion stats for debugging
      console.log(`Stream completed for question: "${question.substring(0, 50)}..." - Confidence: ${(result.confidence * 100).toFixed(1)}%, Sources: ${result.sourceIds.length}`);
      
      // On finish: send("[DONE]") and end the response
      send('[DONE]');
      reply.raw.end();
      
      // Clean up event listeners
      cleanup();
    }

  } catch (error) {
    if (!streamClosed) {
      // Handle AbortError separately - do not log as error, just end cleanly
      if (error instanceof Error && (
        error.name === 'AbortError' || 
        error.message.includes('aborted') ||
        error.message.includes('Request was aborted')
      )) {
        console.log('Stream was aborted due to client disconnect - ending gracefully');
        try {
          reply.raw.end();
        } catch (endError) {
          console.error('Error ending aborted stream:', endError);
        }
        cleanup();
        return;
      }
      
      // Log other errors for debugging but never expose stack traces to client
      console.error('Error in answer stream controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        // Only log stack in development
        ...(process.env.NODE_ENV === 'development' && error instanceof Error && { stack: error.stack })
      });
      
      try {
        // On error send "[ERROR]" then end
        reply.raw.write(`data: [ERROR]\n\n`);
        reply.raw.end();
      } catch (writeError) {
        console.error('Error writing error response to stream:', writeError);
      }
      
      // Clean up event listeners
      cleanup();
    }
  }
}

/**
 * Register answer routes
 * @param fastify Fastify instance
 */
export async function registerAnswerRoutes(fastify: any): Promise<void> {
  // POST /api/answer - Get answer for a question (JSON response)
  fastify.post('/api/answer', {
    schema: {
      description: 'Get an answer for a question using keyword search',
      tags: ['Answer'],
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            minLength: 3,
            maxLength: 500,
            description: 'The question to get an answer for (3-500 characters)'
          }
        },
        example: {
          question: "Wie lange habe ich Zeit, die Rechnung zu bezahlen?"
        }
      },
      response: {
        200: {
          type: 'object',
          required: ['answer', 'confidence', 'timestamp'],
          properties: {
            answer: { 
              type: 'string',
              description: 'The answer text'
            },
            confidence: { 
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score (0.0 to 1.0)'
            },
            sourceId: { 
              type: 'string',
              description: 'FAQ source ID (only present for matched answers)'
            },
            timestamp: { 
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp in ISO format'
            }
          },
          example: {
            answer: "Die Zahlungsfrist beträgt 30 Tage ab Rechnungsdatum.",
            confidence: 0.85,
            sourceId: "rechnung-frist",
            timestamp: "2025-09-02T10:30:00.000Z"
          }
        },
        400: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          required: ['error', 'message', 'timestamp'],
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, postAnswer);

  // GET /api/answer/stream - Get streaming answer (Server-Sent Events)
  fastify.get('/api/answer/stream', {
    schema: {
      description: 'Get a streaming answer for a question using Server-Sent Events',
      tags: ['Answer'],
      querystring: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            minLength: 3,
            maxLength: 500,
            description: 'The question to get an answer for (3-500 characters)'
          }
        }
      },
      response: {
        200: {
          type: 'string',
          description: 'Server-Sent Events stream with answer tokens and completion marker'
        },
        400: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, streamAnswer);
}
