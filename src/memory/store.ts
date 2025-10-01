/**
 * Memory Store - Persistent JSON-based storage for development
 * 
 * Provides atomic file operations for memory storage with deduplication,
 * TTL management, and user-based organization.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MemoryItem {
  id: string;
  userId: string;
  person?: string;
  type: string;
  key: string;
  value: string;
  confidence: number;
  ttl?: string; // ISO 8601 duration or null for permanent
  createdAt: Date;
  updatedAt: Date;
}

export type MemoryItemInput = Omit<MemoryItem, "id" | "createdAt" | "updatedAt">;

interface MemoryStore {
  version: string;
  lastSweep: string;
  memories: MemoryItem[];
}

// Path to the memory data file
const MEMORY_FILE_PATH = path.resolve(__dirname, '../../data/memory.json');

// In-memory cache for better performance
let memoryCache: MemoryStore | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Load memory store from file with caching
 */
async function loadMemoryStore(): Promise<MemoryStore> {
  const now = Date.now();
  
  // Return cached version if still valid
  if (memoryCache && (now - cacheTimestamp) < CACHE_TTL) {
    return memoryCache;
  }
  
  try {
    await ensureDataDirectory();
    
    const fileContent = await fs.readFile(MEMORY_FILE_PATH, 'utf-8');
    const store = JSON.parse(fileContent) as MemoryStore;
    
    // Convert date strings back to Date objects
    store.memories = store.memories.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    }));
    
    memoryCache = store;
    cacheTimestamp = now;
    
    return store;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Create new store if file doesn't exist
      const newStore: MemoryStore = {
        version: '1.0.0',
        lastSweep: new Date().toISOString(),
        memories: []
      };
      
      await saveMemoryStore(newStore);
      return newStore;
    }
    
    throw new Error(`Failed to load memory store: ${error.message}`);
  }
}

/**
 * Save memory store to file atomically
 */
async function saveMemoryStore(store: MemoryStore): Promise<void> {
  await ensureDataDirectory();
  
  // Atomic write using temporary file
  const tempPath = `${MEMORY_FILE_PATH}.tmp`;
  const backupPath = `${MEMORY_FILE_PATH}.backup`;
  
  try {
    // Create backup of existing file
    try {
      await fs.access(MEMORY_FILE_PATH);
      await fs.copyFile(MEMORY_FILE_PATH, backupPath);
    } catch {
      // No existing file to backup
    }
    
    // Write to temporary file
    await fs.writeFile(tempPath, JSON.stringify(store, null, 2), 'utf-8');
    
    // Atomic rename
    await fs.rename(tempPath, MEMORY_FILE_PATH);
    
    // Update cache
    memoryCache = store;
    cacheTimestamp = Date.now();
    
    // Clean up backup after successful write
    try {
      await fs.unlink(backupPath);
    } catch {
      // Ignore backup cleanup errors
    }
  } catch (error: any) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    
    // Restore from backup if available
    try {
      await fs.access(backupPath);
      await fs.copyFile(backupPath, MEMORY_FILE_PATH);
    } catch {
      // No backup to restore
    }
    
    throw new Error(`Failed to save memory store: ${error.message}`);
  }
}

/**
 * Ensure data directory exists
 */
async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(MEMORY_FILE_PATH);
  
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

/**
 * Generate unique ID for memory items
 */
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a memory item has expired based on TTL
 */
function isExpired(item: MemoryItem): boolean {
  if (!item.ttl) {
    return false; // No TTL means permanent
  }
  
  try {
    const createdAt = new Date(item.createdAt);
    const ttlMs = parseDuration(item.ttl);
    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    
    return new Date() > expiresAt;
  } catch {
    // If TTL parsing fails, consider it permanent
    return false;
  }
}

/**
 * Parse ISO 8601 duration to milliseconds
 */
function parseDuration(duration: string): number {
  // Simple parser for common durations like P30D, P1Y, PT1H
  const match = duration.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  
  const [, years, months, days, hours, minutes, seconds] = match;
  
  let totalMs = 0;
  if (years) totalMs += parseInt(years) * 365 * 24 * 60 * 60 * 1000;
  if (months) totalMs += parseInt(months) * 30 * 24 * 60 * 60 * 1000;
  if (days) totalMs += parseInt(days) * 24 * 60 * 60 * 1000;
  if (hours) totalMs += parseInt(hours) * 60 * 60 * 1000;
  if (minutes) totalMs += parseInt(minutes) * 60 * 1000;
  if (seconds) totalMs += parseInt(seconds) * 1000;
  
  return totalMs;
}

/**
 * Find duplicate memory by deduplication key
 */
function findDuplicate(
  memories: MemoryItem[], 
  userId: string, 
  type: string, 
  key: string, 
  person?: string
): MemoryItem | undefined {
  return memories.find(item => 
    item.userId === userId &&
    item.type === type &&
    item.key === key &&
    item.person === person
  );
}

