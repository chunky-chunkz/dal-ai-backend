/**
 * Task: Very simple in-memory rate limit for /auth/login & /auth/register.
 * - key = ip + email (if present)
 * - window 1 minute, max 5 hits -> 429 {error:"too_many_requests"}
 * - Reset sliding window.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  hits: number;
  windowStart: number;
}

// In-memory storage for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute in milliseconds
const RATE_LIMIT_MAX_HITS = 5;

/**
 * Generate rate limit key from IP and email
 * @param ip - Client IP address
 * @param email - Email from request body (if present)
 * @returns Rate limit key string
 */
function generateRateLimitKey(ip: string, email?: string): string {
  // Use IP + email for more specific rate limiting
  // If no email, just use IP
  return email ? `${ip}:${email.toLowerCase()}` : `${ip}:anonymous`;
}

/**
 * Check if request should be rate limited
 * @param key - Rate limit key
 * @returns true if rate limited, false if allowed
 */
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    // First request for this key
    rateLimitStore.set(key, {
      hits: 1,
      windowStart: now
    });
    return false;
  }

  // Check if window has expired (sliding window)
  if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Reset window
    rateLimitStore.set(key, {
      hits: 1,
      windowStart: now
    });
    return false;
  }

  // Within the same window
  if (entry.hits >= RATE_LIMIT_MAX_HITS) {
    return true; // Rate limited
  }

  // Increment hit count
  entry.hits++;
  rateLimitStore.set(key, entry);
  return false;
}

/**
 * Cleanup expired entries from rate limit store
 * This prevents memory leaks in long-running applications
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  // Use Array.from to convert iterator to array for compatibility
  const entries = Array.from(rateLimitStore.entries());
  
  for (const [key, entry] of entries) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      expiredKeys.push(key);
    }
  }

  // Remove expired entries
  expiredKeys.forEach(key => rateLimitStore.delete(key));
}

/**
 * Rate limiting middleware for authentication endpoints
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function authRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get client IP
    const clientIP = request.ip || 
                     request.headers['x-forwarded-for'] as string || 
                     request.headers['x-real-ip'] as string ||
                     'unknown';

    // Extract email from request body if present
    let email: string | undefined;
    if (request.body && typeof request.body === 'object' && 'email' in request.body) {
      email = (request.body as any).email;
    }

    // Generate rate limit key
    const rateLimitKey = generateRateLimitKey(clientIP, email);

    // Check if rate limited
    if (isRateLimited(rateLimitKey)) {
      // Rate limited - return 429 error
      reply.status(429).send({
        error: 'too_many_requests',
        message: 'Too many authentication attempts. Please try again in a minute.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) // seconds
      });
      return;
    }

    // Periodically cleanup expired entries (every 100 requests)
    if (Math.random() < 0.01) { // 1% chance
      cleanupExpiredEntries();
    }

  } catch (error) {
    // Log error but don't block the request
    console.error('Rate limit middleware error:', error);
    // Continue processing the request
  }
}

/**
 * Get current rate limit status for a key (useful for debugging)
 * @param ip - Client IP
 * @param email - Email (optional)
 * @returns Rate limit info or null if no entry exists
 */
export function getRateLimitStatus(ip: string, email?: string): {
  key: string;
  hits: number;
  remainingHits: number;
  windowStart: number;
  windowEnd: number;
} | null {
  const key = generateRateLimitKey(ip, email);
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    return null;
  }

  return {
    key,
    hits: entry.hits,
    remainingHits: Math.max(0, RATE_LIMIT_MAX_HITS - entry.hits),
    windowStart: entry.windowStart,
    windowEnd: entry.windowStart + RATE_LIMIT_WINDOW_MS
  };
}

/**
 * Reset rate limit for a specific key (useful for testing or admin purposes)
 * @param ip - Client IP
 * @param email - Email (optional)
 * @returns true if entry was found and reset, false otherwise
 */
export function resetRateLimit(ip: string, email?: string): boolean {
  const key = generateRateLimitKey(ip, email);
  return rateLimitStore.delete(key);
}

/**
 * Get total number of rate limit entries (for monitoring)
 * @returns Number of active rate limit entries
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}

/**
 * Clear all rate limit entries (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

export default authRateLimit;
