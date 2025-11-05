/**
 * Document Statistics Event Logger
 * 
 * Logs document-related events for analytics:
 * - Document searches
 * - Document retrievals
 * - Relevance scores
 * - User interactions
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const LOG_FILE = path.resolve("data/metrics/document_events.ndjson");

/**
 * Document Event Types
 */
export type DocumentEvent =
  | { type: "search"; userId?: string; query: string; queryHash: string; resultsCount: number; latencyMs: number; ts: number }
  | { type: "retrieve"; userId?: string; docId: string; docTitle: string; relevanceScore: number; source: "search" | "related" | "direct"; ts: number }
  | { type: "click"; userId?: string; docId: string; position: number; query?: string; ts: number }
  | { type: "feedback"; userId?: string; docId: string; query: string; helpful: boolean; ts: number }
  | { type: "index"; docId: string; title: string; category?: string; wordCount: number; ts: number }
  | { type: "update"; docId: string; changeType: "content" | "metadata" | "reindex"; ts: number }
  | { type: "delete"; docId: string; reason?: string; ts: number }
  | { type: "error"; where: string; message: string; userId?: string; ts: number };

/**
 * Log a document event to NDJSON file
 */
export async function logDocumentEvent(evt: DocumentEvent): Promise<void> {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    
    // Append event as JSONL line
    await fs.appendFile(LOG_FILE, JSON.stringify(evt) + "\n", "utf8");
  } catch (error) {
    // Don't throw - logging should never break the app
    console.error("Failed to log document event:", error);
  }
}

/**
 * Get current timestamp in milliseconds
 */
export const now = (): number => Date.now();

/**
 * Hash/normalize a string for logging (lowercase, max 60 chars)
 */
export const hashString = (s: string): string => 
  crypto.createHash('md5').update(s).digest('hex').substring(0, 8);
