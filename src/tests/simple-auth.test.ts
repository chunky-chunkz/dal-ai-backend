import { describe, it, expect } from 'vitest';
import { createSession, getSession } from '../auth/session';
import { requireAuth } from '../middleware/authGuard';

describe('Simple Auth Test', () => {
  it('should work with basic session flow', async () => {
    // Test session creation and retrieval
    const mockReply = {
      setCookie: () => {},
      clearCookie: () => {}
    } as any;
    
    const userId = 'test-user';
    const sessionId = createSession(mockReply, userId);
    
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
  });
  
  it('should reject unauthenticated request', async () => {
    const request = { cookies: {} } as any;
    let statusCode: number | undefined;
    let responseBody: any;
    let sent = false;
    
    const reply = {
      status: (code: number) => {
        statusCode = code;
        return {
          send: (body: any) => {
            responseBody = body;
            sent = true;
            return reply;
          }
        };
      }
    } as any;
    
    await requireAuth(request, reply);
    
    expect(sent).toBe(true);
    expect(statusCode).toBe(401);
    expect(responseBody).toEqual({ error: 'unauthorized' });
  });
});
