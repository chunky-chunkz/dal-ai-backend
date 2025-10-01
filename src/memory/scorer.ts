/**
 * Memory Worthiness Scorer
 * 
 * Evaluates how worthy a memory candidate is for storage based on
 * specificity, stability, novelty, and other quality factors.
 */

import type { Candidate } from './extractor.js';

export interface MemoryItem {
  id: string;
  person?: string;
  type: string;
  key: string;
  value: string;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoringFactors {
  specificity: number;
  stability: number;
  novelty: number;
  interrogative: number;
  ephemeral: number;
  finalScore: number;
}

/**
 * Score a memory candidate for worthiness (0.0 - 1.0)
 * 
 * @param candidate - The memory candidate to score
 * @param existing - Existing memory items to check for duplicates
 * @returns Score from 0.0 (not worthy) to 1.0 (highly worthy)
 */
export function scoreCandidate(
  candidate: Candidate, 
  existing: MemoryItem[] = []
): number {
  const factors = calculateScoringFactors(candidate, existing);
  return factors.finalScore;
}

/**
 * Calculate detailed scoring factors for analysis
 * 
 * @param candidate - The memory candidate to analyze
 * @param existing - Existing memory items to check for duplicates
 * @returns Detailed scoring breakdown
 */
export function calculateScoringFactors(
  candidate: Candidate,
  existing: MemoryItem[] = []
): ScoringFactors {
  const specificityScore = calculateSpecificity(candidate);
  const stabilityScore = calculateStability(candidate);
  const noveltyScore = calculateNovelty(candidate, existing);
  const interrogativeScore = calculateInterrogativePenalty(candidate);
  const ephemeralScore = calculateEphemeralPenalty(candidate);
  
  // Weighted final score
  const finalScore = Math.max(0, Math.min(1, 
    (specificityScore * 0.25) +
    (stabilityScore * 0.25) +
    (noveltyScore * 0.25) +
    (candidate.confidence * 0.15) +
    (interrogativeScore * 0.05) +
    (ephemeralScore * 0.05)
  ));
  
  return {
    specificity: specificityScore,
    stability: stabilityScore,
    novelty: noveltyScore,
    interrogative: interrogativeScore,
    ephemeral: ephemeralScore,
    finalScore
  };
}

/**
 * Calculate specificity score based on value characteristics
 * Rewards meaningful, specific information over generic terms
 */
function calculateSpecificity(candidate: Candidate): number {
  const value = candidate.value.toLowerCase().trim();
  const valueLength = value.length;
  
  // Length scoring: sweet spot is 2-40 characters
  let lengthScore = 0;
  if (valueLength >= 2 && valueLength <= 40) {
    // Optimal range gets full score
    lengthScore = 1.0;
  } else if (valueLength > 40 && valueLength <= 100) {
    // Longer values get reduced score
    lengthScore = 0.7;
  } else if (valueLength > 100) {
    // Very long values might be too verbose
    lengthScore = 0.4;
  } else {
    // Too short (< 2 chars) gets low score
    lengthScore = 0.2;
  }
  
  // Generic word penalty
  const genericWords = [
    'ja', 'nein', 'okay', 'ok', 'gut', 'schlecht', 'normal', 'schön',
    'toll', 'super', 'nichts', 'alles', 'etwas', 'viel', 'wenig',
    'groß', 'klein', 'neu', 'alt', 'wichtig', 'unwichtig',
    'yes', 'no', 'good', 'bad', 'nice', 'great', 'nothing', 'everything'
  ];
  
  const isGeneric = genericWords.includes(value);
  const genericPenalty = isGeneric ? 0.3 : 1.0;
  
  // Proper noun bonus (capitalized words often indicate specific entities)
  const hasProperNoun = /\b[A-ZÄÖÜ][a-zäöüß]+/.test(candidate.value);
  const properNounBonus = hasProperNoun ? 1.2 : 1.0;
  
  // Number/identifier bonus (specific data like ages, addresses)
  const hasSpecificData = /\d+|@|\+49|\.de$|\.com$/.test(value);
  const specificDataBonus = hasSpecificData ? 1.1 : 1.0;
  
  return Math.min(1.0, lengthScore * genericPenalty * properNounBonus * specificDataBonus);
}

/**
 * Calculate stability score based on keywords indicating long-term facts
 */
function calculateStability(candidate: Candidate): number {
  const text = `${candidate.key} ${candidate.value}`.toLowerCase();
  
  // Strong stability indicators
  const strongStabilityKeywords = [
    'immer', 'meistens', 'ist', 'heißt', 'lieblings', 'favorite',
    'geboren', 'name', 'adresse', 'wohnt', 'arbeitet', 'studiert',
    'verheiratet', 'ledig', 'mag', 'hasst', 'präferiert'
  ];
  
  // Medium stability indicators
  const mediumStabilityKeywords = [
    'normalerweise', 'gewöhnlich', 'oft', 'selten', 'manchmal',
    'usually', 'often', 'rarely', 'sometimes'
  ];
  
  // Instability indicators (reduce score)
  const instabilityKeywords = [
    'heute', 'morgen', 'gestern', 'gerade', 'gleich', 'sofort',
    'bald', 'später', 'momentan', 'zurzeit', 'aktuell',
    'today', 'tomorrow', 'yesterday', 'now', 'soon', 'currently'
  ];
  
  let stabilityScore = 0.5; // Base score
  
  // Check for strong stability
  for (const keyword of strongStabilityKeywords) {
    if (text.includes(keyword)) {
      stabilityScore += 0.3;
      break; // Only one bonus per category
    }
  }
  
  // Check for medium stability
  for (const keyword of mediumStabilityKeywords) {
    if (text.includes(keyword)) {
      stabilityScore += 0.2;
      break;
    }
  }
  
  // Check for instability (penalty)
  for (const keyword of instabilityKeywords) {
    if (text.includes(keyword)) {
      stabilityScore -= 0.4;
      break;
    }
  }
  
  // Type-based stability adjustments
  switch (candidate.type) {
    case 'profile_fact':
      stabilityScore += 0.2; // Profile facts are inherently stable
      break;
    case 'preference':
      stabilityScore += 0.1; // Preferences are fairly stable
      break;
    case 'task_hint':
      stabilityScore -= 0.1; // Tasks are often temporary
      break;
  }
  
  return Math.max(0, Math.min(1, stabilityScore));
}

/**
 * Calculate novelty score by checking against existing memories
 */
function calculateNovelty(candidate: Candidate, existing: MemoryItem[]): number {
  if (!existing || existing.length === 0) {
    return 1.0; // Full novelty if no existing memories
  }
  
  // Find similar memories (same person, type, and key)
  const similarMemories = existing.filter(item => 
    item.person === candidate.person &&
    item.type === candidate.type &&
    item.key === candidate.key
  );
  
  if (similarMemories.length === 0) {
    return 1.0; // Completely novel
  }
  
  // Calculate similarity using trigram overlap
  const candidateValue = candidate.value.toLowerCase();
  let maxSimilarity = 0;
  
  for (const memory of similarMemories) {
    const memoryValue = memory.value.toLowerCase();
    const similarity = calculateTrigramSimilarity(candidateValue, memoryValue);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  // Convert similarity to novelty score (inverse relationship)
  return 1.0 - maxSimilarity;
}

/**
 * Calculate trigram similarity between two strings
 */
function calculateTrigramSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length < 3 && str2.length < 3) {
    return str1 === str2 ? 1.0 : 0.0;
  }
  
