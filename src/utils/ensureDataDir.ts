/**
 * Ensure data directory exists for persistent storage
 * This is critical for Render.com persistent disk at /var/data
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

/**
 * Ensure the data directory exists
 * Creates it recursively if it doesn't exist
 */
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`📁 Creating data directory: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } else {
    console.log(`✅ Data directory exists: ${DATA_DIR}`);
  }
}

/**
 * Get the data directory path
 */
export function getDataDir(): string {
  return DATA_DIR;
}

// Auto-initialize when module is imported
ensureDataDir();
