/**
 * Memory Maintenance Routes
 * 
 * Administrative endpoints for memory management:
 * - Manual summarization trigger
 * - Batch operations
 * - Maintenance tasks
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { summarizeUserMemories, type SummarizationStats } from '../memory/summarizer.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// Persistent disk on Render oder fallback auf ./data
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');

interface User {
  id: string;
  email: string;
  [key: string]: any;
}

/**
 * Get all user IDs from users.json
 */
async function getAllUserIds(): Promise<string[]> {
  try {
    const content = await fs.readFile(USERS_FILE, 'utf-8');
    const users: User[] = JSON.parse(content);
    return users.map(u => u.id);
  } catch (error) {
    console.error('Failed to read users file:', error);
    return [];
  }
}

/**
 * Extract userId from request headers or session
 */
function extractUserId(request: FastifyRequest): string {
  // Try x-session-id header
  const sessionId = request.headers['x-session-id'] as string;
  if (sessionId) {
    return sessionId;
  }
  
  // Try session object (if auth middleware set it)
  const session = (request as any).session;
  if (session?.userId) {
    return session.userId;
  }
  
  throw new Error('User ID not found in request');
}

export default async function memoryMaintenanceRoutes(fastify: FastifyInstance) {
  
  /**
   * POST /api/memory/summarize
   * 
   * Manually trigger memory summarization for current user
   * 
   * Body: {
   *   minAgeDays?: number,    // Default: 30
   *   minClusterSize?: number // Default: 3
   * }
   */
  fastify.post('/api/memory/summarize', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = extractUserId(request);
      
      const body = request.body as any || {};
      const minAgeDays = body.minAgeDays || 30;
      const minClusterSize = body.minClusterSize || 3;
      
      console.log(`📊 Starting summarization for user ${userId} (minAge: ${minAgeDays}d, minSize: ${minClusterSize})`);
      
      const stats = await summarizeUserMemories(userId, minAgeDays, minClusterSize);
      
      return {
        success: true,
        userId,
        stats,
        message: `Created ${stats.summariesCreated} summaries, archived ${stats.memoriesArchived} memories`
      };
      
    } catch (error) {
      console.error('Summarization failed:', error);
      reply.status(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  /**
   * POST /api/admin/memory/summarize-all
   * 
   * Trigger summarization for all users (admin only)
   * 
   * Body: {
   *   minAgeDays?: number,    // Default: 30
   *   minClusterSize?: number // Default: 3
   * }
   */
  fastify.post('/api/admin/memory/summarize-all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // TODO: Add proper admin authentication check
      // For now, just check if admin email is in session
      
      const body = request.body as any || {};
      const minAgeDays = body.minAgeDays || 30;
      const minClusterSize = body.minClusterSize || 3;
      
      console.log(`🔐 Admin-triggered summarization for all users (minAge: ${minAgeDays}d, minSize: ${minClusterSize})`);
      
      const allUsers = await getAllUserIds();
      
      if (allUsers.length === 0) {
        return {
          success: true,
          message: 'No users found',
          results: []
        };
      }
      
      console.log(`   Processing ${allUsers.length} users...`);
      
      const results: Array<{
        userId: string;
        stats: SummarizationStats;
        error?: string;
      }> = [];
      
      for (const userId of allUsers) {
        try {
          const stats = await summarizeUserMemories(userId, minAgeDays, minClusterSize);
          results.push({ userId, stats });
          
          // Rate limiting - wait 1 second between users
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`   Failed for user ${userId}:`, error);
          results.push({
            userId,
            stats: {
              totalProcessed: 0,
              summariesCreated: 0,
              memoriesArchived: 0,
              errors: 1
            },
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Calculate totals
      const totals = results.reduce((acc, r) => ({
        summariesCreated: acc.summariesCreated + r.stats.summariesCreated,
        memoriesArchived: acc.memoriesArchived + r.stats.memoriesArchived,
        errors: acc.errors + r.stats.errors
      }), { summariesCreated: 0, memoriesArchived: 0, errors: 0 });
      
      console.log(`✅ Batch summarization complete: ${totals.summariesCreated} summaries, ${totals.memoriesArchived} archived`);
      
      return {
        success: true,
        usersProcessed: allUsers.length,
        totals,
        results
      };
      
    } catch (error) {
      console.error('Batch summarization failed:', error);
      reply.status(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  /**
   * GET /api/memory/maintenance/stats
   * 
   * Get maintenance statistics (for monitoring)
   */
  fastify.get('/api/memory/maintenance/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // TODO: Implement stats tracking
      // For now, return placeholder
      
      return {
        success: true,
        stats: {
          lastCleanup: null,
          lastSummarization: null,
          totalExpired: 0,
          totalSummarized: 0
        },
        message: 'Stats tracking coming soon'
      };
      
    } catch (error) {
      reply.status(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
