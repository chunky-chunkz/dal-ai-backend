/**
 * Memory Fact Extractor
 * 
 * Extracts candidate memory facts from German utterances using LLM with regex fallback.
 */

import { localLLM } from '../ai/localLLM.js';
import { sanitizeUtterance, clampLength, ExtractionRateLimiter } from './guardrails.js';

export interface Candidate {
  person?: string;
  type: "preference" | "profile_fact" | "contact" | "task_hint";
  key: string;
  value: string;
  confidence: number;
}

// Rate limiter for extraction requests
const extractionRateLimiter = new ExtractionRateLimiter();

/**
 * Enhanced system prompt for the LLM to extract memory candidates (strict JSON)
 * UPDATED: More aggressive extraction - prefer saving facts (even borderline ones)
 */
const EXTRACTION_SYSTEM_PROMPT = `Extrahiere aus der deutschen Aussage ALLE langfristig potenziell nützlichen Fakten und Präferenzen.
Sei GROSSZÜGIG bei der Extraktion - lieber mehr speichern als zu wenig. Extrahiere auch implizite Präferenzen und Fakten.
Antworte ausschliesslich als JSON-Array von Objekten mit Feldern:
person, type (preference|profile_fact|contact|task_hint), key, value, confidence (0..1).
Speichere niemals geheime oder sensible Daten. Wenn nichts geeignet ist: [].

WICHTIG: Extrahiere MEHR Fakten - auch wenn sie nur teilweise relevant erscheinen.
- Bei Hobbies, Interessen, Vorlieben: IMMER extrahieren
- Bei Tätigkeiten, Rollen, Teams: IMMER extrahieren  
- Bei Zeitpräferenzen (morgens/abends): IMMER extrahieren
- Bei Tool-/Software-Präferenzen: IMMER extrahieren
- Bei Arbeitsgewohnheiten: IMMER extrahieren

Beispiele:
"Romans Lieblingsfarbe ist blau." ->
[{"person":"roman","type":"preference","key":"lieblingsfarbe","value":"blau","confidence":0.92}]

"Mein Passwort ist abc123" -> []

"Ich heisse Anna." ->
[{"person":"self","type":"profile_fact","key":"name","value":"anna","confidence":0.85}]

"Ich trinke gerne Kaffee am Morgen." ->
[{"person":"self","type":"preference","key":"getränk","value":"kaffee","confidence":0.88},
 {"person":"self","type":"preference","key":"getränk_zeit","value":"kaffee morgens","confidence":0.85}]

"Ich arbeite als Software-Entwickler in Berlin." ->
[{"person":"self","type":"profile_fact","key":"beruf","value":"software-entwickler","confidence":0.90},
 {"person":"self","type":"profile_fact","key":"arbeitsort","value":"berlin","confidence":0.85}]

"Ich mag Python und TypeScript." ->
[{"person":"self","type":"preference","key":"programmiersprache","value":"python","confidence":0.82},
 {"person":"self","type":"preference","key":"programmiersprache_2","value":"typescript","confidence":0.82}]

"Meine Adresse ist Musterstrasse 123." -> []

"Ich mag dunkles Theme." ->
[{"person":"self","type":"preference","key":"ui_theme","value":"dunkel","confidence":0.82}]

"Erinnere mich jeden Freitag an das Meeting." ->
[{"person":"self","type":"task_hint","key":"wöchentliches_meeting","value":"jeden freitag","confidence":0.75}]

"Ich bin im DevOps Team." ->
[{"person":"self","type":"profile_fact","key":"team","value":"devops","confidence":0.85}]

"Ich lese gerne Science Fiction Bücher." ->
[{"person":"self","type":"preference","key":"buch_genre","value":"science fiction","confidence":0.88}]

NIE speichern: Passwörter, TAN, IBAN, Kreditkarten, Ausweis-Nr., Gesundheitsdaten, religiöse/politische Überzeugungen, private Adressen.
IMMER speichern: Harmlose Präferenzen, Hobbies, Berufe, Teams, Rollen, Arbeitszeiten, Tool-Vorlieben.`;


/**
 * Regex patterns for fallback extraction of common German patterns
 */
