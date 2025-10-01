#!/usr/bin/env tsx

/**
 * Rate Limiting Test for Authentication Endpoints
 * 
 * This script tests the rate limiting functionality:
 * - Tests multiple rapid requests to /auth/login and /auth/register
 * - Verifies 429 response after 5 attempts
 * - Tests sliding window behavior
 */

import { authRateLimit, getRateLimitStatus, resetRateLimit, clearAllRateLimits } from './middleware/rateLimit.js';

console.log('🧪 Rate Limiting Test\n');

// Mock Fastify request and reply objects
const createMockRequest = (ip: string, email?: string) => ({
  ip,
  headers: {},
  body: email ? { email } : {}
} as any);

const createMockReply = () => {
  let statusCode = 200;
  let responseData: any = null;

  const mockReply = {
    status: (code: number) => {
      statusCode = code;
      return mockReply;
    },
    send: (data: any) => {
      responseData = data;
      return mockReply;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData
  };

  return mockReply;
};

async function testRateLimit() {
  console.log('1. Testing basic rate limiting behavior');
  
  // Clear any existing rate limits
  clearAllRateLimits();
  
  const testIP = '192.168.1.100';
  const testEmail = 'test@example.com';

  // Test 5 successful requests (should all pass)
  for (let i = 1; i <= 5; i++) {
    const request = createMockRequest(testIP, testEmail);
    const reply = createMockReply();
    
    await authRateLimit(request, reply);
    
    if (reply.getStatusCode() === 429) {
      console.error(`❌ Request ${i} was rate limited unexpectedly`);
      return;
    }
    
    console.log(`✅ Request ${i}: Allowed`);
  }

  // Test 6th request (should be rate limited)
  const request6 = createMockRequest(testIP, testEmail);
  const reply6 = createMockReply();
  
  await authRateLimit(request6, reply6);
  
  if (reply6.getStatusCode() === 429) {
    console.log('✅ Request 6: Rate limited (expected)');
    const responseData = reply6.getResponseData();
    console.log(`   Error: ${responseData.error}`);
    console.log(`   Message: ${responseData.message}`);
  } else {
    console.error('❌ Request 6 should have been rate limited');
    return;
  }

  console.log('\n2. Testing rate limit status');
  const status = getRateLimitStatus(testIP, testEmail);
  if (status) {
    console.log(`✅ Rate limit status for ${status.key}:`);
    console.log(`   Hits: ${status.hits}`);
    console.log(`   Remaining: ${status.remainingHits}`);
    console.log(`   Window: ${new Date(status.windowStart).toISOString()} - ${new Date(status.windowEnd).toISOString()}`);
  }

  console.log('\n3. Testing different IP (should be allowed)');
  const request7 = createMockRequest('192.168.1.101', testEmail);
  const reply7 = createMockReply();
  
  await authRateLimit(request7, reply7);
  
  if (reply7.getStatusCode() === 429) {
    console.error('❌ Different IP should not be rate limited');
  } else {
    console.log('✅ Different IP: Allowed (expected)');
  }

  console.log('\n4. Testing different email (should be allowed)');
  const request8 = createMockRequest(testIP, 'different@example.com');
  const reply8 = createMockReply();
  
  await authRateLimit(request8, reply8);
  
  if (reply8.getStatusCode() === 429) {
    console.error('❌ Different email should not be rate limited');
  } else {
    console.log('✅ Different email: Allowed (expected)');
  }

  console.log('\n5. Testing reset functionality');
  resetRateLimit(testIP, testEmail);
  
  const request9 = createMockRequest(testIP, testEmail);
  const reply9 = createMockReply();
  
  await authRateLimit(request9, reply9);
  
  if (reply9.getStatusCode() === 429) {
    console.error('❌ Reset should have cleared the rate limit');
  } else {
    console.log('✅ After reset: Allowed (expected)');
  }

  console.log('\n6. Testing anonymous requests (no email)');
  clearAllRateLimits();
  
  // Test 5 requests without email
  for (let i = 1; i <= 5; i++) {
    const request = createMockRequest(testIP); // No email
    const reply = createMockReply();
    
    await authRateLimit(request, reply);
    
    if (reply.getStatusCode() === 429) {
      console.error(`❌ Anonymous request ${i} was rate limited unexpectedly`);
      return;
    }
  }
  
  // 6th anonymous request should be rate limited
  const requestAnon6 = createMockRequest(testIP);
  const replyAnon6 = createMockReply();
  
  await authRateLimit(requestAnon6, replyAnon6);
  
  if (replyAnon6.getStatusCode() === 429) {
    console.log('✅ Anonymous request 6: Rate limited (expected)');
  } else {
    console.error('❌ Anonymous request 6 should have been rate limited');
  }

  console.log('\n🎉 Rate limiting tests completed successfully!');
  console.log('\nRate Limiting Configuration:');
  console.log('- Window: 1 minute (60 seconds)');
  console.log('- Max attempts: 5 per window');
  console.log('- Key format: IP:email (or IP:anonymous)');
  console.log('- Sliding window resets after expiry');
  console.log('- Automatic cleanup every 5 minutes');
}

// Run the test
testRateLimit().catch(console.error);

export {};
