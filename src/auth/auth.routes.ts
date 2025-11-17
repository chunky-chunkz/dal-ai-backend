/**
 * Unified Authentication Routes
 * 
 * This file contains all authentication routes for the DAL-AI project:
 * - Microsoft OAuth routes (existing, kept intact but made optional)
 * - Microsoft auth status endpoint
 * - Integration with local auth system
 * 
 * Microsoft auth is now OPTIONAL - users are not auto-redirected to Microsoft.
 * Both local email/password and Microsoft OAuth are available as options.
 */

import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import { buildAuthUrl, exchangeCodeForToken } from './auth.config.js';
import { createSession, getSession, setSessionData, destroySession, getSessionData } from './session.js';
import { saveTokens } from './token.store.js';
import { getMe } from './userinfo.js';
import { createPkcePair, isPkceEnabled } from './pkce.js';
import { recordLogin, recordLogout } from './audit.js';

// Environment configuration
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// Route interfaces
interface LoginQuery {
  redirect?: string;
}

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

/**
 * Register unified authentication routes with Fastify
 * Includes both Microsoft OAuth and status endpoints
 */
export async function authRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /auth/ms/enabled
   * Check if Microsoft OAuth is enabled and available
   * This is a public endpoint that frontends can use to determine
   * whether to show Microsoft login options
   */
  fastify.get('/ms/enabled', async (_request, reply) => {
    try {
      // Check if Microsoft OAuth is properly configured
      const clientId = process.env.AZURE_CLIENT_ID || process.env.CLIENT_ID;
      const clientSecret = process.env.AZURE_CLIENT_SECRET || process.env.CLIENT_SECRET;
      const tenantId = process.env.AZURE_TENANT_ID || process.env.TENANT_ID;
      
      const isEnabled = !!(clientId && clientSecret && tenantId);
      
      return reply.send({
        enabled: isEnabled,
        provider: 'microsoft',
        name: 'Microsoft',
        type: 'oauth'
      });
      
    } catch (error) {
      console.error('❌ Error checking Microsoft auth status:', error);
      return reply.send({
        enabled: false,
        error: 'Configuration check failed'
      });
    }
  });

  /**
   * GET /auth/ms/login
   * Initiate Microsoft OAuth login flow
   * 
   * NOTE: This is explicitly prefixed with /ms/ to make it clear
   * that this is Microsoft-specific login, not the default login
   */
  fastify.get<{ Querystring: LoginQuery }>('/ms/login', async (request, reply) => {
    try {
      console.log('🔐 Starting Microsoft OAuth login flow...');
      
      // Check if Microsoft auth is enabled
      const clientId = process.env.AZURE_CLIENT_ID || process.env.CLIENT_ID;
      if (!clientId) {
        console.error('❌ Microsoft OAuth not configured');
        return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_not_configured`);
      }
      
      // Get or create session
      let session = getSession(request);
      let sessionId = session.sid;
      
      if (!sessionId) {
        sessionId = createSession(reply, 'temp-user-id');
        console.log(`📝 Created new session: ${sessionId}`);
      }
      
      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');
      
      // Optional: Generate PKCE pair for enhanced security
      let codeVerifier: string | undefined;
      let codeChallenge: string | undefined;
      
      if (isPkceEnabled()) {
        const pkcePair = await createPkcePair();
        codeVerifier = pkcePair.verifier;
        codeChallenge = pkcePair.challenge;
        console.log('🔒 Using PKCE for enhanced security');
      }
      
      // Store OAuth state and PKCE in session
      setSessionData(sessionId, {
        user: undefined, // Clear any existing user
        tokens: undefined, // Clear any existing tokens
      });
      
      // Store OAuth flow data in session
      setSessionData(sessionId, { 
        oauthState: state,
        oauthCodeVerifier: codeVerifier,
        oauthRedirectUrl: request.query.redirect || `${FRONTEND_ORIGIN}/app`,
        oauthTimestamp: Date.now(),
        authProvider: 'microsoft' // Track which provider initiated this flow
      } as any);
      
      // Build authorization URL
      const authUrl = buildAuthUrl(state, codeChallenge);
      
      console.log(`🚀 Redirecting to Microsoft OAuth: ${authUrl}`);
      
      // Redirect to Microsoft OAuth
      return reply.redirect(authUrl);
      
    } catch (error) {
      console.error('❌ Error in /auth/ms/login:', error);
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_login_error`);
    }
  });

  /**
   * GET /auth/callback
   * Handle Microsoft OAuth callback
   * 
   * NOTE: This keeps the original /auth/callback path for compatibility
   * but we also support /auth/ms/callback for clarity
   */
  fastify.get<{ Querystring: CallbackQuery }>('/callback', async (request, reply) => {
    return handleMicrosoftCallback(request, reply);
  });
  
  fastify.get<{ Querystring: CallbackQuery }>('/ms/callback', async (request, reply) => {
    return handleMicrosoftCallback(request, reply);
  });

  /**
   * POST /auth/ms/logout
   * Logout Microsoft user and destroy session
   * 
   * NOTE: This handles Microsoft-specific logout
   * Different from local auth logout in /auth/logout (from local.routes.ts)
   */
  fastify.post('/ms/logout', async (request, reply) => {
    try {
      console.log('🚪 Processing Microsoft logout request...');
      
      // Get session
      const session = getSession(request);
      
      if (session.sid) {
        // Get session data to check auth provider
        const sessionData = getSessionData(session.sid);
        
        if (sessionData && (sessionData as any).authProvider === 'microsoft') {
          console.log('🔐 Confirmed Microsoft session logout');
          
          // Record logout before destroying session
          try {
            const user = (sessionData as any).user;
            if (user) {
              await recordLogout(user.id, user.email, request.ip, 'microsoft');
            }
          } catch (auditError) {
            console.error('Failed to record Microsoft logout audit:', auditError);
          }
        }
        
        // Destroy session and clear cookie
        destroySession(reply, session.sid);
        console.log(`✅ Microsoft session destroyed: ${session.sid}`);
      }
      
      return reply.send({ 
        ok: true, 
        message: 'Microsoft logout successful',
        provider: 'microsoft'
      });
      
    } catch (error) {
      console.error('❌ Error in /auth/ms/logout:', error);
      return reply.status(500).send({ 
        ok: false, 
        error: 'Internal server error during Microsoft logout',
        provider: 'microsoft'
      });
    }
  });

  /**
   * GET /auth/me
   * Get current user information (bonus endpoint for compatibility)
   * This endpoint works for both local and Microsoft auth
   */
  fastify.get('/me', async (request, reply) => {
    try {
      const sid = request.cookies.sid;
      if (!sid) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      const session = getSession(request);
      
      if (!session.sid) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      const sessionData = getSessionData(session.sid);
      
      if (!sessionData?.user) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }
      
      return reply.send({
        ok: true,
        user: sessionData.user
      });
      
    } catch (error) {
      console.error('❌ Error in /auth/me:', error);
      return reply.status(500).send({ 
        error: 'Internal server error' 
      });
    }
  });

  /**
   * GET /auth/status
   * Check authentication status (bonus endpoint for compatibility)
   * Works for both local and Microsoft auth
   */
  fastify.get('/status', async (request, reply) => {
    try {
      const session = getSession(request);
      
      if (!session.sid) {
        return reply.send({ 
          authenticated: false,
          provider: null
        });
      }
      
      const sessionData = getSessionData(session.sid);
      
      return reply.send({
        authenticated: !!sessionData?.user,
        provider: (sessionData as any).authProvider || null,
        user: sessionData?.user ? {
          id: sessionData.user.id,
          name: sessionData.user.name,
          email: sessionData.user.email
        } : null
      });
      
    } catch (error) {
      console.error('❌ Error in /auth/status:', error);
      return reply.status(500).send({ 
        authenticated: false,
        provider: null,
        error: 'Internal server error' 
      });
    }
  });

  console.log('🔐 Microsoft OAuth routes registered successfully');
  console.log('   ✅ GET /auth/ms/enabled - Check if Microsoft auth is available');
  console.log('   ✅ GET /auth/ms/login - Start Microsoft OAuth flow (optional)');
  console.log('   ✅ GET /auth/callback - Handle Microsoft OAuth callback');
  console.log('   ✅ GET /auth/ms/callback - Handle Microsoft OAuth callback (alternative)');
  console.log('   ✅ POST /auth/ms/logout - Microsoft-specific logout');
  console.log('   ✅ GET /auth/me - Get user info (compatible with both auth types)');
  console.log('   ✅ GET /auth/status - Check auth status (compatible with both auth types)');
}

