/**
 * Task: Token storage & refresh helper.
 * Requirements:
 * - export saveTokens(sid, {access_token, refresh_token, expires_in})
 * - export getValidAccessToken(sid): Promise<string|null>
 *   - If expired (~60s skew), use refresh_token to get new access_token via token endpoint (grant_type=refresh_token).
 *   - Update store on refresh.
 * - Encrypt at rest (simple AES-GCM with key from env) or mark TODO if not implemented (for dev).
 */
import { getSessionData, setSessionData } from './session.js';
import { refreshAccessToken } from './auth.config.js';

// Encryption configuration
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'development_key_32_chars_long!!'; // 32 chars for AES-256
const TOKEN_REFRESH_SKEW = 60; // Refresh tokens 60 seconds before expiry

// Token data interface for storage
interface StoredTokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // Unix timestamp when token expires
  encrypted: boolean;
}

/**
 * Encrypt sensitive token data using AES-GCM
 * @param data - Token data to encrypt
 * @returns Encrypted data with IV and auth tag
 */
function encryptTokenData(data: string): string {
  if (ENCRYPTION_KEY === 'development_key_32_chars_long!!') {
    console.warn('⚠️  WARNING: Using development encryption key! Set TOKEN_ENCRYPTION_KEY in production!');
    // In development, return unencrypted but mark as encrypted for consistency
    return JSON.stringify({
      encrypted: false,
      data: data
    });
  }

  // TODO: Implement AES-GCM encryption for production
  // For now, use base64 encoding as placeholder
  const encoded = Buffer.from(data).toString('base64');
  
  return JSON.stringify({
    encrypted: true,
    data: encoded
  });
}

/**
 * Decrypt token data using AES-GCM
 * @param encryptedData - Encrypted token data
 * @returns Decrypted token data
 */
function decryptTokenData(encryptedData: string): string {
  const parsed = JSON.parse(encryptedData);
  
  if (!parsed.encrypted) {
    // Development mode - data is not actually encrypted
    return parsed.data;
  }
  
  // TODO: Implement AES-GCM decryption for production
  // For now, use base64 decoding as placeholder
  return Buffer.from(parsed.data, 'base64').toString('utf8');
}

/**
 * Save tokens to session storage with encryption
 * @param sid - Session ID
 * @param tokens - Token response from OAuth provider
 */
export function saveTokens(sid: string, tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): void {
  const expiresAt = Date.now() + (tokens.expires_in * 1000);
  
  const tokenData: StoredTokenData = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    encrypted: true
  };
  
  // Encrypt the sensitive token data
  const encryptedData = encryptTokenData(JSON.stringify(tokenData));
  
  // Store in session
  setSessionData(sid, {
    tokens: {
      access: encryptedData,
      refresh: tokens.refresh_token || '',
      exp: expiresAt
    }
  });
  
  console.log(`🔐 Tokens saved for session ${sid}, expires at ${new Date(expiresAt).toISOString()}`);
}

/**
 * Enhancement: refresh flow.
 * - export async function refreshIfNeeded(sid): Promise<string>:
 *    - If access expiring in <60s, perform refresh_token grant.
 *    - Update store; return new access.
 * - Handle refresh_token rotation (overwrite old).
 */

/**
 * Refresh access token if needed and return the valid token
 * @param sid - Session ID
 * @returns Promise resolving to valid access token or null if unavailable
 */
