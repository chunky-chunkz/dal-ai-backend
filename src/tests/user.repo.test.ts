import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as userRepo from '../users/user.repo';

const prisma = new PrismaClient();

describe('User Repository (Prisma)', () => {
  beforeEach(async () => {
    // Clean up the database before each test
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Clean up and disconnect after all tests
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should create a new user', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123',
      displayName: 'Test User'
    };

    const user = await userRepo.createUser(userData);

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

    const createdUser = await userRepo.createUser(userData);
    
    // Should find with normalized lowercase email
    const foundUser = await userRepo.findByEmail('TEST@EXAMPLE.COM');
    expect(foundUser?.id).toBe(createdUser.id);
    expect(foundUser?.email).toBe('test@example.com'); // Should be normalized to lowercase
  });

  it('should find user by id', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123'
    };

    const createdUser = await userRepo.createUser(userData);
    const foundUser = await userRepo.findById(createdUser.id);

    expect(foundUser?.id).toBe(createdUser.id);
    expect(foundUser?.email).toBe(createdUser.email);
  });

  it('should update a user', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123'
    };

    const createdUser = await userRepo.createUser(userData);
    
    const updatedUser = await userRepo.updateUser(createdUser.id, {
      displayName: 'Updated Name',
      passwordHash: 'newhashedpassword'
    });

    expect(updatedUser.displayName).toBe('Updated Name');
    expect(updatedUser.passwordHash).toBe('newhashedpassword');
    expect(updatedUser.email).toBe(createdUser.email);
  });

  it('should find user by Microsoft OID', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123',
      msOid: 'ms-oid-12345'
    };

    const createdUser = await userRepo.createUser(userData);
    const foundUser = await userRepo.findByMsOid('ms-oid-12345');

    expect(foundUser?.id).toBe(createdUser.id);
    expect(foundUser?.msOid).toBe('ms-oid-12345');
  });

  it('should return null for non-existent user', async () => {
    const foundUser = await userRepo.findByEmail('nonexistent@example.com');
    expect(foundUser).toBeNull();
  });

  it('should handle unique constraint violations gracefully', async () => {
    const userData1 = {
      email: 'test@example.com',
      passwordHash: 'hashedpassword123'
    };

    const userData2 = {
      email: 'test@example.com', // Same email
      passwordHash: 'hashedpassword456'
    };

    await userRepo.createUser(userData1);
    
    // Should throw due to unique constraint on email
    await expect(userRepo.createUser(userData2)).rejects.toThrow();
  });
});