  const trigrams1 = extractTrigrams(str1);
  const trigrams2 = extractTrigrams(str2);
  
  if (trigrams1.size === 0 && trigrams2.size === 0) return 1.0;
  if (trigrams1.size === 0 || trigrams2.size === 0) return 0.0;
  
  const intersection = new Set([...trigrams1].filter(x => trigrams2.has(x)));
  const union = new Set([...trigrams1, ...trigrams2]);
  
  return intersection.size / union.size;
}

/**
 * Extract trigrams from a string
 */
function extractTrigrams(str: string): Set<string> {
  const trigrams = new Set<string>();
  const padded = `  ${str}  `; // Pad with spaces
  
  for (let i = 0; i <= padded.length - 3; i++) {
    trigrams.add(padded.substring(i, i + 3));
  }
  
  return trigrams;
}

/**
 * Calculate penalty for interrogative statements
 */
function calculateInterrogativePenalty(candidate: Candidate): number {
  const value = candidate.value.trim();
  const key = candidate.key.trim();
  
  // Check if value or key ends with question mark
  const hasQuestionMark = value.endsWith('?') || key.endsWith('?');
  
  // Check for interrogative words
  const interrogativeWords = [
    'was', 'wie', 'wo', 'wann', 'warum', 'wer', 'welche', 'welcher', 'welches',
    'what', 'how', 'where', 'when', 'why', 'who', 'which'
  ];
  
  const text = `${key} ${value}`.toLowerCase();
  const hasInterrogativeWords = interrogativeWords.some(word => 
    text.includes(word)
  );
  
  if (hasQuestionMark || hasInterrogativeWords) {
    return 0.2; // Strong penalty for questions
  }
  
  return 1.0; // No penalty
}

/**
 * Calculate penalty for ephemeral time references
 */
function calculateEphemeralPenalty(candidate: Candidate): number {
  const text = `${candidate.key} ${candidate.value}`.toLowerCase();
  
  // Ephemeral time indicators
  const ephemeralPatterns = [
    // German
    /\b(heute|morgen|gestern|gleich|sofort|bald|gerade|jetzt)\b/,
    /\bin\s+\d+\s+(min|minuten|stunden|stunde|sekunden)\b/,
    /\bum\s+\d{1,2}:\d{2}\b/, // "um 14:30"
    /\bnächste\s+(woche|monat)\b/,
    
    // English  
    /\b(today|tomorrow|yesterday|now|soon|immediately|right\s+now)\b/,
    /\bin\s+\d+\s+(min|minutes|hours|seconds)\b/,
    /\bat\s+\d{1,2}:\d{2}\b/, // "at 2:30"
    /\bnext\s+(week|month)\b/,
    
    // Dates
    /\b\d{1,2}\.\d{1,2}\.\d{4}\b/, // "25.12.2023"
    /\b\d{4}-\d{2}-\d{2}\b/, // "2023-12-25"
  ];
  
  for (const pattern of ephemeralPatterns) {
    if (pattern.test(text)) {
      return 0.3; // Penalty for ephemeral content
    }
  }
  
  return 1.0; // No penalty
}

/**
 * Get recommended action based on score
 */
export function getRecommendedAction(score: number): 'auto' | 'ask' | 'reject' {
  if (score >= 0.75) return 'auto';
  if (score >= 0.5) return 'ask';
  return 'reject';
}

/**
 * Batch score multiple candidates and sort by worthiness
 */
export function scoreCandidates(
  candidates: Candidate[],
  existing: MemoryItem[] = []
): Array<Candidate & { score: number; action: 'auto' | 'ask' | 'reject' }> {
  return candidates
    .map(candidate => ({
      ...candidate,
      score: scoreCandidate(candidate, existing),
      action: getRecommendedAction(scoreCandidate(candidate, existing))
    }))
    .sort((a, b) => b.score - a.score); // Sort by score descending
}