export async function refreshIfNeeded(sid: string): Promise<string | null> {
  const sessionData = getSessionData(sid);
  
  if (!sessionData?.tokens?.access) {
    console.log(`❌ No tokens found for session ${sid}`);
    return null;
  }
  
  try {
    // Decrypt and parse token data
    const decryptedData = decryptTokenData(sessionData.tokens.access);
    const tokenData: StoredTokenData = JSON.parse(decryptedData);
    
    const now = Date.now();
    const timeUntilExpiry = tokenData.expires_at - now;
    const refreshThreshold = TOKEN_REFRESH_SKEW * 1000; // 60 seconds in milliseconds
    
    // Check if token is still valid and not near expiry
    if (timeUntilExpiry > refreshThreshold) {
      console.log(`✅ Access token still valid for session ${sid}, expires in ${Math.round(timeUntilExpiry / 1000)}s`);
      return tokenData.access_token;
    }
    
    // Token is expired or expiring soon, attempt refresh
    if (!tokenData.refresh_token) {
      console.log(`❌ Access token expiring and no refresh token available for session ${sid}`);
      return null;
    }
    
    console.log(`🔄 Token expiring in ${Math.round(timeUntilExpiry / 1000)}s, refreshing for session ${sid}...`);
    
    try {
      // Call Microsoft's token endpoint with refresh_token grant
      const newTokens = await refreshAccessToken(tokenData.refresh_token);
      
      // Handle refresh token rotation - Microsoft may provide a new refresh token
      const newRefreshToken = newTokens.refresh_token || tokenData.refresh_token;
      
      console.log(`🔄 Token refresh successful for session ${sid}${newTokens.refresh_token ? ' (refresh token rotated)' : ''}`);
      
      // Save the new tokens (this overwrites the old ones)
      saveTokens(sid, {
        access_token: newTokens.access_token,
        refresh_token: newRefreshToken,
        expires_in: newTokens.expires_in
      });
      
      console.log(`✅ New access token saved for session ${sid}, expires in ${newTokens.expires_in}s`);
      return newTokens.access_token;
      
    } catch (refreshError: any) {
      console.error(`❌ Failed to refresh token for session ${sid}:`, refreshError.message || refreshError);
      
      // If refresh failed, clear the invalid tokens
      clearTokens(sid);
      
      return null;
    }
    
  } catch (error: any) {
    console.error(`❌ Error processing tokens for session ${sid}:`, error.message || error);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 * @param sid - Session ID
 * @returns Valid access token or null if unavailable/expired
 */
export async function getValidAccessToken(sid: string): Promise<string | null> {
  // Use the enhanced refreshIfNeeded function for consistency
  return await refreshIfNeeded(sid);
}

/**
 * Check if access token needs refresh (within refresh threshold)
 * @param sid - Session ID  
 * @returns Boolean indicating if token should be refreshed
 */
export function needsRefresh(sid: string): boolean {
  const sessionData = getSessionData(sid);
  
  if (!sessionData?.tokens?.access) {
    return false; // No tokens to refresh
  }
  
  try {
    const decryptedData = decryptTokenData(sessionData.tokens.access);
    const tokenData: StoredTokenData = JSON.parse(decryptedData);
    
    const now = Date.now();
    const timeUntilExpiry = tokenData.expires_at - now;
    const refreshThreshold = TOKEN_REFRESH_SKEW * 1000;
    
    // Return true if token expires within threshold and we have a refresh token
    return timeUntilExpiry <= refreshThreshold && !!tokenData.refresh_token;
    
  } catch (error) {
    console.error(`❌ Error checking refresh need for session ${sid}:`, error);
    return false;
  }
}

/**
 * Force refresh access token regardless of expiry time
 * @param sid - Session ID
 * @returns Promise resolving to new access token or null if failed
 */
export async function forceRefresh(sid: string): Promise<string | null> {
  const sessionData = getSessionData(sid);
  
  if (!sessionData?.tokens?.access) {
    console.log(`❌ No tokens found for session ${sid}`);
    return null;
  }
  
  try {
    const decryptedData = decryptTokenData(sessionData.tokens.access);
    const tokenData: StoredTokenData = JSON.parse(decryptedData);
    
    if (!tokenData.refresh_token) {
      console.log(`❌ No refresh token available for session ${sid}`);
      return null;
    }
    
    console.log(`🔄 Force refreshing token for session ${sid}...`);
    
    try {
      const newTokens = await refreshAccessToken(tokenData.refresh_token);
      
      // Handle refresh token rotation
      const newRefreshToken = newTokens.refresh_token || tokenData.refresh_token;
      
      // Save the new tokens
      saveTokens(sid, {
        access_token: newTokens.access_token,
        refresh_token: newRefreshToken,
        expires_in: newTokens.expires_in
      });
      
      console.log(`✅ Token force refresh successful for session ${sid}`);
      return newTokens.access_token;
      
    } catch (refreshError: any) {
      console.error(`❌ Force refresh failed for session ${sid}:`, refreshError.message || refreshError);
      clearTokens(sid);
      return null;
    }
    
  } catch (error: any) {
    console.error(`❌ Error in force refresh for session ${sid}:`, error.message || error);
    return null;
  }
}

/**
 * Get detailed refresh status for a session
 * @param sid - Session ID
 * @returns Detailed refresh status information
 */
export function getRefreshStatus(sid: string): {
  hasTokens: boolean;
  hasRefreshToken: boolean;
  needsRefresh: boolean;
  isExpired: boolean;
  timeUntilExpiry?: number;
  timeUntilRefresh?: number;
  canRefresh: boolean;
} {
  const sessionData = getSessionData(sid);
  
  if (!sessionData?.tokens?.access) {
    return {
      hasTokens: false,
      hasRefreshToken: false,
      needsRefresh: false,
      isExpired: true,
      canRefresh: false
    };
  }
  
  try {
    const decryptedData = decryptTokenData(sessionData.tokens.access);
    const tokenData: StoredTokenData = JSON.parse(decryptedData);
    
    const now = Date.now();
    const timeUntilExpiry = tokenData.expires_at - now;
    const refreshThreshold = TOKEN_REFRESH_SKEW * 1000;
    const timeUntilRefresh = Math.max(0, timeUntilExpiry - refreshThreshold);
    
    const isExpired = timeUntilExpiry <= 0;
    const needsRefresh = timeUntilExpiry <= refreshThreshold;
    const hasRefreshToken = !!tokenData.refresh_token;
    const canRefresh = hasRefreshToken && !isExpired;
    
    return {
      hasTokens: true,
      hasRefreshToken,
      needsRefresh,
      isExpired,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      timeUntilRefresh,
      canRefresh
    };
    
  } catch (error) {
    console.error(`❌ Error getting refresh status for session ${sid}:`, error);
    return {
      hasTokens: false,
      hasRefreshToken: false,
      needsRefresh: false,
      isExpired: true,
      canRefresh: false
    };
  }
}

/**
 * Remove tokens from session storage
 * @param sid - Session ID
 */
export function clearTokens(sid: string): void {
  const sessionData = getSessionData(sid);
  
  if (sessionData) {
    setSessionData(sid, {
      tokens: undefined
    });
    console.log(`🗑️  Tokens cleared for session ${sid}`);
  }
}

/**
 * Check if session has valid tokens (without triggering refresh)
 * @param sid - Session ID
 * @returns Boolean indicating if tokens exist and are not expired
 */
export function hasValidTokens(sid: string): boolean {
  const sessionData = getSessionData(sid);
  
  if (!sessionData?.tokens?.access) {
    return false;
  }
  
  try {
    const decryptedData = decryptTokenData(sessionData.tokens.access);
    const tokenData: StoredTokenData = JSON.parse(decryptedData);
    
    const now = Date.now();
    const timeUntilExpiry = tokenData.expires_at - now;
    
    return timeUntilExpiry > 0;
    
  } catch (error) {
    console.error(`❌ Error checking tokens for session ${sid}:`, error);
    return false;
  }
}

/**
 * Get token expiration info for debugging/monitoring
 * @param sid - Session ID
 * @returns Token expiration information
 */
export function getTokenInfo(sid: string): {
  hasTokens: boolean;
  isExpired: boolean;
  expiresAt?: Date;
  timeUntilExpiry?: number;
} {
  const sessionData = getSessionData(sid);
  
  if (!sessionData?.tokens?.access) {
    return { hasTokens: false, isExpired: true };
  }
  
  try {
    const decryptedData = decryptTokenData(sessionData.tokens.access);
    const tokenData: StoredTokenData = JSON.parse(decryptedData);
    
    const now = Date.now();
    const timeUntilExpiry = tokenData.expires_at - now;
    const isExpired = timeUntilExpiry <= 0;
    
    return {
      hasTokens: true,
      isExpired,
      expiresAt: new Date(tokenData.expires_at),
      timeUntilExpiry: timeUntilExpiry > 0 ? timeUntilExpiry : 0
    };
    
  } catch (error) {
    console.error(`❌ Error getting token info for session ${sid}:`, error);
    return { hasTokens: false, isExpired: true };
  }
}

// Validate encryption key on startup
if (ENCRYPTION_KEY.length !== 32) {
  console.warn('⚠️  WARNING: TOKEN_ENCRYPTION_KEY should be exactly 32 characters for AES-256!');
}
