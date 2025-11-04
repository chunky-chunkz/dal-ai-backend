/**
 * Memory Summarizer
 * 
 * Summarizes and compresses old memories to reduce storage and improve relevance.
 * Groups related facts and merges them into concise summaries.
 */

import { listByUser, upsert, remove, type MemoryItem } from './store.js';
import { logMemoryEvent, now } from './metrics/logger.js';

export interface SummaryResult {
  original: MemoryItem[];
  summary: MemoryItem;
  archived: number;
}

export interface SummarizationStats {
  totalProcessed: number;
  summariesCreated: number;
  memoriesArchived: number;
  errors: number;
}

/**
 * Find clusters of related memories by type and key similarity
 * 
 * @param memories - Array of memories to cluster
 * @param minClusterSize - Minimum memories per cluster (default: 3)
 * @returns Array of memory clusters
 */
function findClusters(
  memories: MemoryItem[],
  minClusterSize: number = 3
): MemoryItem[][] {
  const clusters: MemoryItem[][] = [];
  
  // Group by type first
  const byType = new Map<string, MemoryItem[]>();
  for (const memory of memories) {
    if (!byType.has(memory.type)) {
      byType.set(memory.type, []);
    }
    byType.get(memory.type)!.push(memory);
  }
  
  // Within each type, cluster by key similarity
  for (const [type, typeMemories] of byType) {
    if (typeMemories.length < minClusterSize) {
      continue;
    }
    
    // Group by similar keys (exact match or prefix)
    const keyGroups = new Map<string, MemoryItem[]>();
    
    for (const memory of typeMemories) {
      // Normalize key (lowercase, remove articles)
      const normalizedKey = memory.key
        .toLowerCase()
        .replace(/^(der|die|das|ein|eine)\s+/g, '')
        .trim();
      
      const baseKey = normalizedKey.split(/\s+/)[0]; // First word as base
      
      if (!keyGroups.has(baseKey)) {
        keyGroups.set(baseKey, []);
      }
      keyGroups.get(baseKey)!.push(memory);
    }
    
    // Add groups that meet minimum size
    for (const group of keyGroups.values()) {
      if (group.length >= minClusterSize) {
        // Sort by date (oldest first)
        group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        clusters.push(group);
      }
    }
  }
  
  return clusters;
}

/**
 * Generate a summary of multiple related memories
 * For now uses simple concatenation; can be enhanced with LLM later
 * 
 * @param memories - Memories to summarize
 * @returns Summarized text
 */
async function generateSummary(memories: MemoryItem[]): Promise<string> {
  if (memories.length === 0) {
    return '';
  }
  
  if (memories.length === 1) {
    return `${memories[0].key}: ${memories[0].value}`;
  }
  
  // For now, use intelligent concatenation
  // Group similar values
  const values = memories.map(m => m.value);
  const uniqueValues = [...new Set(values)];
  
  if (uniqueValues.length === 1) {
    // All same value, just return it with count
    return `${memories[0].key}: ${uniqueValues[0]} (bestätigt ${memories.length}x)`;
  }
  
  // Multiple values - show evolution
  const latest = memories[memories.length - 1];
  return `${latest.key}: ${latest.value} (aktualisiert von ${memories.length} Einträgen)`;
}

/**
 * Summarize a cluster of related memories
 * 
 * @param userId - User identifier
 * @param cluster - Array of related memories
 * @returns Summary result with original and new summary
 */
