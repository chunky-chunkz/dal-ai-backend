import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  ChangePasswordSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  UpdateProfileSchema,
  isValidEmail,
  isValidPassword
} from '../auth/validators';

describe('Auth Validators', () => {
  describe('RegisterSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User'
      };

      const result = RegisterSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.password).toBe('password123');
        expect(result.data.displayName).toBe('Test User');
      }
    });

    it('should normalize email to lowercase', () => {
      const data = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      const result = RegisterSchema.safeParse(data);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'password123'
      };

      const result = RegisterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject weak passwords', () => {
      const testCases = [
        { email: 'test@example.com', password: 'short' }, // Too short
        { email: 'test@example.com', password: 'nodigits' }, // No digits
        { email: 'test@example.com', password: '12345678' }, // No letters
      ];

      testCases.forEach(data => {
        const result = RegisterSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    it('should accept registration without displayName', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = RegisterSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should trim displayName', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        displayName: '  Test User  '
      };

      const result = RegisterSchema.safeParse(data);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.displayName).toBe('Test User');
      }
    });
  });

  describe('LoginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'anypassword'
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const data = {
        email: 'test@example.com',
        password: ''
      };

      const result = LoginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should normalize email', () => {
      const data = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password'
      };

      const result = LoginSchema.safeParse(data);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });
  });

  describe('ChangePasswordSchema', () => {
    it('should validate password change', () => {
      const data = {
        currentPassword: 'oldpassword',
        newPassword: 'newPassword123'
      };

      const result = ChangePasswordSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject weak new password', () => {
      const data = {
        currentPassword: 'oldpassword',
        newPassword: 'weak'
      };

      const result = ChangePasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('PasswordResetRequestSchema', () => {
    it('should validate reset request', () => {
      const data = { email: 'test@example.com' };
      const result = PasswordResetRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('PasswordResetConfirmSchema', () => {
    it('should validate reset confirmation', () => {
      const data = {
        token: 'reset-token-123',
        newPassword: 'newPassword123'
      };

      const result = PasswordResetConfirmSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateProfileSchema', () => {
    it('should validate profile update', () => {
      const data = {
        displayName: 'New Name',
        email: 'newemail@example.com'
      };

      const result = UpdateProfileSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const data = { displayName: 'New Name' };
      const result = UpdateProfileSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Helper functions', () => {
    describe('isValidEmail', () => {
      it('should validate correct emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      });

      it('should reject invalid emails', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
      });
    });

    describe('isValidPassword', () => {
      it('should validate strong passwords', () => {
        expect(isValidPassword('password123')).toBe(true);
        expect(isValidPassword('MySecure1')).toBe(true);
      });

      it('should reject weak passwords', () => {
        expect(isValidPassword('short')).toBe(false);
        expect(isValidPassword('nodigits')).toBe(false);
        expect(isValidPassword('12345678')).toBe(false);
      });
    });
  });
});
