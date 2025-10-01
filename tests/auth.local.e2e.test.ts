/**
 * E2E Tests for Local Authentication
 * 
 * Tests the complete local authentication flow including:
 * - User registration with rate limiting
 * - Login with wrong/correct credentials 
 * - Session management and cookies
 * - User profile retrieval
 * - Logout functionality
 * - Rate limiting enforcement
 * - Audit logging verification
 */

import { test, expect, beforeAll, afterAll, describe, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildApp } from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Local Authentication E2E Tests', () => {
  let app: FastifyInstance;
  let auditLogPath: string;
  
  const testUser = {
    email: 'test-e2e@example.com',
    password: 'SecurePass123!',
    name: 'E2E Test User'
  };

  beforeAll(async () => {
    // Create Fastify app instance
    app = await buildApp();
    
    // Set up audit log path
    auditLogPath = path.join(__dirname, '..', 'src', 'data', 'auth.log');
    
    // Clear any existing audit log for clean test
    try {
      await fs.unlink(auditLogPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
    
    console.log('🚀 E2E Test Server ready');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
      console.log('🛑 E2E Test Server closed');
    }
  });

  beforeEach(async () => {
    // Clear rate limiting store between tests
    const { clearAllRateLimits } = await import('../src/middleware/rateLimit.js');
    clearAllRateLimits();
  });

  test('should register new user successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: testUser.email,
        password: testUser.password,
        name: testUser.name
      }
    });

    expect(response.statusCode).toBe(201); // Registration returns 201 Created
    
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
    expect(body.message).toContain('registered successfully');
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testUser.email);
    expect(body.user.name).toBe(testUser.name);
    
    // Check that sid cookie is set
    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(Array.isArray(setCookieHeader) ? setCookieHeader.join('') : setCookieHeader).toContain('sid=');

    // Verify audit log entry
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for file write
    const auditContent = await fs.readFile(auditLogPath, 'utf8').catch(() => '');
    expect(auditContent).toContain('"type":"register"'); // Adjust to actual format
    expect(auditContent).toContain(testUser.email);
  });

  test('should reject login with wrong password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: 'WrongPassword123!'
      }
    });

    expect(response.statusCode).toBe(401);
    
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('invalid_credentials'); // Adjust to actual error message

    // Verify audit log entry for failed login
    await new Promise(resolve => setTimeout(resolve, 100));
    const auditContent = await fs.readFile(auditLogPath, 'utf8').catch(() => '');
    expect(auditContent).toContain('"type":"login"'); // May be logged differently
    expect(auditContent).toContain(testUser.email);
  });

  test('should login successfully with correct credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password
      }
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
    expect(body.message).toContain('logged in successfully'); // Adjust to actual message
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testUser.email);

    // Check that sid cookie is set
    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(Array.isArray(setCookieHeader) ? setCookieHeader.join('') : setCookieHeader).toContain('sid=');

    // Verify audit log entry for successful login
    await new Promise(resolve => setTimeout(resolve, 100));
    const auditContent = await fs.readFile(auditLogPath, 'utf8').catch(() => '');
    expect(auditContent).toContain('"type":"login"');
    expect(auditContent).toContain(testUser.email);
  });

  test('should retrieve user profile with valid session', async () => {
    // First login to get session cookie
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password
      }
    });

    const setCookieHeader = loginResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const sidCookie = cookies.find(cookie => cookie?.startsWith('sid='));

    expect(sidCookie).toBeDefined();

    // Now test /api/me endpoint with session cookie
    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        cookie: sidCookie!
      }
    });

    expect(meResponse.statusCode).toBe(200);
    
    const body = JSON.parse(meResponse.body);
    expect(body.id).toBeDefined(); // User info format may be different
    expect(body.email).toBe(testUser.email);
    expect(body.name).toBe(testUser.name);
  });

  test('should fail to retrieve user profile without session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me'
    });

    expect(response.statusCode).toBe(401);
    
    const body = JSON.parse(response.body);
    expect(body.error).toContain('authenticated'); // Check for auth error
  });

  test('should logout successfully and clear session', async () => {
    // First login to get session cookie
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password
      }
    });

    const setCookieHeader = loginResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const sidCookie = cookies.find(cookie => cookie?.startsWith('sid='));

    // Test logout
    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: sidCookie!
      }
    });

    expect(logoutResponse.statusCode).toBe(200);
    
    const logoutBody = JSON.parse(logoutResponse.body);
    expect(logoutBody.ok).toBe(true);
    expect(logoutBody.message).toContain('Logged out successfully'); // Adjust to actual message

    // Check that session cookie is cleared
    const logoutSetCookie = logoutResponse.headers['set-cookie'];
    expect(logoutSetCookie).toBeDefined();
    const cookieString = Array.isArray(logoutSetCookie) ? logoutSetCookie.join('') : logoutSetCookie;
    expect(cookieString).toContain('sid=;'); // Empty value
    expect(cookieString).toContain('Max-Age=0'); // Immediate expiry

    // Verify subsequent /api/me call fails
    const meAfterLogoutResponse = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        cookie: sidCookie! // Using old cookie which should now be invalid
      }
    });

    expect(meAfterLogoutResponse.statusCode).toBe(401);
    
    const meBody = JSON.parse(meAfterLogoutResponse.body);
    expect(meBody.authenticated).toBe(false);

    // Verify audit log entry for logout
    await new Promise(resolve => setTimeout(resolve, 100));
    const auditContent = await fs.readFile(auditLogPath, 'utf8').catch(() => '');
    expect(auditContent).toContain('"type":"logout"');
    expect(auditContent).toContain(testUser.email);
  });

  test('should enforce rate limiting on login attempts', async () => {
    const testEmail = 'ratelimit-test@example.com';
    
    // Attempt 6 logins in rapid succession (limit is 5)
    const promises = [];
    for (let i = 0; i < 6; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: testEmail,
            password: 'wrongpassword'
          },
          headers: {
            'x-forwarded-for': '192.168.1.100' // Simulate consistent IP
          }
        })
      );
    }

    const responses = await Promise.all(promises);

    // First 5 should be 401 (wrong password)
    for (let i = 0; i < 5; i++) {
      expect(responses[i].statusCode).toBe(401);
      const body = JSON.parse(responses[i].body);
      expect(body.error).toContain('invalid_credentials'); // Adjust to actual error
    }

    // 6th should be 429 (rate limited)
    expect(responses[5].statusCode).toBe(429);
    const rateLimitBody = JSON.parse(responses[5].body);
    expect(rateLimitBody.error).toContain('Too many attempts');
    expect(rateLimitBody.retryAfter).toBeDefined();
  });

  test('should enforce rate limiting on registration attempts', async () => {
    // Attempt 6 registrations in rapid succession
    const promises = [];
    for (let i = 0; i < 6; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/api/auth/register',
          payload: {
            email: `ratelimit${i}@example.com`,
            password: 'TestPass123!',
            name: `Test User ${i}`
          },
          headers: {
            'x-forwarded-for': '192.168.1.101' // Simulate consistent IP
          }
        })
      );
    }

    const responses = await Promise.all(promises);

    // First 5 should succeed (201)
    for (let i = 0; i < 5; i++) {
      expect(responses[i].statusCode).toBe(201); // Registration returns 201
    }

    // 6th should be rate limited (429)
    expect(responses[5].statusCode).toBe(429);
    const rateLimitBody = JSON.parse(responses[5].body);
    expect(rateLimitBody.error).toContain('Too many attempts');
  });

  test('should handle concurrent login attempts gracefully', async () => {
    // Test concurrent valid logins don't cause issues
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: testUser.email,
            password: testUser.password
          },
          headers: {
            'x-forwarded-for': `192.168.1.${200 + i}` // Different IPs
          }
        })
      );
    }

    const responses = await Promise.all(promises);

    // All should succeed since they're from different IPs
    responses.forEach(response => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });
  });

  test('should validate input data properly', async () => {
    // Test registration with missing fields
    const invalidRegisterResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'invalid@example.com'
        // Missing password and name
      }
    });

    expect(invalidRegisterResponse.statusCode).toBe(400);

    // Test login with missing fields
    const invalidLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com'
        // Missing password
      }
    });

    expect(invalidLoginResponse.statusCode).toBe(400);

    // Test registration with invalid email
    const invalidEmailResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'ValidPass123!',
        name: 'Test User'
      }
    });

    expect(invalidEmailResponse.statusCode).toBe(400);
  });

  test('should handle duplicate registration attempts', async () => {
    // Try to register the same user again
    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: testUser.email, // This email was already registered
        password: 'AnotherPassword123!',
        name: 'Another Name'
      }
    });

    expect(duplicateResponse.statusCode).toBe(409);
    
    const body = JSON.parse(duplicateResponse.body);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('exists'); // Adjust to actual error message
  });

  test('should maintain audit log integrity', async () => {
    // Check that audit log contains properly formatted JSONL
    const auditContent = await fs.readFile(auditLogPath, 'utf8').catch(() => '');
    
    if (auditContent.trim()) {
      const lines = auditContent.trim().split('\n');
      
      lines.forEach((line, index) => {
        try {
          const event = JSON.parse(line);
          
          // Verify required fields exist (may have different names)
          expect(event.timestamp).toBeDefined();
          expect(event.type || event.eventType).toBeDefined(); // Handle both formats
          expect(event.ip || event.ipAddress).toBeDefined();
          
          // Verify timestamp format
          expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
          
        } catch (error) {
          throw new Error(`Invalid JSONL at line ${index + 1}: ${line}`);
        }
      });
      
      console.log(`✅ Audit log integrity verified: ${lines.length} events`);
    }
  });
});
