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
import { optionalAuth, requireAuth } from '../middleware/authGuard.js';
import { getSession, getSessionData } from '../auth/session.js';
import { isAdminEmail } from '../auth/admin.js';

// Request interfaces
interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  sid?: string;
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
   * Requires authentication
   */
  fastify.post<{
    Body: { content: string; filename: string; userId?: string }
  }>('/documents/upload', {
    preHandler: requireAuth  // Changed from optionalAuth to requireAuth
  }, async (request, reply: FastifyReply) => {
    try {
      console.log('📥 [documents/upload] request received');
      const body = request.body as { content: string; filename: string; userId?: string };
      const { content, filename } = body;
      console.log('   🧾 body:', {
        filename,
        contentLen: content?.length,
        hasUserId: !!body.userId
      });
      
      // Get userId and user info from authenticated request
      const userId = (request as AuthenticatedRequest).userId!;
      const sid = (request as AuthenticatedRequest).sid;
      console.log('   👤 auth:', { userId, sid });
      
      // Get readable username from session
      let uploadedBy = userId; // Fallback to userId
      if (sid) {
        const sessionData = getSessionData(sid);
        if (sessionData?.user) {
          // Use name or email as display name
          uploadedBy = sessionData.user.name || sessionData.user.email || userId;
          console.log(`📝 User info: name=${sessionData.user.name}, email=${sessionData.user.email}`);
        }
      }
      
      // Check file extension
      const isValidFile = filename.endsWith('.txt') || 
                         filename.toLowerCase().endsWith('.pdf') ||
                         filename.toLowerCase().endsWith('.docx');
      if (!isValidFile) {
        console.warn('   ❌ invalid file extension:', filename);
        return reply.status(400).send({
          success: false,
          error: 'Only .txt, .pdf and .docx files are currently supported'
        });
      }
      
      console.log(`📤 Document upload: ${filename} (${content.length} bytes), uploadedBy: ${uploadedBy}`);
      
      const t0 = Date.now();
      // Process document with uploadedBy (readable name)
      const result = await processDocument(
        content, 
        filename, 
        userId,
        uploadedBy  // Pass the readable name
      );
      const dt = Date.now() - t0;
      console.log(`✅ processDocument finished in ${dt}ms -> chunks=${result.chunksCreated} facts=${result.memoriesExtracted}`);
      
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
   * Delete a document (only owner or admin)
   * Requires authentication
   */
  fastify.delete<{
    Params: DeleteParams
  }>('/documents/:documentId', {
    preHandler: requireAuth  // Changed from optionalAuth to requireAuth
  }, async (request, reply: FastifyReply) => {
    try {
      const { documentId } = request.params;
      const userId = (request as AuthenticatedRequest).userId!;
      const sid = (request as AuthenticatedRequest).sid;
      
      // Check if user is admin
      let isAdmin = false;
      if (sid) {
        const sessionData = getSessionData(sid);
        if (sessionData?.user?.email) {
          isAdmin = isAdminEmail(sessionData.user.email);
        }
      }
      
      console.log(`🗑️ Delete request for document ${documentId} by user ${userId} (admin: ${isAdmin})`);
      
      const result = await deleteDocument(documentId, userId, isAdmin);
      
      if (!result.success) {
        const statusCode = result.error?.includes('Unauthorized') ? 403 : 404;
        return reply.status(statusCode).send({
          success: false,
          error: result.error || 'Document not found'
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
