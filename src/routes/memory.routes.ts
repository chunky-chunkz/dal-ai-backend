/**
 * Memory Management REST API Routes
 * 
 * Provides protected endpoints for memory CRUD operations,
 * evaluation, consent management, and privacy controls.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listByUser, remove, clearUser } from '../memory/store.js';
import { evaluateAndMaybeStore, saveSuggestion } from '../memory/manager.js';
import type { MemoryItem } from '../memory/store.js';

// Request interfaces for type safety
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Extract user ID from authenticated request
 */
function getUserId(request: AuthenticatedRequest): string {
  if (!request.user?.id) {
    throw new Error('User not authenticated');
  }
  return request.user.id;
}

/**
 * Memory routes registration
 */
export async function memoryRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /memory
   * List all memories for the authenticated user
   */
  fastify.get('/memory', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      console.log(`📋 Listing memories for user: ${userId}`);
      const memories = await listByUser(userId);
      
      return reply.send({
        success: true,
        data: memories,
        count: memories.length
      });
    } catch (error) {
      console.error('❌ Error listing memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /memory/evaluate
   * Evaluate an utterance for memory extraction
   */
  fastify.post<{
    Body: { utterance: string }
  }>('/memory/evaluate', {
    schema: {
      body: {
        type: 'object',
        required: ['utterance'],
        properties: {
          utterance: {
            type: 'string',
            minLength: 1
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { utterance } = request.body as { utterance: string };
      
      console.log(`🔍 Evaluating utterance for user ${userId}: "${utterance.substring(0, 50)}..."`);
      
      const result = await evaluateAndMaybeStore(userId, utterance);
      
      return reply.send({
        success: true,
        data: {
          saved: result.saved,
          suggestions: result.suggestions,
          rejected: result.rejected,
          stats: {
            savedCount: result.saved.length,
            suggestionsCount: result.suggestions.length,
            rejectedCount: result.rejected.length
          }
        }
      });
    } catch (error) {
      console.error('❌ Error evaluating utterance:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /memory/confirm
   * Confirm and save suggested memories
   */
  fastify.post<{
    Body: { items: MemoryItem[] }
  }>('/memory/confirm', {
    schema: {
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { items } = request.body as { items: MemoryItem[] };
      
      console.log(`✅ Confirming ${items.length} memory suggestions for user: ${userId}`);
      
      const savedMemories: MemoryItem[] = [];
      const errors: string[] = [];
      
      for (const item of items) {
        try {
          // Validate that the suggestion belongs to the user
          if (item.userId !== userId) {
            errors.push(`Memory ${item.id} does not belong to user`);
            continue;
          }
          
          const savedMemory = await saveSuggestion(userId, item);
          savedMemories.push(savedMemory);
        } catch (error) {
          console.error(`❌ Error saving suggestion ${item.id}:`, error);
          errors.push(`Failed to save ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return reply.send({
        success: true,
        data: {
          saved: savedMemories,
          errors: errors,
          stats: {
            requested: items.length,
            saved: savedMemories.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      console.error('❌ Error confirming memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /memory/reject
   * Reject suggested memories
   */
  fastify.post<{
    Body: { ids: string[] }
  }>('/memory/reject', {
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { ids } = request.body as { ids: string[] };
      
      console.log(`🚫 User ${userId} rejected ${ids.length} memory suggestions`);
      
      // Currently a no-op - in future could store rejection patterns for learning
      
      return reply.send({
        success: true,
        message: `Rejected ${ids.length} suggestions`,
        data: {
          rejectedIds: ids,
          count: ids.length
        }
      });
    } catch (error) {
      console.error('❌ Error rejecting memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /memory/:id
   * Delete a specific memory by ID
   */
  fastify.delete<{
    Params: { id: string }
  }>('/memory/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      
      console.log(`🗑️ Deleting memory ${id} for user: ${userId}`);
      
      const deleted = await remove(userId, id);
      
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Memory not found or does not belong to user'
        });
      }
      
      return reply.send({
        success: true,
        message: 'Memory deleted successfully',
        data: { deletedId: id }
      });
    } catch (error) {
      console.error('❌ Error deleting memory:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/export
   * Export all user memories as JSON download
   */
  fastify.get('/memory/export', {
    schema: {
      description: 'Export all user memories as JSON download',
      tags: ['Memory'],
      summary: 'Export memories',
      response: {
        200: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            exportedAt: { type: 'string' },
            version: { type: 'string' },
            count: { type: 'number' },
            memories: { type: 'array' }
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      console.log(`📤 Exporting memories for user: ${userId}`);
      
      const memories = await listByUser(userId);
      
      const exportData = {
        userId,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        count: memories.length,
        memories: memories
      };
      
      const filename = `memories-${userId}-${new Date().toISOString().split('T')[0]}.json`;
      
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      
      return reply.send(exportData);
    } catch (error) {
      console.error('❌ Error exporting memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /memory
   * Delete ALL memories for user (Right to be forgotten)
   */
  fastify.delete('/memory', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      console.log(`🗑️ FULL WIPE: Deleting ALL memories for user: ${userId}`);
      
      const deletedCount = await clearUser(userId);
      
      return reply.send({
        success: true,
        message: 'All memories deleted successfully',
        data: {
          userId,
          deletedCount,
          deletedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Error clearing user memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/stats
   * Get memory statistics for the user
   */
  fastify.get('/memory/stats', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      console.log(`📊 Getting memory stats for user: ${userId}`);
      
      const memories = await listByUser(userId);
      
      // Calculate statistics
      const stats = {
        total: memories.length,
        byType: {} as Record<string, number>,
        byPerson: {} as Record<string, number>,
        byConfidence: {
          high: 0,    // >= 0.8
          medium: 0,  // 0.5 - 0.8
          low: 0      // < 0.5
        },
        latest: memories[0]?.createdAt || null,
        oldest: memories[memories.length - 1]?.createdAt || null
      };
      
      for (const memory of memories) {
        // By type
        stats.byType[memory.type] = (stats.byType[memory.type] || 0) + 1;
        
        // By person
        const person = memory.person || 'self';
        stats.byPerson[person] = (stats.byPerson[person] || 0) + 1;
        
        // By confidence
        if (memory.confidence >= 0.8) {
          stats.byConfidence.high++;
        } else if (memory.confidence >= 0.5) {
          stats.byConfidence.medium++;
        } else {
          stats.byConfidence.low++;
        }
      }
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Error getting memory stats:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /memory/search
   * Search memories by text content
   */
  fastify.post<{
    Body: { query: string }
  }>('/memory/search', {
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            minLength: 1
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { query } = request.body as { query: string };
      
      console.log(`🔍 Searching memories for user ${userId}: "${query}"`);
      
      const memories = await listByUser(userId);
      const searchLower = query.toLowerCase();
      
      const results = memories.filter(memory => 
        memory.key.toLowerCase().includes(searchLower) ||
        memory.value.toLowerCase().includes(searchLower) ||
        (memory.person && memory.person.toLowerCase().includes(searchLower))
      );
      
      return reply.send({
        success: true,
        data: {
          results,
          query,
          count: results.length,
          totalMemories: memories.length
        }
      });
    } catch (error) {
      console.error('❌ Error searching memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
