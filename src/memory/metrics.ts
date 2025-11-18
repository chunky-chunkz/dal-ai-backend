/**
 * Memory Metrics and Performance Tracking
 * 
 * Tracks memory system performance, usage statistics, and quality metrics.
 */

import fs from 'fs/promises';
import path from 'path';

// Persistent disk on Render oder fallback auf ./data
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const METRICS_FILE_PATH = path.join(DATA_DIR, 'memory_metrics.json');

export interface MemoryEvent {
  userId: string;
  action: 'save' | 'retrieve' | 'expire' | 'delete' | 'summarize' | 'suggest';
  key?: string;
  type?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MemoryMetrics {
  events: MemoryEvent[];
}

export interface UserStats {
  userId: string;
  totalSaved: number;
  totalRetrieved: number;
  totalExpired: number;
  totalDeleted: number;
  totalSummarized: number;
  totalSuggestions: number;
  avgTTL: number | null;
  recallRate: number | null;
  lastActivity: Date | null;
}

export interface SystemStats {
  totalUsers: number;
  totalMemories: number;
  totalEvents: number;
  avgMemoriesPerUser: number;
  mostActiveType: string | null;
  eventsLast24h: number;
  eventsLast7d: number;
  eventsLast30d: number;
}

/**
 * Load metrics from disk
 */
async function loadMetrics(): Promise<MemoryMetrics> {
  try {
    const data = await fs.readFile(METRICS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Convert date strings to Date objects
    return {
      events: parsed.events.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }))
    };
  } catch (error) {
    // Return empty metrics if file doesn't exist
    return { events: [] };
  }
}

/**
 * Save metrics to disk
 */
async function saveMetrics(metrics: MemoryMetrics): Promise<void> {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(METRICS_FILE_PATH);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(METRICS_FILE_PATH, JSON.stringify(metrics, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ Error saving metrics:', error);
  }
}

/**
 * Log a memory event
 * 
 * @param userId - User identifier
 * @param action - Action type
 * @param key - Optional memory key
 * @param type - Optional memory type
 * @param metadata - Optional additional data
 */
export async function logMemoryEvent(
  userId: string,
  action: 'save' | 'retrieve' | 'expire' | 'delete' | 'summarize' | 'suggest',
  key?: string,
  type?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const metrics = await loadMetrics();
    
    const event: MemoryEvent = {
      userId,
      action,
      key,
      type,
      timestamp: new Date(),
      metadata
    };
    
    metrics.events.push(event);
    
    // Keep only last 10,000 events to prevent unbounded growth
    if (metrics.events.length > 10000) {
      metrics.events = metrics.events.slice(-10000);
    }
    
    await saveMetrics(metrics);
    
  } catch (error) {
    console.error('❌ Error logging memory event:', error);
  }
}

/**
 * Get statistics for a specific user
 * 
 * @param userId - User identifier
 * @returns User statistics
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const metrics = await loadMetrics();
  const userEvents = metrics.events.filter(e => e.userId === userId);
  
  const stats: UserStats = {
    userId,
    totalSaved: userEvents.filter(e => e.action === 'save').length,
    totalRetrieved: userEvents.filter(e => e.action === 'retrieve').length,
    totalExpired: userEvents.filter(e => e.action === 'expire').length,
    totalDeleted: userEvents.filter(e => e.action === 'delete').length,
    totalSummarized: userEvents.filter(e => e.action === 'summarize').length,
    totalSuggestions: userEvents.filter(e => e.action === 'suggest').length,
    avgTTL: null,
    recallRate: null,
    lastActivity: userEvents.length > 0 
      ? userEvents[userEvents.length - 1].timestamp 
      : null
  };
  
  // Calculate recall rate (retrievals / saves)
  if (stats.totalSaved > 0) {
    stats.recallRate = stats.totalRetrieved / stats.totalSaved;
  }
  
  // Calculate average TTL if we have TTL data in metadata
  const ttls = userEvents
    .filter(e => e.action === 'save' && e.metadata?.ttl)
    .map(e => parseTTL(e.metadata!.ttl));
  
  if (ttls.length > 0) {
    stats.avgTTL = ttls.reduce((sum, ttl) => sum + ttl, 0) / ttls.length;
  }
  
  return stats;
}

/**
 * Parse ISO 8601 duration to days
 * Example: "P30D" -> 30
 */
