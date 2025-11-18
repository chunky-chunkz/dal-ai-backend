/**
 * Task: Implement simple profile store.
 * - Use data/profiles.json (persisted).
 * - export getProfile(name: string): Record<string,string>
 * - export setProfile(name: string, key: string, value: string): void
 * - export findFact(name: string, key: string): string|null
 * - Ensure case-insensitive keys.
 * - Persist changes to JSON file after write.
 */

import fs from 'fs/promises';
import path from 'path';

interface UserProfile {
  name: string;
  data: Record<string, string>;
  lastUpdated: number;
}

interface ProfileData {
  profiles: Record<string, UserProfile>;
  lastSaved: number;
}

// Path to profiles data file  
// Persistent disk on Render oder fallback auf ./data
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

// In-memory cache for performance
let profileCache: ProfileData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Ensure data directory exists
 */
async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(PROFILES_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

/**
 * Load profiles from disk with caching
 */
async function loadProfiles(): Promise<ProfileData> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (profileCache && (now - cacheTimestamp) < CACHE_TTL) {
    return profileCache;
  }

  try {
    await ensureDataDirectory();
    const data = await fs.readFile(PROFILES_FILE, 'utf-8');
    profileCache = JSON.parse(data) as ProfileData;
    cacheTimestamp = now;
    return profileCache;
  } catch (error) {
    // File doesn't exist or is invalid - create new structure
    profileCache = {
      profiles: {},
      lastSaved: now
    };
    cacheTimestamp = now;
    return profileCache;
  }
}

/**
 * Save profiles to disk
 */
async function saveProfiles(data: ProfileData): Promise<void> {
  try {
    await ensureDataDirectory();
    data.lastSaved = Date.now();
    await fs.writeFile(PROFILES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    
    // Update cache
    profileCache = data;
    cacheTimestamp = Date.now();
    
    console.log(`💾 Profile data saved for ${Object.keys(data.profiles).length} users`);
  } catch (error) {
    console.error('Error saving profiles:', error);
    throw new Error(`Failed to save profile data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Normalize key to lowercase for case-insensitive operations
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().trim();
}

/**
 * Get profile data for a user
 */
export function getProfile(name: string): Record<string, string> {
  if (!name || typeof name !== 'string') {
    return {};
  }

  // Since this is synchronous, we need to handle the async loading differently
  // We'll return empty object if cache is not available and log warning
  if (!profileCache) {
    console.warn(`Profile cache not loaded for user: ${name}. Call loadProfiles() first.`);
    return {};
  }

  const profile = profileCache.profiles[name];
  return profile ? { ...profile.data } : {};
}

/**
 * Set a profile value for a user
 */
export async function setProfile(name: string, key: string, value: string): Promise<void> {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid name provided');
  }

  if (!key || typeof key !== 'string') {
    throw new Error('Invalid key provided');
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid value provided');
  }

  const normalizedKey = normalizeKey(key);
  
  try {
    const data = await loadProfiles();
    
    // Get or create user profile
    if (!data.profiles[name]) {
      data.profiles[name] = {
        name,
        data: {},
        lastUpdated: Date.now()
      };
    }

    const profile = data.profiles[name];
    
    // Set the value with normalized key
    profile.data[normalizedKey] = value.trim();
    profile.lastUpdated = Date.now();
    
    // Save to disk
    await saveProfiles(data);
    
    console.log(`📝 Set profile for ${name}: ${normalizedKey} = "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);
  } catch (error) {
    console.error(`Error setting profile for ${name}:`, error);
    throw error;
  }
}

/**
 * Find a fact/value for a user by key (case-insensitive)
 */
export async function findFact(name: string, key: string): Promise<string | null> {
  if (!name || typeof name !== 'string') {
    return null;
  }

  if (!key || typeof key !== 'string') {
    return null;
  }

  const normalizedKey = normalizeKey(key);
  
  try {
    const data = await loadProfiles();
    const profile = data.profiles[name];
    
    if (!profile) {
      return null;
    }

    return profile.data[normalizedKey] || null;
  } catch (error) {
    console.error(`Error finding fact for ${name}, key ${key}:`, error);
    return null;
  }
}

/**
 * Generate a prompt string with user profile information
 */
export function getProfilePrompt(userId: string): string {
  const profile = getProfile(userId);
  
  if (Object.keys(profile).length === 0) {
    return '';
  }
  
  let prompt = `\n--- Benutzerprofil für ${userId} ---\n`;
  prompt += 'Bekannte Informationen:\n';
  
  for (const [key, value] of Object.entries(profile)) {
    prompt += `- ${key}: ${value}\n`; 
  }
  
  prompt += '--- Ende Benutzerprofil ---\n';
  return prompt;
}

/**
 * Auto-detect and store user preferences from conversation
 */
export async function autoDetectPreferences(userId: string, userText: string, _assistantText: string): Promise<void> {
  // Simple pattern matching for common preference indicators
  const preferencePatterns = [
    // Language preferences
    { pattern: /ich spreche (deutsch|englisch|französisch|spanisch)/i, key: 'bevorzugte_sprache' },
    { pattern: /meine muttersprache ist (\w+)/i, key: 'muttersprache' },
    
    // Personal info
    { pattern: /ich bin (\d+) jahre alt/i, key: 'alter' },
    { pattern: /ich arbeite als (.+?)(?:\.|$)/i, key: 'beruf' },
    { pattern: /ich studiere (.+?)(?:\.|$)/i, key: 'studium' },
    { pattern: /ich wohne in (.+?)(?:\.|$)/i, key: 'wohnort' },
    { pattern: /mein name ist (\w+)/i, key: 'vorname' },
    { pattern: /ich heiße (\w+)/i, key: 'vorname' },
    
    // Interests and hobbies
    { pattern: /ich interessiere mich für (.+?)(?:\.|$)/i, key: 'interessen' },
    { pattern: /mein hobby ist (.+?)(?:\.|$)/i, key: 'hobbies' },
    { pattern: /ich mag (.+?)(?:\.|$)/i, key: 'vorlieben' },
    
    // Technical preferences
    { pattern: /ich benutze (.+?) als ide/i, key: 'ide' },
    { pattern: /ich programmiere in (.+?)(?:\.|$)/i, key: 'programmiersprachen' },
    { pattern: /mein betriebssystem ist (.+?)(?:\.|$)/i, key: 'betriebssystem' },
  ];
  
  for (const { pattern, key } of preferencePatterns) {
    const match = userText.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value.length > 0 && value.length < 100) { // Reasonable length check
        await setProfile(userId, key, value);
      }
    }
  }
}
