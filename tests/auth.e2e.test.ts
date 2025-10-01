/**
 * Task: E2E test skeleton (mock Graph).
 * - Start app with test config.
 * - Mock token exchange and /me using nock or undici mock.
 * - Flow: GET /auth/login -> 302, state stored
 * - GET /auth/callback?code=... -> sets cookie sid, redirects to FRONTEND_ORIGIN
 * - GET /api/me -> 200 with user
 */

import { test, expect, beforeAll, afterAll, beforeEach, afterEach, describe } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import nock from 'nock';

// Test configuration
const TEST_CONFIG = {
  MS_CLIENT_ID: 'test-client-id',
  MS_CLIENT_SECRET: 'test-client-secret',
  MS_TENANT_ID: 'common',
  SESSION_SECRET: 'test-session-secret-32-chars-long!',
  FRONTEND_ORIGIN: 'http://localhost:3000',
  CORS_ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
  USE_PKCE: 'true'
};

// Mock Microsoft Graph responses
const MOCK_TOKEN_RESPONSE = {
  access_token: 'mock-access-token-12345',
  refresh_token: 'mock-refresh-token-67890',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: 'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Mail.Read'
};

const MOCK_USER_RESPONSE = {
  id: 'test-user-12345',
  displayName: 'Test User',
  mail: 'test.user@example.com',
  userPrincipalName: 'test.user@example.com',
  jobTitle: 'Software Engineer',
  officeLocation: 'Building 1'
};

const MOCK_CALENDAR_EVENTS = {
  value: [
    {
      subject: 'Team Meeting',
      start: {
        dateTime: '2025-09-09T14:00:00Z',
        timeZone: 'UTC'
      },
      location: {
        displayName: 'Conference Room A'
      }
    },
    {
      subject: 'Project Review',
      start: {
        dateTime: '2025-09-09T16:00:00Z',
        timeZone: 'UTC'
      }
    }
  ]
};

const MOCK_UNREAD_EMAILS = {
  value: [
    {
      subject: 'Important Update',
      receivedDateTime: '2025-09-09T12:00:00Z',
      from: {
        emailAddress: {
          name: 'John Doe',
          address: 'john.doe@example.com'
        }
      },
      isRead: false
    }
  ]
};