const FALLBACK_PATTERNS = [
  // Name patterns
  {
    pattern: /(?:ich heiße|mein name ist|ich bin)\s+([a-zA-ZäöüÄÖÜß\s]+)(?:\.|$)/i,
    type: "profile_fact" as const,
    key: "name",
    person: "self",
    confidence: 0.8
  },
  
  // Favorite color
  {
    pattern: /(?:meine\s+)?lieblingsfarbe\s+ist\s+([a-zA-ZäöüÄÖÜß]+)/i,
    type: "preference" as const,
    key: "lieblingsfarbe",
    person: "self",
    confidence: 0.9
  },
  
  // Favorite food
  {
    pattern: /(?:ich\s+)?mag\s+([a-zA-ZäöüÄÖÜß\s]+?)(?:\s+sehr)?\s*(?:gerne|gern|\.|\!|$)/i,
    type: "preference" as const,
    key: "mag",
    person: "self",
    confidence: 0.7
  },
  
  // Location/residence
  {
    pattern: /(?:ich\s+)?wohne\s+in\s+([a-zA-ZäöüÄÖÜß\s]+?)(?:\.|$)/i,
    type: "profile_fact" as const,
    key: "wohnort",
    person: "self",
    confidence: 0.9
  },
  
  // Age
  {
    pattern: /(?:ich\s+bin|bin)\s+(\d+)\s+(?:jahre\s+)?alt/i,
    type: "profile_fact" as const,
    key: "alter",
    person: "self",
    confidence: 0.9
  },
  
  // Email
  {
    pattern: /(?:meine\s+)?(?:e-?mail(?:\s+adresse)?|email)\s+ist\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    type: "contact" as const,
    key: "email",
    person: "self",
    confidence: 0.9
  },
  
  // Phone
  {
    pattern: /(?:meine\s+)?(?:telefonnummer|handynummer|nummer)\s+ist\s+([+\d\s\-\(\)]+)/i,
    type: "contact" as const,
    key: "telefon",
    person: "self",
    confidence: 0.8
  },
  
  // Profession/job
  {
    pattern: /(?:ich\s+bin|ich\s+arbeite\s+als|mein\s+beruf\s+ist)\s+([a-zA-ZäöüÄÖÜß\s]+?)(?:\.|$)/i,
    type: "profile_fact" as const,
    key: "beruf",
    person: "self",
    confidence: 0.8
  },
  
  // Reminder/task
  {
    pattern: /(?:erinnere\s+mich\s+(?:daran,?\s*)?|vergiss\s+nicht,?\s*)(.+?)(?:\.|$)/i,
    type: "task_hint" as const,
    key: "aufgabe",
    confidence: 0.7
  },
  
  // Other person's preference
  {
    pattern: /([a-zA-ZäöüÄÖÜß]+)\s+mag\s+([a-zA-ZäöüÄÖÜß\s]+?)(?:\s+sehr)?\s*(?:gerne|gern|\.|\!|$)/i,
    type: "preference" as const,
    key: "mag",
    confidence: 0.7,
    personFromMatch: true
  }
];

/**
 * Extract candidate memory facts from a German utterance
 * 
 * @param utterance - The German text to analyze
 * @returns Array of memory candidates
 */
export async function extractCandidates(utterance: string, userId?: string): Promise<Candidate[]> {
  // Filter out questions - they should not be stored as memories
  const lowerUtterance = utterance.toLowerCase().trim();
  const questionWords = ['was', 'wie', 'wer', 'wo', 'wann', 'warum', 'welche', 'welcher', 'welches'];
  const hasQuestionWord = questionWords.some(word => lowerUtterance.startsWith(word));
  const hasQuestionMark = lowerUtterance.includes('?');
  
  if (hasQuestionWord || hasQuestionMark) {
    console.log('⚠️ Skipping question - not extracting as memory:', utterance.substring(0, 50));
    return [];
  }
  
  // Apply security guardrails
  if (userId && !extractionRateLimiter.canMakeRequest(userId)) {
    console.warn(`Rate limit exceeded for user ${userId}`);
    throw new Error('Rate limit exceeded. Please wait before making another request.');
  }

  // Record the request if userId provided
  if (userId) {
    extractionRateLimiter.recordRequest(userId);
  }

  // Sanitize and clamp the input before LLM processing
  const sanitizedUtterance = sanitizeUtterance(utterance);
  const clampedUtterance = clampLength(sanitizedUtterance);
  
  if (clampedUtterance !== utterance) {
    console.info('Input was sanitized/clamped for security');
  }

  // First try LLM extraction with sanitized input
  try {
    const llmCandidates = await extractWithLLM(clampedUtterance);
    if (llmCandidates.length > 0) {
      return llmCandidates.map(normalizeCandiate);
    }
  } catch (error) {
    console.warn('LLM extraction failed, falling back to regex:', error);
  }
  
  // Fallback to regex patterns (also use sanitized input)
  return extractWithRegex(clampedUtterance);
}

/**
 * Extract candidates using local LLM
 */
