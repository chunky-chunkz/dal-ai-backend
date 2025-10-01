import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import * as userStore from '../users/user.store';

const TEST_DATA_FILE = join(__dirname, '../data/users.json');

describe('User Store', () => {
  beforeEach(async () => {
    // Reset the users file before each test
    await fs.writeFile(TEST_DATA_FILE, '[]', 'utf-8').catch(() => {});
  });

  it('should create a new user', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123',
      displayName: 'Test User'
    };

    const user = await userStore.createUser(userData);

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.passwordHash).toBe('hashedpassword123');
    expect(user.displayName).toBe('Test User');
    expect(user.createdAt).toBeDefined();
  });

  it('should find user by email (case-insensitive)', async () => {
    const userData = {
      email: 'Test@Example.Com',
      passwordHash: 'hashedpassword123'
    };

    const createdUser = await userStore.createUser(userData);
    
    // Should find with exact case
    const foundUser1 = await userStore.findByEmail('test@example.com');
    expect(foundUser1?.id).toBe(createdUser.id);
    
    // Should find with different case
    const foundUser2 = await userStore.findByEmail('TEST@EXAMPLE.COM');
    expect(foundUser2?.id).toBe(createdUser.id);
  });

  it('should find user by id', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123'
    };

    const createdUser = await userStore.createUser(userData);
    const foundUser = await userStore.findById(createdUser.id);

    expect(foundUser?.id).toBe(createdUser.id);
    expect(foundUser?.email).toBe(createdUser.email);
  });

  it('should update a user', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123'
    };

    const createdUser = await userStore.createUser(userData);
    
    const updatedUser = await userStore.updateUser(createdUser.id, {
      displayName: 'Updated Name',
      passwordHash: 'newhashedpassword'
    });

    expect(updatedUser.displayName).toBe('Updated Name');
    expect(updatedUser.passwordHash).toBe('newhashedpassword');
    expect(updatedUser.email).toBe(createdUser.email);
  });

  it('should enforce unique email constraint', async () => {
    const userData1 = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123'
    };

    const userData2 = {
      email: 'TEST@EXAMPLE.COM', // Same email, different case
      passwordHash: 'hashedpassword456'
    };

    await userStore.createUser(userData1);
    
    await expect(userStore.createUser(userData2)).rejects.toThrow(
      'User with email TEST@EXAMPLE.COM already exists'
    );
  });

  it('should return null for non-existent user', async () => {
    const foundUser = await userStore.findByEmail('nonexistent@example.com');
    expect(foundUser).toBeNull();
  });

  it('should throw error when updating non-existent user', async () => {
    await expect(userStore.updateUser('nonexistent-id', { displayName: 'Test' }))
      .rejects.toThrow('User with id nonexistent-id not found');
  });
});
