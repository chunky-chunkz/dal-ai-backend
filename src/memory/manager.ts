/**
 * Memory Manager - Orchestrates memory evaluation and storage decisions
 * 
 * Combines PII detection, candidate extraction, risk classification,
 * and scoring to make intelligent memory storage decisions.
 */

import { detectPII } from './pii.js';
import { extractCandidates, type Candidate } from './extractor.js';
import { classifyRisk, canAutoSave } from './policy.js';
import { scoreCandidate } from './scorer.js';
import { defaultTTL } from './policy.js';
import { listByUser, upsert, type MemoryItem } from './store.js';

export interface EvaluationResult {
  saved: MemoryItem[];
  suggestions: MemoryItem[];
  rejected: string[];
}

export interface MemoryCandidate extends Candidate {
  risk: "low" | "medium" | "high";
  score: number;
  ttl: string | null;
  reason?: string;
}

/**
 * Evaluate an utterance and decide what memories to store
 * 
 * @param userId - User identifier
 * @param utterance - Text to evaluate for memory extraction
 * @returns Result with saved memories, suggestions, and rejections
 */
export async function evaluateAndMaybeStore(
  userId: string, 
  utterance: string
): Promise<EvaluationResult> {
  const result: EvaluationResult = {
    saved: [],
    suggestions: [],
    rejected: []
  };

  try {
    // Step 1: Check for PII - reject immediately if found
    const piiDetection = detectPII(utterance);
    if (piiDetection.hasPII) {
      console.log(`🚫 Rejecting utterance due to PII detection:`, piiDetection.matches.map(m => m.kind));
      result.rejected.push('pii');
      return result;
    }

    // Step 2: Extract memory candidates
    const candidates = await extractCandidates(utterance, userId);
    
    if (candidates.length === 0) {
      console.log('📝 No memory candidates found in utterance');
      return result;
    }

    console.log(`🔍 Found ${candidates.length} memory candidates`);

    // Step 3: Get existing memories for deduplication
    const existingMemories = await listByUser(userId);

    // Step 4: Evaluate each candidate
    for (const candidate of candidates) {
      const evaluation = await evaluateCandidate(
        candidate, 
        utterance, 
        existingMemories
      );

      console.log(`📊 Candidate: ${candidate.key}="${candidate.value}" | Risk: ${evaluation.risk} | Score: ${evaluation.score.toFixed(3)}`);

      // Apply decision logic
      if (evaluation.risk === "high") {
        console.log(`🚫 Rejecting high-risk candidate: ${candidate.key}`);
        result.rejected.push(`high_risk:${candidate.key}`);
        continue;
      }

      // Auto-save if conditions are met
      if (canAutoSave(candidate.type) && evaluation.score >= 0.75) {
        try {
          const memoryItem = await upsert(userId, {
            userId,
            person: candidate.person,
            type: candidate.type,
            key: candidate.key,
            value: candidate.value,
            confidence: candidate.confidence,
            ttl: evaluation.ttl || undefined
          });

          console.log(`✅ Auto-saved memory: ${candidate.key}="${candidate.value}"`);
          result.saved.push(memoryItem);
        } catch (error) {
          console.error(`❌ Failed to save memory:`, error);
          result.rejected.push(`save_error:${candidate.key}`);
        }
        continue;
      }

      // Suggest for user approval if score is decent
      if (evaluation.score >= 0.5) {
        // Create a temporary memory item for suggestion
        const suggestionItem: MemoryItem = {
          id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          person: candidate.person,
          type: candidate.type,
          key: candidate.key,
          value: candidate.value,
          confidence: candidate.confidence,
          ttl: evaluation.ttl || undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        console.log(`💭 Adding suggestion: ${candidate.key}="${candidate.value}"`);
        result.suggestions.push(suggestionItem);
        continue;
      }

      // Reject low-scoring candidates
      console.log(`🚫 Rejecting low-score candidate: ${candidate.key} (score: ${evaluation.score.toFixed(3)})`);
      result.rejected.push(`low_score:${candidate.key}`);
    }

    console.log(`📈 Evaluation complete: ${result.saved.length} saved, ${result.suggestions.length} suggested, ${result.rejected.length} rejected`);
    return result;

  } catch (error) {
    console.error('❌ Error in memory evaluation:', error);
    result.rejected.push('evaluation_error');
    return result;
  }
}

/**
 * Evaluate a single memory candidate
 */
async function evaluateCandidate(
  candidate: Candidate,
  utterance: string,
  existingMemories: MemoryItem[]
): Promise<MemoryCandidate> {
  // Calculate risk level
  const risk = classifyRisk(utterance, candidate.type);
  
  // Calculate memory worthiness score
  const score = scoreCandidate(candidate, existingMemories);
  
  // Get default TTL for this memory type
  const ttl = defaultTTL(candidate.type);
  
  return {
    ...candidate,
    risk,
    score,
    ttl
  };
}

/**
 * Save a suggested memory after user approval
 * 
 * @param userId - User identifier
 * @param suggestion - Suggested memory item to save
 * @returns The saved memory item
 */
export async function saveSuggestion(
  userId: string,
  suggestion: MemoryItem
): Promise<MemoryItem> {
  // Verify the suggestion belongs to the user
  if (suggestion.userId !== userId) {
    throw new Error('Suggestion does not belong to user');
  }

  // Save the memory
  const savedMemory = await upsert(userId, {
    userId: suggestion.userId,
    person: suggestion.person,
    type: suggestion.type,
    key: suggestion.key,
    value: suggestion.value,
    confidence: suggestion.confidence,
    ttl: suggestion.ttl
  });

  console.log(`✅ User approved and saved memory: ${suggestion.key}="${suggestion.value}"`);
  return savedMemory;
}

/**
 * Batch evaluate multiple utterances
 * 
 * @param userId - User identifier
 * @param utterances - Array of utterances to evaluate
 * @returns Combined evaluation results
 */
export async function evaluateBatch(
  userId: string,
  utterances: string[]
): Promise<EvaluationResult> {
  const combinedResult: EvaluationResult = {
    saved: [],
    suggestions: [],
    rejected: []
  };

  for (const utterance of utterances) {
    const result = await evaluateAndMaybeStore(userId, utterance);
    
    combinedResult.saved.push(...result.saved);
    combinedResult.suggestions.push(...result.suggestions);
    combinedResult.rejected.push(...result.rejected);
  }

  return combinedResult;
}

/**
 * Get memory evaluation statistics for debugging
 * 
 * @param userId - User identifier
 * @param utterance - Utterance to analyze
 * @returns Detailed evaluation breakdown
 */
export async function getEvaluationStats(
  userId: string,
  utterance: string
): Promise<{
  hasPII: boolean;
  candidateCount: number;
  candidates: MemoryCandidate[];
  existingMemoryCount: number;
}> {
  const piiDetection = detectPII(utterance);
  const candidates = await extractCandidates(utterance, userId);
  const existingMemories = await listByUser(userId);

  const evaluatedCandidates: MemoryCandidate[] = [];

  for (const candidate of candidates) {
    const evaluation = await evaluateCandidate(
      candidate,
      utterance,
      existingMemories
    );
    evaluatedCandidates.push(evaluation);
  }

  return {
    hasPII: piiDetection.hasPII,
    candidateCount: candidates.length,
    candidates: evaluatedCandidates,
    existingMemoryCount: existingMemories.length
  };
}

/**
 * Check if an utterance is worth evaluating (quick pre-filter)
 * 
 * @param utterance - Utterance to check
 * @returns True if utterance might contain memory-worthy content
 */
export function isWorthEvaluating(utterance: string): boolean {
  const trimmed = utterance.trim();
  
  // Too short or too long
  if (trimmed.length < 5 || trimmed.length > 500) {
    return false;
  }
  
  // Common non-memory phrases (German and English)
  const skipPhrases = [
    'wie geht', 'was ist', 'können sie', 'danke', 'bitte',
    'how are', 'what is', 'can you', 'thank you', 'please',
    'hallo', 'hi', 'tschüss', 'bye', 'ok', 'okay'
  ];
  
  const lowerUtterance = trimmed.toLowerCase();
  
  for (const phrase of skipPhrases) {
    if (lowerUtterance.startsWith(phrase)) {
      return false;
    }
  }
  
  // Contains personal indicators
  const personalIndicators = [
    'ich', 'mein', 'meine', 'mir', 'mich', 'bin', 'heiße', 'mag', 'wohne',
    'i ', 'my ', 'me ', 'am ', 'like ', 'live '
  ];
  
  return personalIndicators.some(indicator => 
    lowerUtterance.includes(indicator)
  );
}

/**
 * Process a conversation turn and extract memories
 * 
 * @param userId - User identifier
 * @param userMessage - User's message
 * @returns Memory evaluation result
 */
export async function processConversationTurn(
  userId: string,
  userMessage: string
): Promise<EvaluationResult> {
  // Focus on user message for memory extraction
  if (!isWorthEvaluating(userMessage)) {
    console.log('📝 Skipping evaluation - utterance not worth processing');
    return {
      saved: [],
      suggestions: [],
      rejected: ['not_worth_evaluating']
    };
  }
  
  return await evaluateAndMaybeStore(userId, userMessage);
}