async function extractWithLLM(utterance: string): Promise<Candidate[]> {
  const userPrompt = `Aussage: "${utterance}"`;
  
  // Generate response using local LLM with phi3:mini model
  const response = await localLLM.generate({
    model: process.env.LLM_MODEL || 'phi3:mini',
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.1,
    maxTokens: 500
  });
  
  if (!response?.trim()) {
    return [];
  }
  
  try {
    // Extract JSON from response - it might have extra text before/after
    const trimmed = response.trim();
    
    // Try to find JSON array or object in the response
    let jsonStr = trimmed;
    
    // Look for JSON array
    const arrayMatch = trimmed.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    } else {
      // Look for JSON object
      const objectMatch = trimmed.match(/\{[\s\S]*?\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }
    
    console.log('🔍 Extracted JSON from LLM response:', jsonStr);
    
    // Try to parse the JSON response
    const parsed = JSON.parse(jsonStr);
    
    if (Array.isArray(parsed)) {
      console.log(`✅ Parsed ${parsed.length} candidates from LLM`);
      return parsed.filter(isValidCandidate);
    } else if (isValidCandidate(parsed)) {
      console.log('✅ Parsed 1 candidate from LLM');
      return [parsed];
    }
    
    return [];
  } catch (parseError) {
    console.warn('Failed to parse LLM response as JSON:', response);
    console.warn('Parse error:', parseError instanceof Error ? parseError.message : 'Unknown');
    return [];
  }
}

/**
 * Extract candidates using regex fallback patterns
 */
function extractWithRegex(utterance: string): Candidate[] {
  const candidates: Candidate[] = [];
  const cleanUtterance = utterance.trim();
  
  for (const pattern of FALLBACK_PATTERNS) {
    const match = pattern.pattern.exec(cleanUtterance);
    if (match) {
      const candidate: Candidate = {
        type: pattern.type,
        key: pattern.key,
        value: match[1].trim().toLowerCase(),
        confidence: pattern.confidence
      };
      
      // Set person field if specified
      if (pattern.personFromMatch && match[1]) {
        candidate.person = normalizePersonName(match[0].split(/\s+/)[0]);
      } else if ('person' in pattern) {
        candidate.person = pattern.person;
      }
      
      candidates.push(normalizeCandiate(candidate));
    }
  }
  
  return candidates;
}

/**
 * Validate if an object is a valid candidate
 */
function isValidCandidate(obj: any): obj is Candidate {
  return (
    obj &&
    typeof obj === 'object' &&
    ['preference', 'profile_fact', 'contact', 'task_hint'].includes(obj.type) &&
    typeof obj.key === 'string' &&
    typeof obj.value === 'string' &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 &&
    obj.confidence <= 1 &&
    (obj.person === undefined || typeof obj.person === 'string')
  );
}

/**
 * Normalize a candidate by cleaning up person names and keys
 */
function normalizeCandiate(candidate: Candidate): Candidate {
  const normalized: Candidate = {
    ...candidate,
    key: normalizeKey(candidate.key),
    value: normalizeValue(candidate.value, candidate.type)
  };
  
  if (candidate.person) {
    normalized.person = normalizePersonName(candidate.person);
  }
  
  return normalized;
}

/**
 * Normalize person name to lowercase slug
 */
function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[äöüß]/g, (char) => {
      const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[char] || char;
    })
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Normalize key to lowercase slug
 */
function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/[äöüß]/g, (char) => {
      const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Normalize value based on type
 */
function normalizeValue(value: string, type: string): string {
  const trimmed = value.trim();
  
  switch (type) {
    case 'profile_fact':
    case 'preference':
      return trimmed.toLowerCase();
    
    case 'contact':
      // Keep original case for contact info (emails, phone numbers)
      return trimmed;
    
    case 'task_hint':
      // Keep readable format for tasks
      return trimmed;
    
    default:
      return trimmed.toLowerCase();
  }
}

/**
 * Get extraction statistics for debugging
 */
export function getExtractionStats(utterance: string): {
  utteranceLength: number;
  hasQuestionWords: boolean;
  hasPersonalPronouns: boolean;
  hasTimeReferences: boolean;
} {
  const questionWords = ['was', 'wie', 'wo', 'wann', 'warum', 'wer', 'welche', 'welcher', 'welches'];
  const personalPronouns = ['ich', 'mein', 'meine', 'mir', 'mich'];
  const timeReferences = ['heute', 'morgen', 'gestern', 'jetzt', 'gleich', 'später'];
  
  const lower = utterance.toLowerCase();
  
  return {
    utteranceLength: utterance.length,
    hasQuestionWords: questionWords.some(word => lower.includes(word)),
    hasPersonalPronouns: personalPronouns.some(word => lower.includes(word)),
    hasTimeReferences: timeReferences.some(word => lower.includes(word))
  };
}
