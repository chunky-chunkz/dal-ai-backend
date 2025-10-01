/**
 * Task: Implement in-memory conversation memory per sessionId.
 * - export interface ChatTurn { role: "user"|"assistant"; text: string; ts: number }
 * - export putTurn(sessionId: string, turn: ChatTurn): void
 * - export getContext(sessionId: string, maxTurns=8): ChatTurn[] // last N turns
 * - export summarize(sessionId: string): string // short bullet summary (<= 80 words) from turns
 * - evict policy: keep at most 50 turns per session
 */

import { getProfilePrompt, autoDetectPreferences } from './profileStore.js';

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

// In-memory storage: sessionId -> ChatTurn[]
const sessionMemory = new Map<string, ChatTurn[]>();

// Maximum turns to keep per session (eviction policy)
const MAX_TURNS_PER_SESSION = 50;

/**
 * Store a new turn in session memory
 */
export function putTurn(sessionId: string, turn: ChatTurn): void {
  if (!sessionMemory.has(sessionId)) {
    sessionMemory.set(sessionId, []);
  }
  
  const turns = sessionMemory.get(sessionId)!;
  turns.push(turn);
  
  // Eviction policy: keep only last 50 turns
  if (turns.length > MAX_TURNS_PER_SESSION) {
    turns.splice(0, turns.length - MAX_TURNS_PER_SESSION);
  }
}

/**
 * Get the last N turns for context
 */
export function getContext(sessionId: string, maxTurns = 8): ChatTurn[] {
  const turns = sessionMemory.get(sessionId) || [];
  return turns.slice(-maxTurns);
}

/**
 * Generate a short bullet summary of the conversation (≤ 80 words)
 */
export function summarize(sessionId: string): string {
  const turns = sessionMemory.get(sessionId) || [];
  
  if (turns.length === 0) {
    return "Neue Konversation gestartet.";
  }
  
  if (turns.length <= 2) {
    return "Kurze Konversation begonnen.";
  }
  
  // Extract key topics and themes
  const userQueries: string[] = [];
  const assistantResponses: string[] = [];
  
  turns.forEach(turn => {
    if (turn.role === "user") {
      // Extract first few words as topic indicator
      const words = turn.text.trim().split(/\s+/).slice(0, 4).join(" ");
      if (words.length > 0) {
        userQueries.push(words);
      }
    } else {
      // Look for key topics in assistant responses
      const words = turn.text.trim().split(/\s+/).slice(0, 3).join(" ");
      if (words.length > 0) {
        assistantResponses.push(words);
      }
    }
  });
  
  // Create compact summary
  const topics = [...new Set(userQueries)].slice(0, 3); // unique topics, max 3
  const recentTopic = topics[topics.length - 1] || "Allgemeine Fragen";
  
  if (topics.length === 1) {
    return `Konversation über: ${recentTopic}. ${turns.length} Nachrichten ausgetauscht.`;
  } else if (topics.length <= 3) {
    return `Themen: ${topics.join(", ")}. Aktuell: ${recentTopic}. ${turns.length} Turns.`;
  } else {
    return `Vielfältige Themen besprochen. Aktueller Fokus: ${recentTopic}. ${turns.length} Nachrichten.`;
  }
}

/**
 * Get total turn count for a session
 */
export function getTurnCount(sessionId: string): number {
  return sessionMemory.get(sessionId)?.length || 0;
}

/**
 * Clear memory for a session (optional utility)
 */
export function clearSession(sessionId: string): void {
  sessionMemory.delete(sessionId);
}

/**
 * Get all active session IDs (for debugging)
 */
export function getActiveSessions(): string[] {
  return Array.from(sessionMemory.keys());
}

/**
 * Format context for prompt injection with profile integration
 */
export async function formatContextForPromptWithProfile(sessionId: string, userId: string, maxTurns = 8): Promise<string> {
  const context = getContext(sessionId, maxTurns);
  const summary = summarize(sessionId);
  const profilePrompt = await getProfilePrompt(userId);
  
  let prompt = '';
  
  // Add user preferences first
  if (profilePrompt) {
    prompt += profilePrompt;
  }
  
  // Add conversation context if available
  if (context.length > 0) {
    prompt += `\n--- Konversationsverlauf ---\n`;
    prompt += `Zusammenfassung: ${summary}\n\n`;
    prompt += `Letzte ${context.length} Nachrichten:\n`;
    
    context.forEach((turn) => {
      const role = turn.role === "user" ? "Benutzer" : "Assistent";
      const timeAgo = Math.floor((Date.now() - turn.ts) / 60000); // minutes ago
      prompt += `${role} (vor ${timeAgo}m): ${turn.text.substring(0, 150)}${turn.text.length > 150 ? "..." : ""}\n`;
    });
    
    prompt += `--- Ende Verlauf ---\n\n`;
  }
  
  return prompt;
}

/**
 * Format context for prompt injection (legacy without profile)
 */
export function formatContextForPrompt(sessionId: string, maxTurns = 8): string {
  const context = getContext(sessionId, maxTurns);
  const summary = summarize(sessionId);
  
  if (context.length === 0) {
    return "";
  }
  
  let prompt = `\n\n--- Konversationsverlauf ---\n`;
  prompt += `Zusammenfassung: ${summary}\n\n`;
  prompt += `Letzte ${context.length} Nachrichten:\n`;
  
  context.forEach((turn) => {
    const role = turn.role === "user" ? "Benutzer" : "Assistent";
    const timeAgo = Math.floor((Date.now() - turn.ts) / 60000); // minutes ago
    prompt += `${role} (vor ${timeAgo}m): ${turn.text.substring(0, 150)}${turn.text.length > 150 ? "..." : ""}\n`;
  });
  
  prompt += `--- Ende Verlauf ---\n\n`;
  return prompt;
}

/**
 * Auto-detect preferences and store them  
 */
export async function autoAnalyzeAndStorePreferences(sessionId: string, userId: string): Promise<void> {
  const context = getContext(sessionId, 4); // Get last 4 turns for analysis
  
  if (context.length >= 2) {
    // Find user-assistant pairs for analysis
    for (let i = 0; i < context.length - 1; i++) {
      const userTurn = context[i];
      const assistantTurn = context[i + 1];
      
      if (userTurn.role === "user" && assistantTurn.role === "assistant") {
        try {
          await autoDetectPreferences(userId, userTurn.text, assistantTurn.text);
        } catch (error) {
          console.log(`Auto-preference detection skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  }
}
