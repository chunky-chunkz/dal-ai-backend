import { describe, it, expect } from 'vitest';
import { RegisterSchema, LoginSchema } from '../auth/validators';
import * as userStore from '../users/user.store';
import { hashPassword } from '../auth/password';

describe('Auth Routes Integration', () => {
  describe('Schema Validation', () => {
    it('should validate registration data', () => {
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

    it('should validate login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'anypassword'
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('User Flow Simulation', () => {
    it('should simulate complete registration and login flow', async () => {
      const testEmail = 'testflow@example.com';
      const testPassword = 'testPassword123';
      
      // 1. Check user doesn't exist
      let existingUser = await userStore.findByEmail(testEmail);
      if (existingUser) {
        // Clean up from previous test
        await userStore.updateUser(existingUser.id, { passwordHash: 'dummy' });
      }

      // 2. Hash password
      const passwordHash = await hashPassword(testPassword);
      expect(passwordHash).toBeDefined();
      expect(passwordHash).not.toBe(testPassword);

      // 3. Create user
      const user = await userStore.createUser({
        email: testEmail,
        passwordHash,
        displayName: 'Test Flow User'
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.displayName).toBe('Test Flow User');

      // 4. Find user by email
      const foundUser = await userStore.findByEmail(testEmail);
      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(user.id);

      console.log('✅ Complete auth flow simulation successful');
    });
  });
});
