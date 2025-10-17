/**
 * Document Management API Routes
 * 
 * Endpoints for uploading, searching, and managing documents
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  processDocument, 
  searchDocuments, 
  listDocuments, 
  deleteDocument 
} from '../services/document.service.js';
import { optionalAuth } from '../middleware/authGuard.js';

// Request interfaces
interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
}

interface SearchQuery {
  query: string;
  topK?: number;
}

interface DeleteParams {
  documentId: string;
}

/**
 * Register document routes
 */
export async function documentRoutes(fastify: FastifyInstance) {
  
  /**
   * POST /documents/upload
   * Upload and process a text document (as JSON)
   */
  fastify.post<{
    Body: { content: string; filename: string; userId?: string }
  }>('/documents/upload', {
    preHandler: optionalAuth
  }, async (request, reply: FastifyReply) => {
    try {
      const body = request.body as { content: string; filename: string; userId?: string };
      const { content, filename } = body;
      
      // Get userId from authenticated request or from body (for testing)
      const userId = (request as AuthenticatedRequest).userId || body.userId;
      
      // Check file extension
      const isValidFile = filename.endsWith('.txt') || 
                         filename.toLowerCase().endsWith('.pdf') ||
                         filename.toLowerCase().endsWith('.docx');
      if (!isValidFile) {
        return reply.status(400).send({
          success: false,
          error: 'Only .txt, .pdf and .docx files are currently supported'
        });
      }
      
      console.log(`📤 Document upload: ${filename} (${content.length} bytes), userId: ${userId || 'none'}`);
      
      // Process document
      const result = await processDocument(
        content, 
        filename, 
        userId
      );
      
      return reply.send(result);
      
    } catch (error) {
      console.error('❌ Error uploading document:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });
  
  /**
   * GET /documents/search
   * Search documents using semantic similarity
   */
  fastify.get<{
    Querystring: SearchQuery
  }>('/documents/search', {
    preHandler: optionalAuth
  }, async (request, reply: FastifyReply) => {
    try {
      const { query, topK = 5 } = request.query;
      
      console.log(`🔍 Document search: "${query}" (top ${topK})`);
      
      const results = await searchDocuments(query, topK);
      
      return reply.send({
        success: true,
        results: results.map(result => ({
          id: result.id,
          documentId: result.documentId,
          filename: result.filename,
          text: result.text,
          chunkIndex: result.chunkIndex,
          score: result.score
        })),
        count: results.length
      });
      
    } catch (error) {
      console.error('❌ Error searching documents:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * GET /documents
   * List all indexed documents
   */
  fastify.get('/documents', {
    preHandler: optionalAuth,
    schema: {
      description: 'List all indexed documents',
      tags: ['Documents'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  uploadedAt: { type: 'string' },
                  uploadedBy: { type: 'string' },
                  chunkCount: { type: 'number' }
                }
              }
            },
            count: { type: 'number' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const documents = await listDocuments();
      
      return reply.send({
        success: true,
        documents,
        count: documents.length
      });
      
    } catch (error) {
      console.error('❌ Error listing documents:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * DELETE /documents/:documentId
   * Delete a document
   */
  fastify.delete<{
    Params: DeleteParams
  }>('/documents/:documentId', {
    preHandler: optionalAuth
  }, async (request, reply: FastifyReply) => {
    try {
      const { documentId } = request.params;
      
      const success = await deleteDocument(documentId);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Document not found'
        });
      }
      
      return reply.send({
        success: true,
        message: 'Document deleted successfully'
      });
      
    } catch (error) {
      console.error('❌ Error deleting document:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
