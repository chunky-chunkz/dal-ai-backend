/**
 * Memory Retriever
 * 
 * Retrieves relevant memories for conversation context.
 * Uses embedding similarity + recency weighting to find the most relevant memories.
 */

import { embedTexts } from '../ai/embeddings.js';
import { listByUser, type MemoryItem } from './store.js';

export interface RetrievalResult {
  memory: MemoryItem;
  score: number;
  similarity: number;
  recency: number;
}

export interface MemoryContext {
  context: string;
  relevant: RetrievalResult[];
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/**
 * Calculate recency score (0.0 - 1.0)
 * More recent memories get higher scores
 */
function calculateRecency(createdAt: Date, maxAgeDays: number = 90): number {
  const now = new Date();
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Exponential decay: score = e^(-age/maxAge)
  const score = Math.exp(-ageDays / maxAgeDays);
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Find relevant memories for a query
 * 
 * @param userId - User identifier
 * @param query - Search query text
 * @param limit - Maximum number of results (default: 5)
 * @param similarityWeight - Weight for similarity score (default: 0.7)
 * @param recencyWeight - Weight for recency score (default: 0.3)
 * @returns Array of relevant memories with scores
 */
export async function findRelevant(
  userId: string,
  query: string,
  limit: number = 5,
  similarityWeight: number = 0.7,
  recencyWeight: number = 0.3
): Promise<RetrievalResult[]> {
  try {
    // Get all user memories
    const memories = await listByUser(userId);
    
    if (memories.length === 0) {
      return [];
    }
    
    // Generate embedding for the query
    const queryEmbeddings = await embedTexts([query]);
    const queryEmbedding = queryEmbeddings[0];
    
    if (!queryEmbedding) {
      console.error('❌ Failed to generate query embedding');
      return [];
    }
    
    // Score each memory
    const results: RetrievalResult[] = [];
    
    for (const memory of memories) {
      // Generate embedding for memory content
      const memoryText = `${memory.key}: ${memory.value}`;
      const memoryEmbeddings = await embedTexts([memoryText]);
      const memoryEmbedding = memoryEmbeddings[0];
      
      if (!memoryEmbedding) {
        continue;
      }
      
      // Calculate similarity
      const similarity = cosineSimilarity(queryEmbedding, memoryEmbedding);
      
      // Calculate recency
      const recency = calculateRecency(memory.createdAt);
      
      // Combined score: weighted average
      const score = (similarityWeight * similarity) + (recencyWeight * recency);
      
      results.push({
        memory,
        score,
        similarity,
        recency
      });
    }
    
    // Sort by score (descending) and limit
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
    
  } catch (error) {
    console.error('❌ Error retrieving relevant memories:', error);
    return [];
  }
}

/**
 * Retrieve memories and build context string for prompt
 * 
 * @param userId - User identifier
 * @param query - Current user query
 * @param limit - Maximum number of memories to include (default: 5)
 * @returns Context string and relevant memories
 */
export async function retrieveForPrompt(
  userId: string,
  query: string,
  limit: number = 5
): Promise<MemoryContext> {
  const relevant = await findRelevant(userId, query, limit);
  
  if (relevant.length === 0) {
    return {
      context: '',
      relevant: []
    };
  }
  
  // Build context string
  let context = '=== User Memory ===\n';
  
  // Group by type for better readability
  const grouped = new Map<string, RetrievalResult[]>();
  for (const result of relevant) {
    const type = result.memory.type;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(result);
  }
  
  // Format by type
  for (const [type, results] of grouped) {
    const label = formatTypeLabel(type);
    context += `\n${label}:\n`;
    
    for (const result of results) {
      const { memory } = result;
      if (memory.person && memory.person !== userId) {
        context += `- ${memory.person}: ${memory.key} = ${memory.value}\n`;
      } else {
        context += `- ${memory.key}: ${memory.value}\n`;
      }
    }
  }
  
  context += '\n';
  
  return {
    context,
    relevant
  };
}

/**
 * Format type label for display
 */
function formatTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'preference': 'Preferences',
    'profile_fact': 'Profile',
    'contact': 'Contact Info',
    'task_hint': 'Tasks & Hints',
    'work_context': 'Work Context'
  };
  
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Batch retrieve memories for multiple queries
 * Useful for multi-turn conversations
 */
export async function batchRetrieve(
  userId: string,
  queries: string[],
  limit: number = 5
): Promise<Map<string, MemoryContext>> {
  const results = new Map<string, MemoryContext>();
  
  for (const query of queries) {
    const context = await retrieveForPrompt(userId, query, limit);
    results.set(query, context);
  }
  
  return results;
}

/**
 * Get all memories grouped by type
 * Useful for memory overview/export
 */
export async function getAllGrouped(userId: string): Promise<Map<string, MemoryItem[]>> {
  const memories = await listByUser(userId);
  const grouped = new Map<string, MemoryItem[]>();
  
  for (const memory of memories) {
    const type = memory.type;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(memory);
  }
  
  return grouped;
}