function parseTTL(ttl: string): number {
  const match = ttl.match(/P(\d+)D/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get system-wide statistics
 * 
 * @returns System statistics
 */
export async function getSystemStats(): Promise<SystemStats> {
  const metrics = await loadMetrics();
  const now = new Date();
  const day24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Count unique users
  const uniqueUsers = new Set(metrics.events.map(e => e.userId));
  
  // Count saves per user
  const savesByUser = new Map<string, number>();
  metrics.events
    .filter(e => e.action === 'save')
    .forEach(e => {
      savesByUser.set(e.userId, (savesByUser.get(e.userId) || 0) + 1);
    });
  
  // Find most common type
  const typeCount = new Map<string, number>();
  metrics.events
    .filter(e => e.type)
    .forEach(e => {
      typeCount.set(e.type!, (typeCount.get(e.type!) || 0) + 1);
    });
  
  let mostActiveType: string | null = null;
  let maxCount = 0;
  for (const [type, count] of typeCount) {
    if (count > maxCount) {
      mostActiveType = type;
      maxCount = count;
    }
  }
  
  const stats: SystemStats = {
    totalUsers: uniqueUsers.size,
    totalMemories: savesByUser.size > 0 
      ? Array.from(savesByUser.values()).reduce((sum, count) => sum + count, 0) 
      : 0,
    totalEvents: metrics.events.length,
    avgMemoriesPerUser: uniqueUsers.size > 0 
      ? Array.from(savesByUser.values()).reduce((sum, count) => sum + count, 0) / uniqueUsers.size 
      : 0,
    mostActiveType,
    eventsLast24h: metrics.events.filter(e => e.timestamp > day24ago).length,
    eventsLast7d: metrics.events.filter(e => e.timestamp > day7ago).length,
    eventsLast30d: metrics.events.filter(e => e.timestamp > day30ago).length
  };
  
  return stats;
}

/**
 * Get events for a specific user
 * 
 * @param userId - User identifier
 * @param limit - Maximum number of events to return (default: 100)
 * @returns Array of events
 */
export async function getUserEvents(
  userId: string,
  limit: number = 100
): Promise<MemoryEvent[]> {
  const metrics = await loadMetrics();
  const userEvents = metrics.events.filter(e => e.userId === userId);
  
  // Sort by timestamp (newest first)
  userEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return userEvents.slice(0, limit);
}

/**
 * Get events by action type
 * 
 * @param action - Action type to filter by
 * @param limit - Maximum number of events (default: 100)
 * @returns Array of events
 */
export async function getEventsByAction(
  action: 'save' | 'retrieve' | 'expire' | 'delete' | 'summarize' | 'suggest',
  limit: number = 100
): Promise<MemoryEvent[]> {
  const metrics = await loadMetrics();
  const filtered = metrics.events.filter(e => e.action === action);
  
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return filtered.slice(0, limit);
}

/**
 * Clear all metrics (use with caution!)
 */
export async function clearAllMetrics(): Promise<void> {
  const emptyMetrics: MemoryMetrics = { events: [] };
  await saveMetrics(emptyMetrics);
  console.log('🧹 All metrics cleared');
}

/**
 * Clear metrics for a specific user
 * 
 * @param userId - User identifier
 * @returns Number of events removed
 */
export async function clearUserMetrics(userId: string): Promise<number> {
  const metrics = await loadMetrics();
  const initialCount = metrics.events.length;
  
  metrics.events = metrics.events.filter(e => e.userId !== userId);
  
  const removedCount = initialCount - metrics.events.length;
  
  if (removedCount > 0) {
    await saveMetrics(metrics);
    console.log(`🧹 Cleared ${removedCount} metrics for user ${userId}`);
  }
  
  return removedCount;
}

/**
 * Get memory quality metrics
 * Analyzes confidence scores, recall rates, etc.
 */
export interface QualityMetrics {
  avgConfidence: number;
  highConfidenceCount: number; // >= 0.8
  mediumConfidenceCount: number; // 0.5 - 0.8
  lowConfidenceCount: number; // < 0.5
  recallRate: number;
  suggestionAcceptRate: number;
}

export async function getQualityMetrics(userId?: string): Promise<QualityMetrics> {
  const metrics = await loadMetrics();
  
  let events = metrics.events;
  if (userId) {
    events = events.filter(e => e.userId === userId);
  }
  
  const saves = events.filter(e => e.action === 'save');
  const retrieves = events.filter(e => e.action === 'retrieve');
  const suggests = events.filter(e => e.action === 'suggest');
  
  // Extract confidence scores from metadata
  const confidences = saves
    .filter(e => e.metadata?.confidence !== undefined)
    .map(e => e.metadata!.confidence);
  
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;
  
  const quality: QualityMetrics = {
    avgConfidence,
    highConfidenceCount: confidences.filter(c => c >= 0.8).length,
    mediumConfidenceCount: confidences.filter(c => c >= 0.5 && c < 0.8).length,
    lowConfidenceCount: confidences.filter(c => c < 0.5).length,
    recallRate: saves.length > 0 ? retrieves.length / saves.length : 0,
    suggestionAcceptRate: suggests.length > 0 
      ? saves.filter(e => e.metadata?.wassuggestion).length / suggests.length 
      : 0
  };
  
  return quality;
}

/**
 * Export metrics as CSV for analysis
 * 
 * @param userId - Optional user filter
 * @returns CSV string
 */
export async function exportMetricsCSV(userId?: string): Promise<string> {
  const metrics = await loadMetrics();
  
  let events = metrics.events;
  if (userId) {
    events = events.filter(e => e.userId === userId);
  }
  
  // CSV header
  let csv = 'timestamp,userId,action,key,type\n';
  
  // CSV rows
  for (const event of events) {
    csv += `${event.timestamp.toISOString()},${event.userId},${event.action},${event.key || ''},${event.type || ''}\n`;
  }
  
  return csv;
}
