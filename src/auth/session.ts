/**
 * Task: Cookie session helpers with user ID support.
 * - Cookie "sid", httpOnly, sameSite:lax, secure in prod.
 * - In-memory map: sid -> { userId: string }
 * - export createSession(res, userId): string
 * - export getSession(req): { sid?:string, userId?:string }
 * - export destroySession(res, sid)
 */
import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Session data interfaces
export interface UserData {
  id: string;
  name: string;
  email: string;
}

export interface TokenData {
  access: string;
  refresh?: string;
  exp: number; // expiration timestamp
}

export interface SessionData {
  userId: string; // Required user ID
  user?: UserData;
  tokens?: TokenData;
  createdAt: number;
  lastAccessed: number;
}

// In-memory session store (replace with Redis later)
const sessions: Map<string, SessionData> = new Map();

// Session configuration
const COOKIE_NAME = 'sid';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_me_to_a_secure_random_string';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Generate a secure session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sign a session ID with HMAC
 */
function signSessionId(sessionId: string): string {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  return hmac.digest('hex');
}

/**
 * Verify a signed session ID
 */
function verifySessionId(sessionId: string, signature: string): boolean {
  try {
    const expectedSignature = signSessionId(sessionId);
    // Ensure both signatures have the same length
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
  } catch (error) {
    // If there's any error in verification, return false
    return false;
  }
}

/**
 * Create a new session and set the cookie
 * @param res - Fastify reply object
 * @param userId - User ID to associate with the session
 * @returns Session ID
 */
export function createSession(res: FastifyReply, userId: string): string {
  const sessionId = generateSessionId();
  const signature = signSessionId(sessionId);
  const signedSessionId = `${sessionId}.${signature}`;

  // Initialize session data
  const sessionData: SessionData = {
    userId,
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  };

  sessions.set(sessionId, sessionData);

  // Set secure cookie
  res.setCookie(COOKIE_NAME, signedSessionId, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return sessionId;
}

/**
 * Get session ID and user ID from request cookie
 * @param req - Fastify request object
 * @returns Object with session ID and user ID if valid
 */
export function getSession(req: FastifyRequest): { sid?: string; userId?: string } {
  const signedSessionId = req.cookies[COOKIE_NAME];
  
  if (!signedSessionId) {
    return {};
  }

  const [sessionId, signature] = signedSessionId.split('.');
  
  if (!sessionId || !signature) {
    return {};
  }

  // Verify signature
  if (!verifySessionId(sessionId, signature)) {
    return {};
  }

  // Check if session exists and is not expired
  const sessionData = sessions.get(sessionId);
  if (!sessionData) {
    return {};
  }

  // Check if session is expired
  if (Date.now() - sessionData.createdAt > SESSION_MAX_AGE) {
    sessions.delete(sessionId);
    return {};
  }

  // Update last accessed time
  sessionData.lastAccessed = Date.now();
  sessions.set(sessionId, sessionData);

  return { 
    sid: sessionId,
    userId: sessionData.userId 
  };
}

/**
 * Set data for a session
 * @param sid - Session ID
 * @param data - Partial session data to merge
 */
export function setSessionData(sid: string, data: Partial<SessionData>): void {
  const existingData = sessions.get(sid);
  
  if (!existingData) {
    throw new Error(`Session ${sid} not found`);
  }

  const updatedData: SessionData = {
    ...existingData,
    ...data,
    lastAccessed: Date.now(),
  };

  sessions.set(sid, updatedData);
}

/**
 * Get data for a session
 * @param sid - Session ID
 * @returns Session data or undefined if not found
 */
export function getSessionData(sid: string): SessionData | undefined {
  const sessionData = sessions.get(sid);
  
  if (sessionData) {
    // Update last accessed time
    sessionData.lastAccessed = Date.now();
    sessions.set(sid, sessionData);
  }

  return sessionData;
}

/**
 * Destroy a session
 * @param res - Fastify reply object to clear cookie
 * @param sid - Session ID
 */
export function destroySession(res: FastifyReply, sid?: string): void {
  if (sid) {
    sessions.delete(sid);
  }
  
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const expiredSessions: string[] = [];

  for (const [sessionId, sessionData] of sessions.entries()) {
    if (now - sessionData.createdAt > SESSION_MAX_AGE) {
      expiredSessions.push(sessionId);
    }
  }

  for (const sessionId of expiredSessions) {
    sessions.delete(sessionId);
  }

  if (expiredSessions.length > 0) {
    console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
  }
}

/**
 * Get session statistics (for debugging/monitoring)
 */
export function getSessionStats(): { total: number; active: number } {
  const now = Date.now();
  let activeCount = 0;

  for (const sessionData of sessions.values()) {
    if (now - sessionData.lastAccessed < 30 * 60 * 1000) { // Active in last 30 minutes
      activeCount++;
    }
  }

  return {
    total: sessions.size,
    active: activeCount,
  };
}

// Setup periodic cleanup (every 30 minutes)
setInterval(cleanupExpiredSessions, 30 * 60 * 1000);

// Validate session secret on startup
if (SESSION_SECRET === 'change_me_to_a_secure_random_string') {
  console.warn('⚠️  WARNING: Using default SESSION_SECRET! Change it in production!');
}
