/**
 * Task: Centralize Microsoft OAuth config & helpers.
 * Requirements:
 * - export CONFIG with tenantId, clientId, clientSecret, redirectUri, scopes.
 * - export buildAuthUrl(state, codeChallenge?) -> string for authorization_code (with PKCE optional).
 * - export async exchangeCodeForToken(code, codeVerifier?) -> { access_token, refresh_token, expires_in, id_token, scope, token_type }
 * - Token endpoint: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
 * - Auth endpoint: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
 * - Encode scopes space-delimited.
 */
import 'dotenv/config';

// Microsoft OAuth Configuration - Dynamic getter to read current environment
export function getConfig() {
  return {
    tenantId: process.env.MS_TENANT_ID || 'common',
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    redirectUri: process.env.MS_REDIRECT_URI || 'http://localhost:8080/auth/callback',
    scopes: process.env.MS_SCOPES || 'openid profile offline_access Mail.Read Calendars.Read Contacts.Read',
    authEndpoint: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || 'common'}/oauth2/v2.0/token`,
  };
}

// Backward compatibility - but now reads dynamically
export const CONFIG = new Proxy({} as any, {
  get(_target, prop) {
    const config = getConfig();
    return config[prop as keyof typeof config];
  }
});

// Token response interface
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  scope: string;
  token_type: string;
}

/**
 * Build Microsoft OAuth authorization URL
 * @param state - Random state parameter for CSRF protection
 * @param codeChallenge - Optional PKCE code challenge for enhanced security
 * @returns Authorization URL string
 */
export function buildAuthUrl(state: string, codeChallenge?: string): string {
  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    response_type: 'code',
    redirect_uri: CONFIG.redirectUri,
    scope: CONFIG.scopes,
    state: state,
    response_mode: 'query',
  });

  // Add PKCE parameters if provided
  if (codeChallenge) {
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', 'S256');
  }

  return `${CONFIG.authEndpoint}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param code - Authorization code from Microsoft
 * @param codeVerifier - Optional PKCE code verifier
 * @returns Token response with access_token, refresh_token, etc.
 */
export async function exchangeCodeForToken(code: string, codeVerifier?: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    code: code,
    redirect_uri: CONFIG.redirectUri,
    grant_type: 'authorization_code',
  });

  // Add PKCE code verifier if provided
  if (codeVerifier) {
    body.append('code_verifier', codeVerifier);
  }

  const response = await fetch(CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const tokenData = await response.json() as TokenResponse;
  
  // Validate required fields
  if (!tokenData.access_token || !tokenData.token_type) {
    throw new Error('Invalid token response: missing required fields');
  }

  return tokenData;
}

/**
 * Refresh an expired access token using refresh token
 * @param refreshToken - The refresh token
 * @returns New token response
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: CONFIG.scopes,
  });

  const response = await fetch(CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const tokenData = await response.json() as TokenResponse;
  
  if (!tokenData.access_token || !tokenData.token_type) {
    throw new Error('Invalid refresh token response: missing required fields');
  }

  return tokenData;
}

/**
 * Validate configuration on startup
 */
export function validateConfig(): void {
  const missingFields: string[] = [];
  
  if (!CONFIG.clientId) missingFields.push('MS_CLIENT_ID');
  if (!CONFIG.clientSecret) missingFields.push('MS_CLIENT_SECRET');
  if (!CONFIG.redirectUri) missingFields.push('MS_REDIRECT_URI');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required Microsoft OAuth configuration: ${missingFields.join(', ')}`);
  }
}
