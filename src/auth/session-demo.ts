/**
 * Demo of session management and auth guard functionality
 */

import { createSession, getSession, destroySession } from './session';
import { requireAuth, optionalAuth, getCurrentUserId } from '../middleware/authGuard';

async function demonstrateSessionAuth() {
  console.log('=== Session & Auth Demo ===\n');

  // Mock objects for demonstration
  const mockReply = {
    cookieSet: null as any,
    cleared: false,
    setCookie: function(name: string, value: string, options: any) {
      this.cookieSet = { name, value, options };
      console.log(`🍪 Cookie set: ${name} = ${value.substring(0, 20)}...`);
    },
    clearCookie: function(name: string, _options: any) {
      this.cleared = true;
      console.log(`🗑️ Cookie cleared: ${name}`);
    }
  };

  const createMockRequest = (cookies: Record<string, string> = {}) => ({
    cookies,
    ip: '127.0.0.1'
  });

  const createMockAuthReply = () => {
    let sent = false;
    let status: number | undefined;
    let body: any;
    
    return {
      sent,
      status: (code: number) => ({
        send: (data: any) => {
          sent = true;
          status = code;
          body = data;
          console.log(`📤 Response: ${code} - ${JSON.stringify(data)}`);
          return { sent, status, body };
        }
      })
    };
  };

  try {
    // 1. Create a session
    console.log('1. Creating Session:');
    const userId = 'user123';
    const sessionId = createSession(mockReply as any, userId);
    console.log(`✅ Session created: ${sessionId}`);
    console.log(`   User ID: ${userId}\n`);

    // 2. Test session retrieval
    console.log('2. Retrieving Session:');
    if (mockReply.cookieSet) {
      const request = createMockRequest({ [mockReply.cookieSet.name]: mockReply.cookieSet.value });
      const session = getSession(request as any);
      console.log(`✅ Session retrieved: ${session.sid}`);
      console.log(`   User ID: ${session.userId}\n`);

      // 3. Test authentication with valid session
      console.log('3. Testing Valid Authentication:');
      const authRequest = createMockRequest({ [mockReply.cookieSet.name]: mockReply.cookieSet.value });
      const authReply = createMockAuthReply();
      
      await requireAuth(authRequest as any, authReply as any);
      
      if (!authReply.sent) {
        console.log(`✅ Authentication successful`);
        console.log(`   Request userId attached: ${(authRequest as any).userId}`);
        console.log(`   Request sid attached: ${(authRequest as any).sid}\n`);
      }
    }

    // 4. Test authentication without session
    console.log('4. Testing Invalid Authentication:');
    const invalidRequest = createMockRequest();
    const invalidReply = createMockAuthReply();
    
    await requireAuth(invalidRequest as any, invalidReply as any);
    console.log(''); // Just for spacing

    // 5. Test optional authentication
    console.log('5. Testing Optional Authentication:');
    const optionalRequest = createMockRequest();
    const optionalReply = createMockAuthReply();
    
    await optionalAuth(optionalRequest as any, optionalReply as any);
    console.log(`✅ Optional auth completed without error`);
    console.log(`   Request userId: ${(optionalRequest as any).userId || 'undefined'}\n`);

    // 6. Test session destruction
    console.log('6. Destroying Session:');
    const destroyReply = {
      clearCookie: function(name: string, _options: any) {
        console.log(`🗑️ Session destroyed, cookie cleared: ${name}`);
      }
    };
    
    destroySession(destroyReply as any, sessionId);
    console.log(`✅ Session ${sessionId} destroyed\n`);

    // 7. Test utility functions
    console.log('7. Testing Utility Functions:');
    const utilRequest = { userId: 'util-user', sid: 'util-session' };
    const currentUserId = getCurrentUserId(utilRequest as any);
    console.log(`✅ getCurrentUserId: ${currentUserId}`);

  } catch (error) {
    console.error('❌ Error in demo:', error);
  }

  console.log('\n=== Demo Complete ===');
}

// Export for testing
export default demonstrateSessionAuth;

// Run if executed directly
demonstrateSessionAuth().catch(console.error);
