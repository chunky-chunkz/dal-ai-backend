import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateUserData {
  email: string;
  passwordHash?: string;
  displayName?: string;
  msOid?: string;
}

export interface UpdateUserData {
  email?: string;
  passwordHash?: string;
  displayName?: string;
  msOid?: string;
}

/**
 * Find user by email (case-insensitive)
 */
export async function findByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();
  
  return await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    }
  });
}

/**
 * Find user by ID
 */
export async function findById(id: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: {
      id
    }
  });
}

/**
 * Create a new user
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  const normalizedEmail = userData.email.toLowerCase();
  
  return await prisma.user.create({
    data: {
      ...userData,
      email: normalizedEmail
    }
  });
}

/**
 * Update an existing user
 */
export async function updateUser(id: string, patch: UpdateUserData): Promise<User> {
  const updateData = { ...patch };
  
  // Normalize email if provided
  if (updateData.email) {
    updateData.email = updateData.email.toLowerCase();
  }
  
  return await prisma.user.update({
    where: {
      id
    },
    data: updateData
  });
}

/**
 * Find user by Microsoft OID
 */
export async function findByMsOid(msOid: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: {
      msOid
    }
  });
}

/**
 * Cleanup function to close Prisma connection
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
