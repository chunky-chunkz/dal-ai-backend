/**
 * Example RAG integration with API endpoints
 * This shows how to integrate RAG with Fastify routes
 */

import { ragLocalAnswer, ragLocalAnswerStream } from '../ai/rag.local.js';

/**
 * Standard answer endpoint with RAG
 */
export async function handleRagAnswer(request: any, reply: any) {
  try {
    const { question, k = 3 } = request.body;
    
    if (!question || typeof question !== 'string') {
      return reply.status(400).send({
        error: 'Question is required and must be a string'
      });
    }

    const response = await ragLocalAnswer(question, k);
    
    return reply.send({
      answer: response.answer,
      confidence: response.confidence,
      sourceIds: response.sourceIds,
      timestamp: new Date().toISOString(),
      method: 'rag-local'
    });

  } catch (error) {
    console.error('RAG Answer Error:', error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Fehler beim Verarbeiten Ihrer Anfrage'
    });
  }
}

/**
 * Streaming answer endpoint with RAG
 * Returns Server-Sent Events (SSE) stream
 */
export async function handleRagAnswerStream(request: any, reply: any) {
  try {
    const { question, k = 3 } = request.body;
    
    if (!question || typeof question !== 'string') {
      return reply.status(400).send({
        error: 'Question is required and must be a string'
      });
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial metadata
    reply.raw.write(`data: ${JSON.stringify({
      type: 'start',
      timestamp: new Date().toISOString()
    })}\n\n`);

    let tokenCount = 0;
    
    // Start streaming - correct function signature
    const ragResult = ragLocalAnswerStream(question, undefined, k);
    
    // Register token callback
    ragResult.onToken((chunk: string) => {
      tokenCount++;
      reply.raw.write(`data: ${JSON.stringify({
        type: 'token',
        content: chunk,
        tokenCount
      })}\n\n`);
    });
    
    // Wait for completion
    const response = await ragResult.done();

    // Send final metadata
    reply.raw.write(`data: ${JSON.stringify({
      type: 'complete',
      answer: response.answer,
      confidence: response.confidence,
      sourceIds: response.sourceIds,
      totalTokens: tokenCount,
      timestamp: new Date().toISOString()
    })}\n\n`);

    reply.raw.end();

  } catch (error) {
    console.error('RAG Stream Error:', error);
    reply.raw.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Fehler beim Verarbeiten Ihrer Anfrage',
      timestamp: new Date().toISOString()
    })}\n\n`);
    reply.raw.end();
  }
}

/**
 * Example route registration for Fastify
 */
export function registerRagRoutes(fastify: any) {
  // Standard RAG endpoint
  fastify.post('/api/rag/answer', {
    schema: {
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string' },
          k: { type: 'number', minimum: 1, maximum: 10, default: 3 }
        }
      }
    }
  }, handleRagAnswer);

  // Streaming RAG endpoint
  fastify.post('/api/rag/stream', {
    schema: {
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string' },
          k: { type: 'number', minimum: 1, maximum: 10, default: 3 }
        }
      }
    }
  }, handleRagAnswerStream);

  // Health check endpoint for RAG
  fastify.get('/api/rag/health', async (_request: any, reply: any) => {
    try {
      const testResponse = await ragLocalAnswer('test', 1);
      return reply.send({
        status: 'healthy',
        ragAvailable: true,
        confidence: testResponse.confidence,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(503).send({
        status: 'unhealthy',
        ragAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Example usage in main server file:
 * 
 * import { registerRagRoutes } from './services/rag.api.js';
 * 
 * // In your server setup:
 * registerRagRoutes(fastify);
 */
