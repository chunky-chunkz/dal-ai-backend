import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  displayName?: string;
  msOid?: string;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  displayName?: string;
  msOid?: string;
}

export interface UpdateUserData {
  email?: string;
  passwordHash?: string;
  displayName?: string;
  msOid?: string;
}

const DATA_FILE = join(__dirname, '../data/users.json');

/**
 * Load users from JSON file
 */
async function loadUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, return empty array
    return [];
  }
}

/**
 * Save users to JSON file
 */
async function saveUsers(users: User[]): Promise<void> {
  // Ensure directory exists
  const dir = join(__dirname, '../data');
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Generate a unique user ID
 */
function generateId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Find user by email (case-insensitive)
 */
export async function findByEmail(email: string): Promise<User | null> {
  const users = await loadUsers();
  const normalizedEmail = email.toLowerCase();
  
  return users.find(user => user.email.toLowerCase() === normalizedEmail) || null;
}

/**
 * Find user by ID
 */
export async function findById(id: string): Promise<User | null> {
  const users = await loadUsers();
  return users.find(user => user.id === id) || null;
}

/**
 * Create a new user
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  const users = await loadUsers();
  const normalizedEmail = userData.email.toLowerCase();
  
  // Check if email already exists (case-insensitive)
  const existingUser = users.find(user => user.email.toLowerCase() === normalizedEmail);
  if (existingUser) {
    throw new Error(`User with email ${userData.email} already exists`);
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
  await saveUsers(users);
  
  return newUser;
}

/**
 * Update an existing user
 */
export async function updateUser(id: string, patch: UpdateUserData): Promise<User> {
  const users = await loadUsers();
  const userIndex = users.findIndex(user => user.id === id);
  
  if (userIndex === -1) {
    throw new Error(`User with id ${id} not found`);
  }
  
  const updateData = { ...patch };
  
  // Normalize email if provided and check for uniqueness
  if (updateData.email) {
    const normalizedEmail = updateData.email.toLowerCase();
    const existingUser = users.find((user, index) => 
      index !== userIndex && user.email.toLowerCase() === normalizedEmail
    );
    
    if (existingUser) {
      throw new Error(`User with email ${updateData.email} already exists`);
    }
    
    updateData.email = normalizedEmail;
  }
  
  // Update the user
  users[userIndex] = {
    ...users[userIndex],
    ...updateData
  };
  
  await saveUsers(users);
  
  return users[userIndex];
}

/**
 * Find user by Microsoft OID
 */
export async function findByMsOid(msOid: string): Promise<User | null> {
  const users = await loadUsers();
  return users.find(user => user.msOid === msOid) || null;
}
