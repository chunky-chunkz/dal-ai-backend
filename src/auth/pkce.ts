/**
 * Task: PKCE utilities.
 * - export async createPkcePair(): Promise<{ verifier:string, challenge:string }>
 * - Use crypto random + sha256(base64url).
 * - Store verifier in session before /auth/login redirect; include challenge in auth URL.
 */

import crypto from 'crypto';

// PKCE pair interface
export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * Generate a cryptographically secure random string for PKCE code verifier
 * @param length - Length of the verifier (43-128 characters recommended)
 * @returns Base64URL-encoded random string
 */
function generateCodeVerifier(length: number = 128): string {
  // Generate random bytes
  const randomBytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
  
  // Convert to base64url (URL-safe base64 without padding)
  return randomBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .substring(0, length);
}

/**
 * Generate PKCE code challenge from verifier using SHA256
 * @param verifier - The code verifier string
 * @returns Base64URL-encoded SHA256 hash of the verifier
 */
function generateCodeChallenge(verifier: string): string {
  // Create SHA256 hash of the verifier
  const hash = crypto.createHash('sha256').update(verifier).digest();
  
  // Convert to base64url (URL-safe base64 without padding)
  return hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Create a PKCE code verifier and challenge pair
 * @param verifierLength - Length of the code verifier (43-128 characters)
 * @returns Promise with verifier and challenge strings
 */
export async function createPkcePair(verifierLength: number = 128): Promise<PkcePair> {
  try {
    // Validate verifier length (RFC 7636 requirements)
    if (verifierLength < 43 || verifierLength > 128) {
      throw new Error('PKCE verifier length must be between 43 and 128 characters');
    }

    console.log('🔐 Generating PKCE code verifier and challenge...');

    // Generate code verifier
    const verifier = generateCodeVerifier(verifierLength);
    
    // Generate code challenge from verifier
    const challenge = generateCodeChallenge(verifier);
    
    console.log(`✅ PKCE pair generated (verifier: ${verifier.length} chars, challenge: ${challenge.length} chars)`);
    
    return {
      verifier,
      challenge
    };

  } catch (error) {
    console.error('❌ Error generating PKCE pair:', error);
    throw new Error('Failed to generate PKCE pair');
  }
}

/**
 * Validate PKCE code verifier against challenge
 * @param verifier - The code verifier to validate
 * @param challenge - The expected code challenge
 * @returns Boolean indicating if verifier matches challenge
 */
export function validatePkceVerifier(verifier: string, challenge: string): boolean {
  try {
    if (!verifier || !challenge) {
      console.warn('⚠️ Missing verifier or challenge for PKCE validation');
      return false;
    }

    // Generate challenge from verifier and compare
    const expectedChallenge = generateCodeChallenge(verifier);
    const isValid = expectedChallenge === challenge;
    
    if (isValid) {
      console.log('✅ PKCE verifier validation successful');
    } else {
      console.warn('❌ PKCE verifier validation failed');
    }
    
    return isValid;

  } catch (error) {
    console.error('❌ Error validating PKCE verifier:', error);
    return false;
  }
}

/**
 * Generate a cryptographically secure random state parameter
 * @param length - Length of the state string (default: 32)
 * @returns Base64URL-encoded random string for state parameter
 */
export function generateState(length: number = 32): string {
  try {
    const randomBytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
    
    return randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .substring(0, length);

  } catch (error) {
    console.error('❌ Error generating state parameter:', error);
    throw new Error('Failed to generate state parameter');
  }
}

/**
 * Utility function to check if PKCE is enabled
 * @returns Boolean indicating if PKCE should be used
 */
export function isPkceEnabled(): boolean {
  return process.env.USE_PKCE === 'true' || process.env.NODE_ENV === 'production';
}

/**
 * Get PKCE method (always S256 for security)
 * @returns The code challenge method
 */
export function getPkceMethod(): string {
  return 'S256';
}

/**
 * Validate PKCE configuration
 * @returns Boolean indicating if PKCE is properly configured
 */
export function validatePkceConfig(): boolean {
  try {
    // Test PKCE generation
    const testVerifier = generateCodeVerifier(64);
    const testChallenge = generateCodeChallenge(testVerifier);
    
    // Validate the test pair
    const isValid = validatePkceVerifier(testVerifier, testChallenge);
    
    if (isValid) {
      console.log('✅ PKCE configuration validation successful');
    } else {
      console.error('❌ PKCE configuration validation failed');
    }
    
    return isValid;

  } catch (error) {
    console.error('❌ Error validating PKCE configuration:', error);
    return false;
  }
}

// Export utilities
export {
  generateCodeVerifier,
  generateCodeChallenge
};