describe('OAuth Authentication E2E Tests', () => {
  let app: FastifyInstance;
  let testPort: number;

  beforeAll(async () => {
    // Set test environment variables
    Object.entries(TEST_CONFIG).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Build app with test config
    app = await buildApp();
    
    // Start server on random port
    await app.listen({ port: 0, host: '127.0.0.1' });
    
    // Get the actual port
    const address = app.server.address();
    testPort = typeof address === 'object' && address ? address.port : 0;
    
    console.log(`🧪 Test server running on port ${testPort}`);
  });

  afterAll(async () => {
    // Close server
    if (app) {
      await app.close();
    }
    
    // Clean up environment
    Object.keys(TEST_CONFIG).forEach(key => {
      delete process.env[key];
    });
  });

  beforeEach(() => {
    // Clear any existing nock interceptors
    nock.cleanAll();
  });

  afterEach(() => {
    // Ensure all mocks were called
    if (!nock.isDone()) {
      console.warn('⚠️ Not all nock interceptors were used:', nock.pendingMocks());
    }
    nock.cleanAll();
  });

  test('Health check endpoint works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  test('OAuth login flow initiates correctly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/login'
    });

    // Should redirect to Microsoft OAuth
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('login.microsoftonline.com');
    expect(response.headers.location).toContain('client_id=test-client-id');
    expect(response.headers.location).toContain('response_type=code');
    expect(response.headers.location).toContain('scope=');
    
    // Should set session cookie
    const cookies = response.cookies;
    expect(cookies).toBeDefined();
    expect(cookies.some(cookie => cookie.name === 'sid')).toBe(true);
    
    // Should include PKCE parameters
    expect(response.headers.location).toContain('code_challenge=');
    expect(response.headers.location).toContain('code_challenge_method=S256');
    
    console.log('✅ OAuth login initiated with PKCE');
  });

  test('OAuth callback completes authentication flow', async () => {
    // Mock Microsoft token endpoint
    const tokenScope = nock('https://login.microsoftonline.com')
      .post(`/common/oauth2/v2.0/token`)
      .reply(200, MOCK_TOKEN_RESPONSE);

    // Mock Microsoft Graph /me endpoint
    const graphScope = nock('https://graph.microsoft.com')
      .get('/v1.0/me')
      .matchHeader('authorization', 'Bearer mock-access-token-12345')
      .reply(200, MOCK_USER_RESPONSE);

    // First, initiate login to get session
    const loginResponse = await app.inject({
      method: 'GET',
      url: '/auth/login'
    });

    expect(loginResponse.statusCode).toBe(302);
    const sessionCookie = loginResponse.cookies.find(cookie => cookie.name === 'sid');
    expect(sessionCookie).toBeDefined();

    // Extract state parameter from redirect URL
    const redirectUrl = new URL(loginResponse.headers.location as string);
    const state = redirectUrl.searchParams.get('state');
    expect(state).toBeDefined();

    // Simulate OAuth callback
    const callbackResponse = await app.inject({
      method: 'GET',
      url: `/auth/callback?code=mock-auth-code&state=${state}`,
      cookies: {
        sid: sessionCookie!.value
      }
    });

    // Should redirect to frontend
    expect(callbackResponse.statusCode).toBe(302);
    expect(callbackResponse.headers.location).toBe('http://localhost:3000/app');

    // Verify all mocks were called
    expect(tokenScope.isDone()).toBe(true);
    expect(graphScope.isDone()).toBe(true);

    console.log('✅ OAuth callback flow completed successfully');
  });

  test('Protected /api/me endpoint returns user data', async () => {
    // Mock Microsoft Graph /me endpoint
    const graphScope = nock('https://graph.microsoft.com')
      .get('/v1.0/me')
      .matchHeader('authorization', 'Bearer mock-access-token-12345')
      .reply(200, MOCK_USER_RESPONSE);

    // Complete authentication flow first
    const { sessionCookie } = await completeAuthFlow();

    // Call protected endpoint
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      cookies: {
        sid: sessionCookie
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.id).toBe('test-user-12345');
    expect(body.displayName).toBe('Test User');
    expect(body.email).toBe('test.user@example.com');
    expect(body.jobTitle).toBe('Software Engineer');
    expect(body.officeLocation).toBe('Building 1');

    expect(graphScope.isDone()).toBe(true);
    console.log('✅ Protected /api/me endpoint works');
  });

  test('Protected /api/outlook/events endpoint returns calendar events', async () => {
    // Mock Microsoft Graph events endpoint
    const eventsScope = nock('https://graph.microsoft.com')
      .get('/v1.0/me/events')
      .query(true) // Accept any query parameters
      .matchHeader('authorization', 'Bearer mock-access-token-12345')
      .reply(200, MOCK_CALENDAR_EVENTS);

    // Complete authentication flow first
    const { sessionCookie } = await completeAuthFlow();

    // Call calendar events endpoint
    const response = await app.inject({
      method: 'GET',
      url: '/api/outlook/events?limit=3',
      cookies: {
        sid: sessionCookie
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.events).toBeDefined();
    expect(body.count).toBe(2);
    expect(body.events[0].subject).toBe('Team Meeting');
    expect(body.events[0].location).toBe('Conference Room A');
    expect(body.events[0].formattedStart).toBeDefined();

    expect(eventsScope.isDone()).toBe(true);
    console.log('✅ Protected /api/outlook/events endpoint works');
  });

  test('Protected /api/outlook/unread endpoint returns unread emails', async () => {
    // Mock Microsoft Graph unread emails endpoint
    const emailsScope = nock('https://graph.microsoft.com')
      .get('/v1.0/me/mailFolders/Inbox/messages')
      .query(true) // Accept any query parameters
      .matchHeader('authorization', 'Bearer mock-access-token-12345')
      .reply(200, MOCK_UNREAD_EMAILS);

    // Complete authentication flow first
    const { sessionCookie } = await completeAuthFlow();

    // Call unread emails endpoint
    const response = await app.inject({
      method: 'GET',
      url: '/api/outlook/unread?limit=5',
      cookies: {
        sid: sessionCookie
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.emails).toBeDefined();
    expect(body.count).toBe(1);
    expect(body.emails[0].subject).toBe('Important Update');
    expect(body.emails[0].from).toBe('John Doe <john.doe@example.com>');
    expect(body.emails[0].formattedReceived).toBeDefined();

    expect(emailsScope.isDone()).toBe(true);
    console.log('✅ Protected /api/outlook/unread endpoint works');
  });

  test('Logout flow works correctly', async () => {
    // Complete authentication flow first
    const { sessionCookie } = await completeAuthFlow();

    // Verify user is authenticated
    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/me',
      cookies: {
        sid: sessionCookie
      }
    });
    expect(meResponse.statusCode).toBe(200);

    // Logout
    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {
        sid: sessionCookie
      }
    });

    expect(logoutResponse.statusCode).toBe(200);
    const body = JSON.parse(logoutResponse.body);
    expect(body.ok).toBe(true);

    // Verify session is cleared
    const meAfterLogout = await app.inject({
      method: 'GET',
      url: '/api/me',
      cookies: {
        sid: sessionCookie
      }
    });
    expect(meAfterLogout.statusCode).toBe(502);

    console.log('✅ Logout flow works correctly');
  });

  test('Unauthenticated requests are rejected', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me'
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('unauthorized');
  });

  test('Invalid session requests are rejected', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      cookies: {
        sid: 'invalid-session-id'
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('unauthorized');
  });

  // Helper function to complete the full auth flow
  async function completeAuthFlow(): Promise<{ sessionCookie: string }> {
    // Mock token and user endpoints
    nock('https://login.microsoftonline.com')
      .post(`/common/oauth2/v2.0/token`)
      .reply(200, MOCK_TOKEN_RESPONSE);

    nock('https://graph.microsoft.com')
      .get('/v1.0/me')
      .matchHeader('authorization', 'Bearer mock-access-token-12345')
      .reply(200, MOCK_USER_RESPONSE);

    // Initiate login
    const loginResponse = await app.inject({
      method: 'GET',
      url: '/auth/login'
    });

    const sessionCookie = loginResponse.cookies.find(cookie => cookie.name === 'sid');
    expect(sessionCookie).toBeDefined();

    // Extract state
    const redirectUrl = new URL(loginResponse.headers.location as string);
    const state = redirectUrl.searchParams.get('state');

    // Complete callback
    const callbackResponse = await app.inject({
      method: 'GET',
      url: `/auth/callback?code=mock-auth-code&state=${state}`,
      cookies: {
        sid: sessionCookie!.value
      }
    });

    expect(callbackResponse.statusCode).toBe(302);

    return { sessionCookie: sessionCookie!.value };
  }
});
