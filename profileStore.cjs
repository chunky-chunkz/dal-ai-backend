/**
 * Simple Profile Store for JavaScript/Node.js
 * Stores user preferences and notes
 */

const fs = require('fs').promises;
const path = require('path');

// Path to profiles data file
const PROFILES_FILE = path.join(process.cwd(), 'profiles.json');
const MAX_NOTES_PER_USER = 20;

// In-memory cache
let profileCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load profiles from disk with caching
 */
async function loadProfiles() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (profileCache && (now - cacheTimestamp) < CACHE_TTL) {
    return profileCache;
  }

  try {
    const data = await fs.readFile(PROFILES_FILE, 'utf-8');
    profileCache = JSON.parse(data);
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
async function saveProfiles(data) {
  try {
    data.lastSaved = Date.now();
    await fs.writeFile(PROFILES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    
    // Update cache
    profileCache = data;
    cacheTimestamp = Date.now();
    
    console.log(`💾 Profile data saved for ${Object.keys(data.profiles).length} users`);
  } catch (error) {
    console.error('Error saving profiles:', error);
    throw new Error(`Failed to save profile data: ${error.message}`);
  }
}

/**
 * Get all notes for a user
 */
async function getNotes(userId) {
  if (!userId || typeof userId !== 'string') {
    return [];
  }

  try {
    const data = await loadProfiles();
    const profile = data.profiles[userId];
    return profile ? [...profile.notes] : [];
  } catch (error) {
    console.error(`Error getting notes for user ${userId}:`, error);
    return [];
  }
}

/**
 * Add a note for a user (with deduplication and capping)
 */
async function addNote(userId, note) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId provided');
  }

  if (!note || typeof note !== 'string') {
    throw new Error('Invalid note provided');
  }

  const cleanNote = note.trim();
  if (cleanNote.length === 0) {
    return; // Don't add empty notes
  }

  if (cleanNote.length > 500) {
    throw new Error('Note too long (max 500 characters)');
  }

  try {
    const data = await loadProfiles();
    
    // Get or create user profile
    if (!data.profiles[userId]) {
      data.profiles[userId] = {
        userId,
        notes: [],
        lastUpdated: Date.now()
      };
    }

    const profile = data.profiles[userId];
    
    // Check for duplicates (case-insensitive)
    const normalizedNote = cleanNote.toLowerCase();
    const isDuplicate = profile.notes.some(existingNote => 
      existingNote.toLowerCase() === normalizedNote
    );

    if (!isDuplicate) {
      // Add new note at the beginning (most recent first)
      profile.notes.unshift(cleanNote);
      
      // Cap at MAX_NOTES_PER_USER
      if (profile.notes.length > MAX_NOTES_PER_USER) {
        profile.notes = profile.notes.slice(0, MAX_NOTES_PER_USER);
      }
      
      profile.lastUpdated = Date.now();
      
      // Save to disk
      await saveProfiles(data);
      
      console.log(`📝 Added note for user ${userId}: "${cleanNote.substring(0, 50)}${cleanNote.length > 50 ? '...' : ''}"`);
    } else {
      console.log(`⚠️  Duplicate note skipped for user ${userId}`);
    }
  } catch (error) {
    console.error(`Error adding note for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get formatted profile notes for prompt injection
 */
async function getProfilePrompt(userId) {
  const notes = await getNotes(userId);
  
  if (notes.length === 0) {
    return '';
  }

  return `\n--- User-Präferenzen ---\n${notes.map((note, index) => `${index + 1}. ${note}`).join('\n')}\n--- Ende Präferenzen ---\n`;
}

/**
 * Auto-detect and add preference notes from conversation patterns
 */
async function autoDetectPreferences(userId, userMessage, aiResponse) {
  if (!userId || !userMessage || !aiResponse) {
    return;
  }

  const message = userMessage.toLowerCase();

  // Detect preference patterns
  const preferences = [];

  // Length preferences
  if (message.includes('kurz') || message.includes('kürzer') || message.includes('zusammenfassung')) {
    preferences.push('Bevorzugt kurze, prägnante Antworten');
  }
  
  if (message.includes('ausführlich') || message.includes('detail') || message.includes('genauer')) {
    preferences.push('Bevorzugt ausführliche, detaillierte Antworten');
  }

  // Language preferences
  if (message.includes('english') || message.includes('englisch')) {
    preferences.push('Kommuniziert gelegentlich auf Englisch');
  }

  // Communication style
  if (message.includes('formell') || message.includes('sie')) {
    preferences.push('Bevorzugt formelle Kommunikation (Sie-Form)');
  }

  if (message.includes('du') || message.includes('informal')) {
    preferences.push('Bevorzugt informelle Kommunikation (Du-Form)');
  }

  // Technical level
  if (message.includes('technisch') || message.includes('code') || message.includes('api')) {
    preferences.push('Interesse an technischen Details');
  }

  // Add detected preferences
  for (const preference of preferences) {
    try {
      await addNote(userId, preference);
    } catch (error) {
      // Ignore duplicate or error cases
      console.log(`Auto-detection: skipped "${preference}" for user ${userId}`);
    }
  }
}

module.exports = {
  getNotes,
  addNote,
  getProfilePrompt,
  autoDetectPreferences
};
