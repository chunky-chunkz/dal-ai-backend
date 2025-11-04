/**
 * Memory Event Logger
 * 
 * Task: Implement Memory event logger writing to data/metrics/memory_events.ndjson.
 * - Export logMemoryEvent(evt) and helpers now(), hh()
 * - Ensure directory exists; append JSONL line per call.
 */

import fs from "fs/promises";
import path from "path";
import type { MemoryEvent } from "./types.js";

const LOG_FILE = path.resolve("data/metrics/memory_events.ndjson");

/**
 * Log a memory event to NDJSON file
 */
export async function logMemoryEvent(evt: MemoryEvent): Promise<void> {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    
    // Append event as JSONL line
    await fs.appendFile(LOG_FILE, JSON.stringify(evt) + "\n", "utf8");
  } catch (error) {
    // Don't throw - logging should never break the app
    console.error("Failed to log memory event:", error);
  }
}

/**
 * Get current timestamp in milliseconds
 */
export const now = (): number => Date.now();

/**
 * Hash/normalize a key for logging (lowercase, replace spaces, max 40 chars)
 */
export const hh = (s: string): string => 
  s.toLowerCase().replace(/\s+/g, "_").slice(0, 40);
