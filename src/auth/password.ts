import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';

/**
 * Password validation helper
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  if (!hasLetter || !hasDigit) {
    return { valid: false, message: 'Password must contain at least one letter and one digit' };
  }

  return { valid: true };
}

/**
 * Hash a password using argon2 with environment configuration
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  // Validate password before hashing
  const validation = validatePassword(plainPassword);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  try {
    // Get configuration from environment variables
    const memoryCost = parseInt(process.env.PASSWORD_HASH_MEMORY || '19456', 10);
    const timeCost = parseInt(process.env.PASSWORD_HASH_TIME || '2', 10);
    const parallelism = parseInt(process.env.PASSWORD_HASH_PARALLELISM || '1', 10);

    return await argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost,
      timeCost,
      parallelism,
    });
  } catch (error) {
    // Fallback to bcrypt if argon2 fails
    console.warn('Argon2 failed, falling back to bcrypt:', error);
    const saltRounds = 12;
    return await bcrypt.hash(plainPassword, saltRounds);
  }
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  try {
    // Check if it's an argon2 hash (starts with $argon2)
    if (hash.startsWith('$argon2')) {
      return await argon2.verify(hash, plainPassword);
    } else {
      // Assume it's a bcrypt hash
      return await bcrypt.compare(plainPassword, hash);
    }
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

/**
 * Check if a hash was created with argon2
 */
export function isArgon2Hash(hash: string): boolean {
  return hash.startsWith('$argon2');
}

/**
 * Check if a hash was created with bcrypt
 */
export function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}