/**
 * Handle Microsoft OAuth callback logic
 * Shared between /auth/callback and /auth/ms/callback routes
 */
async function handleMicrosoftCallback(request: any, reply: any) {
  try {
    console.log('🔄 Processing Microsoft OAuth callback...');
    
    // Check for OAuth errors
    if (request.query.error) {
      console.error(`❌ Microsoft OAuth error: ${request.query.error} - ${request.query.error_description}`);
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_oauth_error`);
    }
    
    const { code, state } = request.query;
    
    if (!code || !state) {
      console.error('❌ Missing code or state in Microsoft callback');
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_invalid_callback`);
    }
    
    // Get session
    const session = getSession(request);
    if (!session.sid) {
      console.error('❌ No session found in Microsoft callback');
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_session_expired`);
    }
    
    // Get OAuth data from session
    const sessionData = getSessionData(session.sid);
    
    if (!sessionData) {
      console.error('❌ No session data found for Microsoft callback');
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_session_invalid`);
    }
    
    // Access OAuth data directly from session
    const oauthState = (sessionData as any).oauthState;
    const oauthCodeVerifier = (sessionData as any).oauthCodeVerifier;
    const oauthRedirectUrl = (sessionData as any).oauthRedirectUrl;
    const oauthTimestamp = (sessionData as any).oauthTimestamp;
    
    if (!oauthState) {
      console.error('❌ No OAuth state found in session for Microsoft callback');
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_session_invalid`);
    }
    
    // Verify state to prevent CSRF attacks
    if (state !== oauthState) {
      console.error('❌ State mismatch in Microsoft OAuth callback');
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_state_mismatch`);
    }
    
    // Check if OAuth flow is too old (15 minutes max)
    if (oauthTimestamp && Date.now() - oauthTimestamp > 15 * 60 * 1000) {
      console.error('❌ Microsoft OAuth flow expired');
      return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_flow_expired`);
    }
    
    console.log('✅ Microsoft OAuth state verification successful');
    
    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(code, oauthCodeVerifier);
    
    // Get user profile from Microsoft Graph
    const userProfile = await getMe(tokens.access_token);
    
    // Save tokens for future API calls
    saveTokens(session.sid, tokens);
    
    // Update session with user data and mark as Microsoft auth
    const sessionUpdate = {
      user: {
        id: userProfile.id,
        name: userProfile.displayName,
        email: userProfile.mail || userProfile.userPrincipalName || 'unknown@microsoft.com'
      },
      tokens: {
        access: tokens.access_token,
        refresh: tokens.refresh_token,
        exp: Date.now() + (tokens.expires_in * 1000)
      }
    };
    
    setSessionData(session.sid, sessionUpdate);
    
    // Store additional auth provider info as extended data
    setSessionData(session.sid, {
      ...sessionUpdate,
      authProvider: 'microsoft', // Mark this as Microsoft authentication
      authenticatedAt: new Date().toISOString()
    } as any);
    
    console.log(`✅ Microsoft authentication successful for user: ${userProfile.mail || userProfile.userPrincipalName}`);
    
    // Record successful Microsoft OAuth login
    try {
      await recordLogin(sessionUpdate.user.id, sessionUpdate.user.email, request.ip, 'microsoft');
    } catch (auditError) {
      console.error('Failed to record Microsoft OAuth login audit:', auditError);
    }
    
    // Redirect to the intended destination
    const redirectUrl = oauthRedirectUrl || `${FRONTEND_ORIGIN}/app`;
    return reply.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ Error in Microsoft OAuth callback:', error);
    return reply.redirect(`${FRONTEND_ORIGIN}/login?error=microsoft_callback_error`);
  }
}

// Export the main registration function for backward compatibility
export default authRoutes;
