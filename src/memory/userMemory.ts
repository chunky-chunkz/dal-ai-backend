/**
 * User Memory System
 * Stores and retrieves user-specific information for personalized conversations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basisverzeichnis für Daten: persistent Disk oder fallback auf altes Verhalten
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Path to user memories storage
const MEMORY_FILE = path.join(DATA_DIR, 'user_memories.json');

export interface UserMemory {
  userId: string;
  memories: {
    [key: string]: {
      value: string;
      timestamp: string;
      context?: string;
    };
  };
  lastUpdated: string;
}

export interface MemoryDatabase {
  [userId: string]: UserMemory;
}

/**
 * Load user memories from file
 */
async function loadMemories(): Promise<MemoryDatabase> {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log('📝 Creating new user memories file');
    return {};
  }
}

/**
 * Save user memories to file
 */
async function saveMemories(memories: MemoryDatabase): Promise<void> {
  try {
    // Ordner anlegen, falls nicht vorhanden
    await fs.mkdir(path.dirname(MEMORY_FILE), { recursive: true });

    await fs.writeFile(MEMORY_FILE, JSON.stringify(memories, null, 2));
  } catch (error) {
    console.error('❌ Error saving user memories:', error);
  }
}

/**
 * Add or update a memory for a user
 */
export async function addUserMemory(
  userId: string, 
  key: string, 
  value: string, 
  context?: string
): Promise<void> {
  const memories = await loadMemories();
  
  if (!memories[userId]) {
    memories[userId] = {
      userId,
      memories: {},
      lastUpdated: new Date().toISOString()
    };
  }

  memories[userId].memories[key] = {
    value,
    timestamp: new Date().toISOString(),
    context
  };
  
  memories[userId].lastUpdated = new Date().toISOString();
  
  await saveMemories(memories);
  console.log(`💾 Saved memory for user ${userId}: ${key} = ${value}`);
}

/**
 * Get a specific memory for a user
 */
export async function getUserMemory(userId: string, key: string): Promise<string | null> {
  const memories = await loadMemories();
  const userMemory = memories[userId]?.memories[key];
  return userMemory ? userMemory.value : null;
}

/**
 * Get all memories for a user
 */
export async function getAllUserMemories(userId: string): Promise<Record<string, string>> {
  const memories = await loadMemories();
  const userMemories = memories[userId]?.memories || {};
  
  // Convert to simple key-value pairs
  const result: Record<string, string> = {};
  for (const [key, memory] of Object.entries(userMemories)) {
    result[key] = memory.value;
  }
  
  return result;
}

/**
 * Extract potential memories from user message
 * Looks for patterns like "my favorite color is blue", "I like pizza", etc.
 */
export function extractMemoriesFromMessage(message: string): Array<{key: string, value: string}> {
  const memories: Array<{key: string, value: string}> = [];
  const lowerMessage = message.toLowerCase();
  
  // Pattern matching for common memory phrases
  const patterns = [
    // Favorite things - improved patterns
    { pattern: /meine?\s+lieblings\s*farbe\s+ist\s+([a-züöä\s]+)/g, keyPrefix: 'lieblings_farbe' },
    { pattern: /meine?\s+lieblings([a-züöä]+)\s+ist\s+([a-züöä\s]+)/g, keyPrefix: 'lieblings' },
    { pattern: /ich mag ([a-züöä\s]+)/g, keyPrefix: 'mag' },
    { pattern: /ich liebe ([a-züöä\s]+)/g, keyPrefix: 'liebe' },
    
    // Personal info
    { pattern: /ich heiße ([a-züöä\s]+)/g, keyPrefix: 'name' },
    { pattern: /mein name ist ([a-züöä\s]+)/g, keyPrefix: 'name' },
    { pattern: /ich bin ([0-9]+) jahre alt/g, keyPrefix: 'alter' },
    { pattern: /ich wohne in ([a-züöä\s]+)/g, keyPrefix: 'wohnort' },
    { pattern: /ich arbeite als ([a-züöä\s]+)/g, keyPrefix: 'beruf' },
    { pattern: /ich studiere ([a-züöä\s]+)/g, keyPrefix: 'studium' },
    
    // Preferences
    { pattern: /ich trinke gerne ([a-züöä\s]+)/g, keyPrefix: 'trinkt_gerne' },
    { pattern: /ich esse gerne ([a-züöä\s]+)/g, keyPrefix: 'isst_gerne' },
    { pattern: /ich höre gerne ([a-züöä\s]+)/g, keyPrefix: 'musik' },
  ];

  for (const { pattern, keyPrefix } of patterns) {
    let match;
    while ((match = pattern.exec(lowerMessage)) !== null) {
      let key = keyPrefix;
      let value = '';
      
      if (keyPrefix === 'lieblings_farbe') {
        // Special handling for "meine lieblingsfarbe ist blau"
        value = match[1].trim();
      } else if (keyPrefix === 'lieblings' && match[2]) {
        // For patterns like "lieblings[kategorie] ist [wert]"
        key = `${keyPrefix}_${match[1].trim()}`;
        value = match[2].trim();
      } else {
        // Standard single capture group
        value = match[1].trim();
      }
      
      if (value) {
        memories.push({
          key: key.replace(/\s+/g, '_'),
          value: value
        });
        console.log(`🧠 Found memory: ${key} = ${value}`);
      }
    }
  }
  
  return memories;
}

/**
 * Extract and store memories from user message
 */
export async function processAndStoreMemories(message: string, userId: string): Promise<void> {
  console.log(`🔍 Processing message for memories: "${message}" (User: ${userId})`);
  const extractedMemories = extractMemoriesFromMessage(message);
  
  console.log(`📝 Extracted ${extractedMemories.length} memories:`, extractedMemories);
  
  for (const memory of extractedMemories) {
    await addUserMemory(userId, memory.key, memory.value, `Extracted from: "${message}"`);
  }
}

/**
 * Create context string from user memories for AI prompt
 */
export async function createMemoryContext(userId: string): Promise<string> {
  const memories = await getAllUserMemories(userId);
  
  console.log(`🧠 Creating memory context for user ${userId}:`, memories);
  
  if (Object.keys(memories).length === 0) {
    console.log(`❌ No memories found for user ${userId}`);
    return '';
  }
  
  const memoryLines = Object.entries(memories).map(([key, value]) => {
    const readableKey = key.replace(/_/g, ' ').replace('lieblings', 'Lieblings');
    return `- ${readableKey}: ${value}`;
  });
  
  const context = `
Bekannte Informationen über diesen Benutzer:
${memoryLines.join('\n')}

Nutze diese Informationen, um personalisierte und relevante Antworten zu geben.
`;
  
  console.log(`✅ Memory context created:`, context);
  return context;
}
