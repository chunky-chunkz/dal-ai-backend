/**
 * Task: requireAuth preHandler.
 * - If no session/user -> 401 {error:"unauthorized"}.
 * - Attach req.userId for handlers.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSession } from '../auth/session.js';

// Extend Fastify Request to include userId and session ID
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    sid?: string;
  }
}

/**
 * Authentication guard middleware
 * Checks for valid session and userId, attaches userId to request
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get session from request
    const session = getSession(request);
    
    if (!session.sid || !session.userId) {
      return reply.status(401).send({ 
        error: 'unauthorized'
      });
    }
    
    // Attach userId and session ID to request for downstream handlers
    request.userId = session.userId;
    request.sid = session.sid;
    
  } catch (error) {
    console.error('❌ Error in authentication guard:', error);
    return reply.status(500).send({ 
      error: 'internal_error',
      message: 'Authentication check failed' 
    });
  }
}

/**
 * Optional authentication middleware
 * Similar to requireAuth but doesn't fail if user is not authenticated
 * Just attaches userId if available
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    // Get session from request
    const session = getSession(request);
    
    console.log('🔐 Optional auth check:', {
      hasSid: !!session.sid,
      hasUserId: !!session.userId,
      sessionId: session.sid?.substring(0, 8),
      userId: session.userId?.substring(0, 8)
    });
    
    if (session.sid && session.userId) {
      // Attach userId and session ID to request
      request.userId = session.userId;
      request.sid = session.sid;
      console.log('✅ User authenticated:', session.userId.substring(0, 8));
    } else {
      console.log('⚠️ No valid session found');
    }
    
  } catch (error) {
    console.error('⚠️ Error in optional authentication guard:', error);
    // Don't fail the request for optional auth
  }
}

/**
 * Rate limiting helper (basic implementation)
 * Can be combined with auth middleware
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  options: { maxRequests: number; windowMs: number } = { maxRequests: 100, windowMs: 60000 }
): Promise<void> {
  const identifier = request.userId || request.ip;
  const now = Date.now();
  
  const userLimit = rateLimitMap.get(identifier);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit window
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + options.windowMs
    });
    return;
  }
  
  if (userLimit.count >= options.maxRequests) {
    console.log(`❌ Rate limit exceeded for: ${identifier}`);
    return reply.status(429).send({
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later'
    });
  }
  
  // Increment counter
  userLimit.count++;
  rateLimitMap.set(identifier, userLimit);
}

/**
 * Combined auth + rate limit middleware
 */
export async function requireAuthWithRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);
  
  if (!reply.sent) {
    await rateLimit(request, reply);
  }
}

/**
 * Utility function to get current user ID from request
 * Can be used in route handlers after auth middleware
 */
export function getCurrentUserId(request: FastifyRequest): string | null {
  return request.userId || null;
}

/**
 * Utility function to get current session ID from request
 * Can be used in route handlers after auth middleware
 */
export function getCurrentSessionId(request: FastifyRequest): string | null {
  return request.sid || null;
}
