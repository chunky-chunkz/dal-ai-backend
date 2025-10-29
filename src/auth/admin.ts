/**
 * Hardcoded Admin Authentication
 * 
 * This module provides a single hardcoded admin user for system administration.
 * The admin credentials are stored with a pre-hashed password for security.
 * 
 * Admin credentials:
 * - Email: admin@sunrise.net
 * - Password: Sukablyat1_
 */

import { verifyPassword } from './password.js';

// Pre-hashed password for "Sukablyat1_" using bcrypt with 12 rounds
const ADMIN_EMAIL = 'admin@sunrise.net';
const ADMIN_PASSWORD_HASH = '$2a$12$xZaMoz3gI1SuKJch17nlNeyE6cAoDEIdPeRnGS41tMcqAfY5nkH16';

// Admin user object
export const ADMIN_USER = {
  id: 'admin-001',
  email: ADMIN_EMAIL,
  name: 'System Administrator',
  displayName: 'Admin',
  isAdmin: true,
  passwordHash: ADMIN_PASSWORD_HASH
};

/**
 * Check if an email belongs to an admin user
 * This checks both the hardcoded admin and the ADMIN_EMAILS environment variable
 */
export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check hardcoded admin
  if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  
  // Check environment variable ADMIN_EMAILS
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(normalizedEmail);
}

/**
 * Verify admin credentials
 * Returns admin user object if credentials are valid, null otherwise
 */
export async function verifyAdminCredentials(
  email: string, 
  password: string
): Promise<typeof ADMIN_USER | null> {
  console.log('🔐 verifyAdminCredentials called');
  console.log('   Email:', email);
  console.log('   Password length:', password?.length);
  
  if (!email || !password) {
    console.log('   ❌ Email or password missing');
    return null;
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  console.log('   Normalized email:', normalizedEmail);
  console.log('   Expected email:', ADMIN_EMAIL.toLowerCase());
  console.log('   Match:', normalizedEmail === ADMIN_EMAIL.toLowerCase());
  
  // Check if it's the hardcoded admin
  if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
    console.log('   📧 Email matches! Verifying password...');
    console.log('   Hash:', ADMIN_PASSWORD_HASH);
    const isValid = await verifyPassword(ADMIN_PASSWORD_HASH, password);
    console.log('   Password valid:', isValid);
    
    if (isValid) {
      console.log('✅ Admin login successful');
      return ADMIN_USER;
    } else {
      console.log('❌ Admin login failed: invalid password');
      return null;
    }
  }
  
  console.log('   ❌ Email does not match admin email');
  return null;
}

/**
 * Get admin user by email (without password verification)
 * Used for checking admin status in middleware
 */
export function getAdminByEmail(email: string): typeof ADMIN_USER | null {
  if (!email) return null;
  
  const normalizedEmail = email.toLowerCase().trim();
  
  if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
    return { ...ADMIN_USER, passwordHash: '' }; // Don't expose password hash
  }
  
  return null;
}

/**
 * Check if a user ID is the admin user
 */
export function isAdminUserId(userId: string): boolean {
  return userId === ADMIN_USER.id;
}
