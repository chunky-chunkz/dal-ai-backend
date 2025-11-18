/**
 * Memory Management REST API Routes
 * 
 * Provides protected endpoints for memory CRUD operations,
 * evaluation, consent management, and privacy controls.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { listByUser, remove, clearUser } from '../memory/store.js';
import { evaluateAndMaybeStore, saveSuggestion } from '../memory/manager.js';
import { retrieveForPrompt, getAllGrouped } from '../memory/retriever.js';
import { recordConsent, getConsentHistory, getConsentStats, createConsentPrompt } from '../memory/consent.js';
import { summarizeUserMemories, previewSummarization } from '../memory/summarizer.js';
import { getUserStats, getSystemStats, getQualityMetrics, logMemoryEvent, exportMetricsCSV } from '../memory/metrics.js';
import type { MemoryItem } from '../memory/store.js';

// Request interfaces for type safety
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Extract user ID from authenticated request or session header
 */
function getUserId(request: AuthenticatedRequest): string {
  // Try authenticated user first
  if (request.user?.id) {
    return request.user.id;
  }
  
  // Fallback to x-session-id header
  const sessionId = request.headers['x-session-id'] as string;
  if (sessionId) {
    console.log('🔍 Using session ID from header:', sessionId);
    return sessionId;
  }
  
  throw new Error('User not authenticated and no session ID provided');
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
    Body: { items?: MemoryItem[], suggestionIds?: string[] }
  }>('/memory/confirm', {
    schema: {
      body: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object' }
          },
          suggestionIds: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body as { items?: MemoryItem[], suggestionIds?: string[] };
      
      // Support both formats: items array or suggestionIds array
      const items = body.items || [];
      const suggestionIds = body.suggestionIds || [];
      
      console.log(`✅ Confirming memory suggestions for user: ${userId}`);
      console.log(`   Items: ${items.length}, SuggestionIds: ${suggestionIds.length}`);
      
      if (items.length === 0 && suggestionIds.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No items or suggestionIds provided'
        });
      }
      
      const savedMemories: MemoryItem[] = [];
      const errors: string[] = [];
      
      // Process items if provided
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
      
      // If only suggestionIds provided, log them (in a real implementation, you'd fetch and save them)
      if (suggestionIds.length > 0) {
        console.log(`📝 Suggestion IDs to confirm: ${suggestionIds.join(', ')}`);
        // TODO: Implement fetching suggestions by ID and saving them
        errors.push('Direct suggestionId confirmation not yet implemented. Please provide full items.');
      }
      
      return reply.send({
        success: true,
        data: {
          saved: savedMemories,
          errors: errors,
          stats: {
            requested: items.length + suggestionIds.length,
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
    Body: { ids?: string[], suggestionIds?: string[] }
  }>('/memory/reject', {
    schema: {
      body: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' }
          },
          suggestionIds: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body as { ids?: string[], suggestionIds?: string[] };
      
      // Support both formats: ids or suggestionIds
      const idsToReject = body.ids || body.suggestionIds || [];
      
      console.log(`🚫 User ${userId} rejected ${idsToReject.length} memory suggestions`);
      
      // Currently a no-op - in future could store rejection patterns for learning
      
      return reply.send({
        success: true,
        message: `Rejected ${idsToReject.length} suggestions`,
        data: {
          rejectedIds: idsToReject,
          count: idsToReject.length
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

  /**
   * GET /memory/global
   * Get global knowledge base (memories extracted from documents)
   * Accessible to all users
   */
  fastify.get('/memory/global', {
    schema: {
      description: 'Get global knowledge base from uploaded documents',
      tags: ['Memory'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  key: { type: 'string' },
                  value: { type: 'string' },
                  confidence: { type: 'number' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' }
                }
              }
            },
            count: { type: 'number' },
            summary: {
              type: 'object',
              properties: {
                byType: { type: 'object' },
                totalFacts: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('🌍 Retrieving global knowledge base...');
      
      // Get all global-knowledge memories
      const globalMemories = await listByUser('global-knowledge');
      
      // Calculate statistics
      const byType: Record<string, number> = {};
      globalMemories.forEach(memory => {
        byType[memory.type] = (byType[memory.type] || 0) + 1;
      });
      
      return reply.send({
        success: true,
        data: globalMemories,
        count: globalMemories.length,
        summary: {
          byType,
          totalFacts: globalMemories.length
        }
      });
    } catch (error) {
      console.error('❌ Error retrieving global knowledge:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/all-users
   * Get memories from all users (from user_memories.json)
   * Accessible to all users - for displaying consolidated knowledge
   */
  fastify.get('/memory/all-users', {
    schema: {
      description: 'Get memories from all users in the system',
      tags: ['Memory'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  key: { type: 'string' },
                  value: { type: 'string' },
                  timestamp: { type: 'string' },
                  context: { type: 'string' }
                }
              }
            },
            count: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('👥 Retrieving memories from all users...');
      
      // Read user_memories.json directly
      const fs = await import('fs/promises');
      const path = await import('path');
      const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      const userMemoriesPath = path.join(DATA_DIR, 'user_memories.json');
      
      let allUserMemories: any[] = [];
      
      try {
        const fileContent = await fs.readFile(userMemoriesPath, 'utf-8');
        const userMemoriesData = JSON.parse(fileContent);
        
        // Transform user_memories.json structure into flat array
        for (const [userId, userData] of Object.entries(userMemoriesData)) {
          const memories = (userData as any).memories || {};
          for (const [key, memoryData] of Object.entries(memories)) {
            allUserMemories.push({
              userId,
              key,
              value: (memoryData as any).value,
              timestamp: (memoryData as any).timestamp,
              context: (memoryData as any).context
            });
          }
        }
      } catch (error) {
        // If file doesn't exist or is empty, return empty array
        console.log('ℹ️  No user_memories.json file found or empty');
      }
      
      return reply.send({
        success: true,
        data: allUserMemories,
        count: allUserMemories.length
      });
    } catch (error) {
      console.error('❌ Error retrieving user memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/retrieve
   * Retrieve relevant memories for a query (using new retriever)
   */
  fastify.get<{
    Querystring: { query: string; limit?: number }
  }>('/memory/retrieve', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const queryParams = request.query as { query: string; limit?: number };
      const { query, limit = 5 } = queryParams;
      
      if (!query) {
        return reply.status(400).send({
          success: false,
          error: 'Query parameter is required'
        });
      }
      
      console.log(`🔍 Retrieving memories for query: "${query}"`);
      
      const result = await retrieveForPrompt(userId, query, Number(limit));
      
      await logMemoryEvent(userId, 'retrieve', undefined, undefined, { query, resultCount: result.relevant.length });
      
      return reply.send({
        success: true,
        data: {
          context: result.context,
          relevant: result.relevant,
          count: result.relevant.length
        }
      });
    } catch (error) {
      console.error('❌ Error retrieving memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/grouped
   * Get all memories grouped by type
   */
  fastify.get('/memory/grouped', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      const grouped = await getAllGrouped(userId);
      const groupedObject: Record<string, MemoryItem[]> = {};
      
      for (const [type, memories] of grouped) {
        groupedObject[type] = memories;
      }
      
      return reply.send({
        success: true,
        data: groupedObject
      });
    } catch (error) {
      console.error('❌ Error getting grouped memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /memory/consent
   * Record user consent decision
   */
  fastify.post<{
    Body: { key: string; type: string; approved: boolean }
  }>('/memory/consent', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body as { key: string; type: string; approved: boolean };
      const { key, type, approved } = body;
      
      const success = await recordConsent(userId, key, type, approved);
      
      return reply.send({
        success,
        message: approved ? 'Consent recorded - memory will be saved' : 'Declined - key blacklisted for 24h'
      });
    } catch (error) {
      console.error('❌ Error recording consent:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/consent-history
   * Get user's consent history
   */
  fastify.get('/memory/consent-history', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      const history = await getConsentHistory(userId);
      const stats = await getConsentStats(userId);
      
      return reply.send({
        success: true,
        data: {
          history,
          stats
        }
      });
    } catch (error) {
      console.error('❌ Error getting consent history:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /memory/summarize
   * Trigger memory summarization for user
   */
  fastify.post<{
    Body: { minAgeDays?: number; preview?: boolean }
  }>('/memory/summarize', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = (request.body || {}) as { minAgeDays?: number; preview?: boolean };
      const { minAgeDays = 30, preview = false } = body;
      
      if (preview) {
        const clusters = await previewSummarization(userId, minAgeDays);
        return reply.send({
          success: true,
          preview: true,
          data: {
            clusters: clusters.map(cluster => ({
              count: cluster.length,
              type: cluster[0]?.type,
              keys: cluster.map(m => m.key)
            }))
          }
        });
      }
      
      const stats = await summarizeUserMemories(userId, minAgeDays);
      
      await logMemoryEvent(userId, 'summarize', undefined, undefined, stats);
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Error summarizing memories:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/stats
   * Get user's memory statistics
   */
  fastify.get('/memory/stats', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      const userStats = await getUserStats(userId);
      const qualityMetrics = await getQualityMetrics(userId);
      
      return reply.send({
        success: true,
        data: {
          user: userStats,
          quality: qualityMetrics
        }
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
   * GET /memory/stats/system
   * Get system-wide memory statistics (admin only)
   */
  fastify.get('/memory/stats/system', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const systemStats = await getSystemStats();
      const qualityMetrics = await getQualityMetrics();
      
      return reply.send({
        success: true,
        data: {
          system: systemStats,
          quality: qualityMetrics
        }
      });
    } catch (error) {
      console.error('❌ Error getting system stats:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /memory/export/csv
   * Export memory metrics as CSV
   */
  fastify.get('/memory/export/csv', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      const csv = await exportMetricsCSV(userId);
      
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="memory-metrics-${userId}-${Date.now()}.csv"`)
        .send(csv);
    } catch (error) {
      console.error('❌ Error exporting metrics:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
