/**
 * In-memory answer cache with TTL (Time To Live)
 * Provides caching for QA answers to improve response times
 */

interface CacheEntry {
  value: {
    answer: string;
    confidence: number;
    sourceId?: string;
  };
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  evictions: number;
}

class AnswerCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    evictions: 0
  };

  /**
   * Normalize a question for consistent cache keys
   * - Convert to lowercase
   * - Remove punctuation
   * - Collapse multiple whitespaces to single space
   * - Trim leading/trailing whitespace
   */
  private normalizeKey(question: string): string {
    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Collapse whitespace
      .trim();
  }

  /**
   * Clean up expired entries from cache
   */
  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      this.stats.entries = this.cache.size;
    }
  }

  /**
   * Store an answer in the cache
   * @param key - The question or cache key
   * @param value - The answer data to cache
   * @param ttlMs - Time to live in milliseconds (default: 1 hour)
   */
  put(
    key: string,
    value: {
      answer: string;
      confidence: number;
      sourceId?: string;
    },
    ttlMs: number = 3600000 // 1 hour default
  ): void {
    // Normalize the key
    const normalizedKey = this.normalizeKey(key);
    
    // Clean up expired entries before adding new one
    this.evictExpired();

    // Calculate expiration time
    const expiresAt = Date.now() + ttlMs;

    // Store the entry
    const wasNewEntry = !this.cache.has(normalizedKey);
    this.cache.set(normalizedKey, {
      value: { ...value }, // Clone to avoid external mutations
      expiresAt
    });

    // Update stats
    if (wasNewEntry) {
      this.stats.entries++;
    }
  }

  /**
   * Retrieve an answer from the cache
   * @param key - The question or cache key
   * @returns The cached answer or null if not found/expired
   */
  get(key: string): {
    answer: string;
    confidence: number;
    sourceId?: string;
  } | null {
    // Normalize the key
    const normalizedKey = this.normalizeKey(key);

    // Clean up expired entries
    this.evictExpired();

    // Check if entry exists and is not expired
    const entry = this.cache.get(normalizedKey);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (entry.expiresAt <= now) {
      // Entry expired, remove it
      this.cache.delete(normalizedKey);
      this.stats.evictions++;
      this.stats.entries--;
      this.stats.misses++;
      return null;
    }

    // Cache hit
    this.stats.hits++;
    return { ...entry.value }; // Clone to avoid external mutations
  }

  /**
   * Check if a key exists in cache (without affecting stats)
   * @param key - The question or cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    const normalizedKey = this.normalizeKey(key);
    const entry = this.cache.get(normalizedKey);
    
    if (!entry) return false;
    
    const now = Date.now();
    return entry.expiresAt > now;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.stats.evictions += entriesCleared;
    this.stats.entries = 0;
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      entries: this.cache.size,
      evictions: 0
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Get current cache size
   */
  size(): number {
    this.evictExpired(); // Clean up before reporting size
    return this.cache.size;
  }

  /**
   * Get all cache keys (for debugging)
   */
  keys(): string[] {
    this.evictExpired();
    return Array.from(this.cache.keys());
  }
}

// Export singleton instance
const answerCache = new AnswerCache();

// Export the main functions
export function put(
  key: string,
  value: {
    answer: string;
    confidence: number;
    sourceId?: string;
  },
  ttlMs: number = 3600000
): void {
  answerCache.put(key, value, ttlMs);
}

export function get(key: string): {
  answer: string;
  confidence: number;
  sourceId?: string;
} | null {
  return answerCache.get(key);
}

// Export additional utility functions
export function has(key: string): boolean {
  return answerCache.has(key);
}

export function clear(): void {
  answerCache.clear();
}

export function resetStats(): void {
  answerCache.resetStats();
}

export function getStats() {
  return answerCache.getStats();
}

export function size(): number {
  return answerCache.size();
}

export function keys(): string[] {
  return answerCache.keys();
}

// Export the normalize function for external use
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim();
}
