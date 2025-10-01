import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, getSession, destroySession } from '../auth/session.js';
import { requireAuth, optionalAuth, getCurrentUserId } from '../middleware/authGuard.js';

// Mock Fastify request and reply objects
const createMockRequest = (cookies: Record<string, string> = {}) => ({
  cookies,
  ip: '127.0.0.1'
} as any);

const createMockReply = () => {
  const reply = {
    sentResponse: null as any,
    sentStatus: null as number | null,
    cookies: {} as Record<string, any>,
    headers: {} as Record<string, string>,
    sent: false
  };

  const statusHandler = (code: number) => {
    reply.sentStatus = code;
    return {
      send: (data: any) => {
        reply.sentResponse = data;
        reply.sent = true;
        return reply;
      }
    };
  };

  return {
    ...reply,
    status: statusHandler,
    setCookie: (name: string, value: string, options: any) => {
      reply.cookies[name] = { value, options };
      return reply;
    },
    clearCookie: (name: string, options: any) => {
      reply.cookies[name] = { value: undefined, options };
      return reply;
    }
  } as any;
};

describe('Session and Auth Integration', () => {
  describe('Session Management', () => {
    it('should create a session with userId', () => {
      const reply = createMockReply();
      const userId = 'user123';
      
      const sessionId = createSession(reply, userId);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
      expect(reply.cookies.sid).toBeDefined();
    });

    it('should retrieve session with userId', () => {
      const reply = createMockReply();
      const userId = 'user123';
      
      // Create session
      const sessionId = createSession(reply, userId);
      const cookieValue = reply.cookies.sid.value;
      
      // Create request with cookie
      const request = createMockRequest({ sid: cookieValue });
      
      // Get session
      const session = getSession(request);
      
      expect(session.sid).toBe(sessionId);
      expect(session.userId).toBe(userId);
    });

    it('should return empty object for invalid session', () => {
      const request = createMockRequest({ sid: 'invalid.signature' });
      const session = getSession(request);
      
      expect(session).toEqual({});
    });

    it('should destroy session', () => {
      const reply = createMockReply();
      const userId = 'user123';
      
      // Create session
      const sessionId = createSession(reply, userId);
      
      // Destroy session
      const destroyReply = createMockReply();
      destroySession(destroyReply, sessionId);
      
      expect(destroyReply.cookies.sid.value).toBeUndefined();
    });
  });

  describe('Auth Guard', () => {
    it('should allow authenticated requests', async () => {
      const reply = createMockReply();
      const userId = 'user123';
      
      // Create session
      const sessionId = createSession(reply, userId);
      const cookieValue = reply.cookies.sid.value;
      
      // Create authenticated request
      const request = createMockRequest({ sid: cookieValue });
      const authReply = createMockReply();
      
      // Test auth guard
      await requireAuth(request, authReply);
      
      expect(authReply.sent).toBe(false);
      expect(request.userId).toBe(userId);
      expect(request.sid).toBe(sessionId);
    });

    it('should reject unauthenticated requests', async () => {
      const request = createMockRequest();
      const reply = createMockReply();
      
      await requireAuth(request, reply);
      
      expect(reply.sent).toBe(true);
      expect(reply.sentStatus).toBe(401);
      expect(reply.sentResponse).toEqual({ error: 'unauthorized' });
    });

    it('should reject requests with invalid session', async () => {
      const request = createMockRequest({ sid: 'invalid.session' });
      const reply = createMockReply();
      
      await requireAuth(request, reply);
      
      expect(reply.sent).toBe(true);
      expect(reply.sentStatus).toBe(401);
      expect(reply.sentResponse).toEqual({ error: 'unauthorized' });
    });

    it('should handle optional auth gracefully', async () => {
      // Test with no session
      const request1 = createMockRequest();
      const reply1 = createMockReply();
      
      await optionalAuth(request1, reply1);
      
      expect(reply1.sent).toBe(false);
      expect(request1.userId).toBeUndefined();
      
      // Test with valid session
      const createReply = createMockReply();
      const userId = 'user123';
      const sessionId = createSession(createReply, userId);
      const cookieValue = createReply.cookies.sid.value;
      
      const request2 = createMockRequest({ sid: cookieValue });
      const reply2 = createMockReply();
      
      await optionalAuth(request2, reply2);
      
      expect(reply2.sent).toBe(false);
      expect(request2.userId).toBe(userId);
      expect(request2.sid).toBe(sessionId);
    });

    it('should provide utility functions', () => {
      const request = createMockRequest();
      request.userId = 'user123';
      request.sid = 'session123';
      
      expect(getCurrentUserId(request)).toBe('user123');
    });
  });
});
