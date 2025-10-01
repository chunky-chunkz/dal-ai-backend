/**
 * Session Memory for JavaScript/Node.js - Conversation Memory System
 * In-memory conversation memory per sessionId.
 */

// In-memory storage: sessionId -> ChatTurn[]
const sessionMemory = new Map();

// Maximum turns to keep per session (eviction policy)
const MAX_TURNS_PER_SESSION = 50;

/**
 * Store a new turn in session memory
 * @param {string} sessionId 
 * @param {Object} turn - { role: "user"|"assistant", text: string, ts: number }
 */
function putTurn(sessionId, turn) {
  if (!sessionMemory.has(sessionId)) {
    sessionMemory.set(sessionId, []);
  }
  
  const turns = sessionMemory.get(sessionId);
  turns.push(turn);
  
  // Eviction policy: keep only last 50 turns
  if (turns.length > MAX_TURNS_PER_SESSION) {
    turns.splice(0, turns.length - MAX_TURNS_PER_SESSION);
  }
}

/**
 * Get the last N turns for context
 * @param {string} sessionId 
 * @param {number} maxTurns - default 8
 * @returns {Array} Last N turns
 */
function getContext(sessionId, maxTurns = 8) {
  const turns = sessionMemory.get(sessionId) || [];
  return turns.slice(-maxTurns);
}

/**
 * Generate a short bullet summary of the conversation (≤ 80 words)
 * @param {string} sessionId 
 * @returns {string} Summary
 */
function summarize(sessionId) {
  const turns = sessionMemory.get(sessionId) || [];
  
  if (turns.length === 0) {
    return "Neue Konversation gestartet.";
  }
  
  if (turns.length <= 2) {
    return "Kurze Konversation begonnen.";
  }
  
  // Extract key topics and themes
  const userQueries = [];
  
  turns.forEach(turn => {
    if (turn.role === "user") {
      // Extract first few words as topic indicator
      const words = turn.text.trim().split(/\s+/).slice(0, 4).join(" ");
      if (words.length > 0) {
        userQueries.push(words);
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
 * Format context for prompt injection
 * @param {string} sessionId 
 * @param {number} maxTurns 
 * @returns {string} Formatted context for AI prompt
 */
function formatContextForPrompt(sessionId, maxTurns = 8) {
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
 * Get total turn count for a session
 * @param {string} sessionId 
 * @returns {number} Number of turns
 */
function getTurnCount(sessionId) {
  return sessionMemory.get(sessionId)?.length || 0;
}

/**
 * Clear memory for a session (optional utility)
 * @param {string} sessionId 
 */
function clearSession(sessionId) {
  sessionMemory.delete(sessionId);
}

/**
 * Get all active session IDs (for debugging)
 * @returns {Array} Array of session IDs
 */
function getActiveSessions() {
  return Array.from(sessionMemory.keys());
}

module.exports = {
  putTurn,
  getContext,
  summarize,
  formatContextForPrompt,
  getTurnCount,
  clearSession,
  getActiveSessions
};