/**
 * List all memories for a specific user
 * 
 * @param userId - User identifier
 * @returns Array of memory items for the user
 */
export async function listByUser(userId: string): Promise<MemoryItem[]> {
  const store = await loadMemoryStore();
  
  return store.memories
    .filter(item => item.userId === userId && !isExpired(item))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Insert or update a memory item with deduplication
 * 
 * @param userId - User identifier
 * @param itemInput - Memory item data without id and timestamps
 * @returns The created or updated memory item
 */
export async function upsert(userId: string, itemInput: MemoryItemInput): Promise<MemoryItem> {
  const store = await loadMemoryStore();
  const now = new Date();
  
  // Check for existing duplicate
  const existing = findDuplicate(
    store.memories, 
    userId, 
    itemInput.type, 
    itemInput.key, 
    itemInput.person
  );
  
  if (existing) {
    // Update existing item if value has changed
    if (existing.value !== itemInput.value || existing.confidence !== itemInput.confidence) {
      existing.value = itemInput.value;
      existing.confidence = itemInput.confidence;
      existing.ttl = itemInput.ttl;
      existing.updatedAt = now;
      
      await saveMemoryStore(store);
      return existing;
    }
    
    // No changes needed
    return existing;
  }
  
  // Create new memory item
  const newItem: MemoryItem = {
    id: generateId(),
    userId,
    person: itemInput.person,
    type: itemInput.type,
    key: itemInput.key,
    value: itemInput.value,
    confidence: itemInput.confidence,
    ttl: itemInput.ttl,
    createdAt: now,
    updatedAt: now
  };
  
  store.memories.push(newItem);
  await saveMemoryStore(store);
  
  return newItem;
}

/**
 * Remove a memory item by ID
 * 
 * @param userId - User identifier (for security)
 * @param id - Memory item ID to remove
 * @returns True if item was removed, false if not found
 */
export async function remove(userId: string, id: string): Promise<boolean> {
  const store = await loadMemoryStore();
  
  const index = store.memories.findIndex(item => 
    item.id === id && item.userId === userId
  );
  
  if (index === -1) {
    return false; // Item not found
  }
  
  store.memories.splice(index, 1);
  await saveMemoryStore(store);
  
  return true;
}

/**
 * Remove expired memories based on TTL
 * 
 * @returns Number of expired items removed
 */
export async function expireSweep(): Promise<number> {
  const store = await loadMemoryStore();
  const initialCount = store.memories.length;
  
  // Filter out expired items
  store.memories = store.memories.filter(item => !isExpired(item));
  
  const removedCount = initialCount - store.memories.length;
  
  if (removedCount > 0) {
    store.lastSweep = new Date().toISOString();
    await saveMemoryStore(store);
  }
  
  return removedCount;
}

/**
 * Get memory statistics for a user
 * 
 * @param userId - User identifier
 * @returns Statistics about user's memories
 */
export async function getStats(userId: string): Promise<{
  total: number;
  byType: Record<string, number>;
  byPerson: Record<string, number>;
  expired: number;
}> {
  const store = await loadMemoryStore();
  const userMemories = store.memories.filter(item => item.userId === userId);
  
  const stats = {
    total: 0,
    byType: {} as Record<string, number>,
    byPerson: {} as Record<string, number>,
    expired: 0
  };
  
  for (const memory of userMemories) {
    if (isExpired(memory)) {
      stats.expired++;
    } else {
      stats.total++;
      
      stats.byType[memory.type] = (stats.byType[memory.type] || 0) + 1;
      
      const person = memory.person || 'self';
      stats.byPerson[person] = (stats.byPerson[person] || 0) + 1;
    }
  }
  
  return stats;
}

/**
 * Search memories by text content
 * 
 * @param userId - User identifier
 * @param searchText - Text to search for
 * @returns Matching memory items
 */
export async function search(userId: string, searchText: string): Promise<MemoryItem[]> {
  const memories = await listByUser(userId);
  const searchLower = searchText.toLowerCase();
  
  return memories.filter(memory => 
    memory.key.toLowerCase().includes(searchLower) ||
    memory.value.toLowerCase().includes(searchLower) ||
    (memory.person && memory.person.toLowerCase().includes(searchLower))
  );
}

/**
 * Clear all memories for a user (for testing/development)
 * 
 * @param userId - User identifier
 * @returns Number of memories removed
 */
export async function clearUser(userId: string): Promise<number> {
  const store = await loadMemoryStore();
  const initialCount = store.memories.length;
  
  store.memories = store.memories.filter(item => item.userId !== userId);
  
  const removedCount = initialCount - store.memories.length;
  
  if (removedCount > 0) {
    await saveMemoryStore(store);
  }
  
  return removedCount;
}
