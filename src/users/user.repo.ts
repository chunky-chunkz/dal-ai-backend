import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// Erst DATA_DIR aus Umgebungsvariable nehmen, sonst fallback auf ./data
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  displayName?: string;
  msOid?: string;
  createdAt: string;
}

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

// Initialize users storage
async function ensureUsersFile(): Promise<void> {
  try {
    await fs.access(USERS_FILE);
  } catch {
    // File doesn't exist, create it with empty array
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

async function readUsers(): Promise<User[]> {
  await ensureUsersFile();
  const content = await fs.readFile(USERS_FILE, 'utf-8');
  return JSON.parse(content);
}

async function writeUsers(users: User[]): Promise<void> {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Find user by email (case-insensitive)
 */
export async function findByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();
  const users = await readUsers();
  return users.find(u => u.email.toLowerCase() === normalizedEmail) || null;
}

/**
 * Find user by ID
 */
export async function findById(id: string): Promise<User | null> {
  const users = await readUsers();
  return users.find(u => u.id === id) || null;
}

/**
 * Create a new user
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  const normalizedEmail = userData.email.toLowerCase();
  
  const users = await readUsers();
  
  // Check if user already exists
  if (users.find(u => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('User with this email already exists');
  }
  
  const newUser: User = {
    id: generateId(),
    email: normalizedEmail,
    passwordHash: userData.passwordHash,
    displayName: userData.displayName,
    msOid: userData.msOid,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  await writeUsers(users);
  
  return newUser;
}

/**
 * Update an existing user
 */
export async function updateUser(id: string, patch: UpdateUserData): Promise<User> {
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  const updateData = { ...patch };
  
  // Normalize email if provided
  if (updateData.email) {
    updateData.email = updateData.email.toLowerCase();
  }
  
  users[userIndex] = {
    ...users[userIndex],
    ...updateData
  };
  
  await writeUsers(users);
  
  return users[userIndex];
}

/**
 * Find user by Microsoft OID
 */
export async function findByMsOid(msOid: string): Promise<User | null> {
  const users = await readUsers();
  return users.find(u => u.msOid === msOid) || null;
}

/**
 * Cleanup function (no-op for JSON-based storage)
 */
export async function disconnect(): Promise<void> {
  // No cleanup needed for JSON files
}