export async function summarizeCluster(
  userId: string,
  cluster: MemoryItem[]
): Promise<SummaryResult | null> {
  try {
    if (cluster.length < 2) {
      return null;
    }
    
    console.log(`📝 Summarizing ${cluster.length} related memories...`);
    
    // Generate summary text
    const summaryText = await generateSummary(cluster);
    
    if (!summaryText) {
      return null;
    }
    
    // Create summary memory item
    const summaryKey = cluster[0].key; // Use first item's key as base
    const summaryType = cluster[0].type;
    
    // Calculate average confidence
    const avgConfidence = cluster.reduce((sum, m) => sum + m.confidence, 0) / cluster.length;
    
    const summaryItem: MemoryItem = {
      id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: summaryType,
      key: summaryKey,
      value: summaryText,
      confidence: Math.min(0.95, avgConfidence + 0.1), // Slight boost for summaries
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        source: 'summarizer',
        summarizedFrom: cluster.map(m => m.id),
        originalCount: cluster.length
      }
    };
    
    // Store summary
    await upsert(userId, summaryItem);
    
    // Archive (delete) original memories
    let archived = 0;
    for (const memory of cluster) {
      const removed = await remove(userId, memory.id);
      if (removed) {
        archived++;
      }
    }
    
    console.log(`✅ Created summary, archived ${archived} memories`);
    
    // Log summarization event
    await logMemoryEvent({
      type: 'summarize',
      userId,
      clusterSize: cluster.length,
      archived,
      ts: now()
    });
    
    return {
      original: cluster,
      summary: summaryItem,
      archived
    };
    
  } catch (error) {
    console.error('❌ Error summarizing cluster:', error);
    return null;
  }
}

/**
 * Summarize all eligible memories for a user
 * 
 * @param userId - User identifier
 * @param minAge - Minimum age in days before summarizing (default: 30)
 * @param minClusterSize - Minimum memories per cluster (default: 3)
 * @returns Summarization statistics
 */
export async function summarizeUserMemories(
  userId: string,
  minAgeDays: number = 30,
  minClusterSize: number = 3
): Promise<SummarizationStats> {
  const stats: SummarizationStats = {
    totalProcessed: 0,
    summariesCreated: 0,
    memoriesArchived: 0,
    errors: 0
  };
  
  try {
    console.log(`📊 Starting memory summarization for user ${userId}...`);
    
    // Get all user memories
    const allMemories = await listByUser(userId);
    
    // Filter for old memories (> minAge days)
    const now = new Date();
    const minDate = new Date(now.getTime() - minAgeDays * 24 * 60 * 60 * 1000);
    
    const oldMemories = allMemories.filter(m => 
      m.createdAt < minDate && 
      m.metadata?.source !== 'summarizer' // Don't re-summarize summaries
    );
    
    console.log(`   Found ${oldMemories.length} old memories (>${minAgeDays} days)`);
    
    if (oldMemories.length < minClusterSize) {
      console.log(`   Not enough memories to summarize`);
      return stats;
    }
    
    // Find clusters
    const clusters = findClusters(oldMemories, minClusterSize);
    console.log(`   Found ${clusters.length} clusters`);
    
    stats.totalProcessed = oldMemories.length;
    
    // Summarize each cluster
    for (const cluster of clusters) {
      const result = await summarizeCluster(userId, cluster);
      
      if (result) {
        stats.summariesCreated++;
        stats.memoriesArchived += result.archived;
      } else {
        stats.errors++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Summarization complete: ${stats.summariesCreated} summaries, ${stats.memoriesArchived} archived`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error summarizing user memories:', error);
    stats.errors++;
    return stats;
  }
}

/**
 * Summarize memories for all users
 * Should be run as a scheduled task (e.g., daily)
 * 
 * @param minAgeDays - Minimum age before summarizing
 * @returns Map of user IDs to their stats
 */
export async function summarizeAllUsers(
  minAgeDays: number = 30
): Promise<Map<string, SummarizationStats>> {
  const results = new Map<string, SummarizationStats>();
  
  try {
    // Get list of all users (this would need to be implemented in store.ts)
    // For now, we'll return empty results
    console.log('⚠️  summarizeAllUsers not yet implemented - need getAllUsers() in store.ts');
    
    return results;
    
  } catch (error) {
    console.error('❌ Error summarizing all users:', error);
    return results;
  }
}

/**
 * Preview what would be summarized without actually doing it
 * Useful for testing and user transparency
 * 
 * @param userId - User identifier
 * @param minAgeDays - Minimum age in days
 * @returns Array of clusters that would be summarized
 */
export async function previewSummarization(
  userId: string,
  minAgeDays: number = 30
): Promise<MemoryItem[][]> {
  const allMemories = await listByUser(userId);
  const now = new Date();
  const minDate = new Date(now.getTime() - minAgeDays * 24 * 60 * 60 * 1000);
  
  const oldMemories = allMemories.filter(m => 
    m.createdAt < minDate && 
    m.metadata?.source !== 'summarizer'
  );
  
  return findClusters(oldMemories, 3);
}
