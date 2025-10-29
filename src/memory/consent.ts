/**
 * Consent Management for Memory Storage
 * 
 * Handles user consent for storing memories, especially for medium-risk items.
 * Implements temporary blacklisting for declined memories.
 */

import fs from 'fs/promises';
import path from 'path';

const CONSENT_STORE_PATH = path.join(process.cwd(), 'data', 'consent.json');
const BLACKLIST_DURATION_HOURS = 24;

export interface ConsentRecord {
  userId: string;
  key: string;
  type: string;
  decision: 'approved' | 'declined';
  timestamp: Date;
  expiresAt?: Date;
}

export interface ConsentStore {
  records: ConsentRecord[];
}

/**
 * Load consent store from disk
 */
async function loadConsentStore(): Promise<ConsentStore> {
  try {
    const data = await fs.readFile(CONSENT_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Convert date strings to Date objects
    return {
      records: parsed.records.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
        expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined
      }))
    };
  } catch (error) {
    // Return empty store if file doesn't exist
    return { records: [] };
  }
}

/**
 * Save consent store to disk
 */
async function saveConsentStore(store: ConsentStore): Promise<void> {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CONSENT_STORE_PATH);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(CONSENT_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ Error saving consent store:', error);
  }
}

/**
 * Check if a memory key is blacklisted (user declined recently)
 * 
 * @param userId - User identifier
 * @param key - Memory key to check
 * @returns True if blacklisted and not expired
 */
export async function isBlacklisted(userId: string, key: string): Promise<boolean> {
  const store = await loadConsentStore();
  const now = new Date();
  
  const record = store.records.find(r => 
    r.userId === userId &&
    r.key === key &&
    r.decision === 'declined' &&
    r.expiresAt &&
    r.expiresAt > now
  );
  
  return !!record;
}

/**
 * Record user's consent decision
 * 
 * @param userId - User identifier
 * @param key - Memory key
 * @param type - Memory type
 * @param approved - True if user approved, false if declined
 * @returns Success boolean
 */
export async function recordConsent(
  userId: string,
  key: string,
  type: string,
  approved: boolean
): Promise<boolean> {
  try {
    const store = await loadConsentStore();
    const now = new Date();
    
    // Remove old record for same key if exists
    store.records = store.records.filter(r => 
      !(r.userId === userId && r.key === key)
    );
    
    // Calculate expiration for declined items (24h blacklist)
    let expiresAt: Date | undefined;
    if (!approved) {
      expiresAt = new Date(now.getTime() + BLACKLIST_DURATION_HOURS * 60 * 60 * 1000);
    }
    
    // Add new record
    const record: ConsentRecord = {
      userId,
      key,
      type,
      decision: approved ? 'approved' : 'declined',
      timestamp: now,
      expiresAt
    };
    
    store.records.push(record);
    
    await saveConsentStore(store);
    
    console.log(`✅ Consent recorded: ${userId} ${approved ? 'approved' : 'declined'} ${key}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error recording consent:', error);
    return false;
  }
}

/**
 * Get user's consent history
 * 
 * @param userId - User identifier
 * @param includeExpired - Include expired blacklist items (default: false)
 * @returns Array of consent records
 */
export async function getConsentHistory(
  userId: string,
  includeExpired: boolean = false
): Promise<ConsentRecord[]> {
  const store = await loadConsentStore();
  const now = new Date();
  
  let records = store.records.filter(r => r.userId === userId);
  
  if (!includeExpired) {
    records = records.filter(r => 
      !r.expiresAt || r.expiresAt > now
    );
  }
  
  return records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Clean up expired blacklist entries
 * Should be called periodically (e.g., daily)
 */
export async function cleanupExpired(): Promise<number> {
  try {
    const store = await loadConsentStore();
    const now = new Date();
    const initialCount = store.records.length;
    
    // Remove expired declined records
    store.records = store.records.filter(r => {
      if (r.decision === 'declined' && r.expiresAt) {
        return r.expiresAt > now;
      }
      return true;
    });
    
    const removedCount = initialCount - store.records.length;
    
    if (removedCount > 0) {
      await saveConsentStore(store);
      console.log(`🧹 Cleaned up ${removedCount} expired consent records`);
    }
    
    return removedCount;
    
  } catch (error) {
    console.error('❌ Error cleaning up consent store:', error);
    return 0;
  }
}

/**
 * Clear all consent records for a user
 * Useful when user wants to reset their privacy settings
 * 
 * @param userId - User identifier
 * @returns Number of records removed
 */
export async function clearUserConsent(userId: string): Promise<number> {
  try {
    const store = await loadConsentStore();
    const initialCount = store.records.length;
    
    store.records = store.records.filter(r => r.userId !== userId);
    
    const removedCount = initialCount - store.records.length;
    
    if (removedCount > 0) {
      await saveConsentStore(store);
      console.log(`🧹 Cleared ${removedCount} consent records for user ${userId}`);
    }
    
    return removedCount;
    
  } catch (error) {
    console.error('❌ Error clearing user consent:', error);
    return 0;
  }
}

/**
 * Ask for consent (in practice, this would trigger UI prompt)
 * For now, returns metadata about what to ask
 * 
 * @param userId - User identifier
 * @param key - Memory key
 * @param value - Memory value
 * @param type - Memory type
 * @param risk - Risk level
 * @returns Consent prompt data
 */
export interface ConsentPrompt {
  userId: string;
  key: string;
  value: string;
  type: string;
  risk: string;
  question: string;
  isBlacklisted: boolean;
}

export async function createConsentPrompt(
  userId: string,
  key: string,
  value: string,
  type: string,
  risk: string
): Promise<ConsentPrompt> {
  const blacklisted = await isBlacklisted(userId, key);
  
  // Generate human-readable question
  let question: string;
  
  if (type === 'contact') {
    question = `Soll ich mir deine Kontaktinformation "${key}: ${value}" merken?`;
  } else if (type === 'task_hint') {
    question = `Soll ich mir für 30 Tage merken: "${key}: ${value}"?`;
  } else if (type === 'preference') {
    question = `Soll ich mir deine Präferenz "${key}: ${value}" dauerhaft merken?`;
  } else {
    question = `Soll ich mir merken, dass ${key}: ${value}?`;
  }
  
  return {
    userId,
    key,
    value,
    type,
    risk,
    question,
    isBlacklisted: blacklisted
  };
}

/**
 * Get consent statistics for a user
 */
export interface ConsentStats {
  totalRecords: number;
  approved: number;
  declined: number;
  activeBlacklists: number;
}

export async function getConsentStats(userId: string): Promise<ConsentStats> {
  const records = await getConsentHistory(userId, true);
  const now = new Date();
  
  return {
    totalRecords: records.length,
    approved: records.filter(r => r.decision === 'approved').length,
    declined: records.filter(r => r.decision === 'declined').length,
    activeBlacklists: records.filter(r => 
      r.decision === 'declined' && 
      r.expiresAt && 
      r.expiresAt > now
    ).length
  };
}
