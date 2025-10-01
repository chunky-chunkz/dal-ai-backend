import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePassword, isArgon2Hash, isBcryptHash } from '../auth/password';

describe('Password Utilities', () => {
  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      const result = validatePassword('password123');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePassword('pass1');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Password must be at least 8 characters long');
    });

    it('should reject passwords without letters', () => {
      const result = validatePassword('12345678');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Password must contain at least one letter and one digit');
    });

    it('should reject passwords without digits', () => {
      const result = validatePassword('password');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Password must contain at least one letter and one digit');
    });

    it('should accept complex passwords', () => {
      const result = validatePassword('MySecureP@ssw0rd!');
      expect(result.valid).toBe(true);
    });
  });

  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).not.toBe(password);
    });

    it('should reject invalid passwords', async () => {
      await expect(hashPassword('short')).rejects.toThrow();
      await expect(hashPassword('nodigits')).rejects.toThrow();
      await expect(hashPassword('12345678')).rejects.toThrow();
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // Salts should make them different
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(hash, wrongPassword);
      expect(isValid).toBe(false);
    });

    it('should handle malformed hashes gracefully', async () => {
      const isValid = await verifyPassword('malformed_hash', 'password123');
      expect(isValid).toBe(false);
    });
  });

  describe('hash detection', () => {
    it('should detect argon2 hashes', () => {
      const argon2Hash = '$argon2id$v=19$m=19456,t=2,p=1$somedata';
      expect(isArgon2Hash(argon2Hash)).toBe(true);
      expect(isBcryptHash(argon2Hash)).toBe(false);
    });

    it('should detect bcrypt hashes', () => {
      const bcryptHash = '$2a$12$somedata';
      expect(isBcryptHash(bcryptHash)).toBe(true);
      expect(isArgon2Hash(bcryptHash)).toBe(false);
    });
  });
});
