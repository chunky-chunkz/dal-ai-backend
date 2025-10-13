/**
 * Text Utilities for Memory Processing
 * 
 * Advanced text similarity, normalization, and processing utilities
 * optimized for German language processing.
 */

/**
 * Calculate similarity between two strings using trigram analysis
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  const trigrams1 = getTrigrams(str1);
  const trigrams2 = getTrigrams(str2);
  
  if (trigrams1.size === 0 && trigrams2.size === 0) return 1.0;
  if (trigrams1.size === 0 || trigrams2.size === 0) return 0.0;
  
  const intersection = new Set([...trigrams1].filter(x => trigrams2.has(x)));
  const union = new Set([...trigrams1, ...trigrams2]);
  
  return intersection.size / union.size;
}

/**
 * Get trigrams from a string
 */
function getTrigrams(str: string): Set<string> {
  const trigrams = new Set<string>();
  const normalized = str.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Add padding for better boundary detection
  const padded = `  ${normalized}  `;
  
  for (let i = 0; i <= padded.length - 3; i++) {
    trigrams.add(padded.substring(i, i + 3));
  }
  
  return trigrams;
}

/**
 * Normalize German text for better comparison
 */
export function normalizeGermanText(text: string): string {
  let normalized = text.toLowerCase().trim();
  
  // Handle German umlauts and special characters
  const germanReplacements: [string, string][] = [
    ['ä', 'ae'],
    ['ö', 'oe'],
    ['ü', 'ue'],
    ['ß', 'ss']
  ];
  
  for (const [from, to] of germanReplacements) {
    normalized = normalized.replace(new RegExp(from, 'g'), to);
  }
  
  // Remove extra whitespace and punctuation
  normalized = normalized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  // Handle common German word variations
  const variations: [RegExp, string][] = [
    [/\b(ein|eine|einer)\b/g, ''],
    [/\b(der|die|das)\b/g, ''],
    [/\b(und|oder|aber)\b/g, ''],
    [/\b(sehr|ganz|ziemlich)\b/g, ''],
    [/\bgerne?\b/g, ''],
    [/\bimmer\b/g, 'always'],
    [/\bnie\b/g, 'never']
  ];
  
  for (const [pattern, replacement] of variations) {
    normalized = normalized.replace(pattern, replacement);
  }
  
  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Extract semantic keywords from German text
 */
export function extractSemanticKeywords(text: string): string[] {
  const normalized = normalizeGermanText(text);
  const words = normalized.split(' ').filter(w => w.length > 2);
  
  // Remove common German stopwords
  const stopwords = new Set([
    'der', 'die', 'das', 'und', 'oder', 'aber', 'ich', 'du', 'er', 'sie', 'es',
    'wir', 'ihr', 'bin', 'bist', 'ist', 'sind', 'war', 'waren', 'hat', 'haben',
    'mit', 'von', 'zu', 'auf', 'fuer', 'durch', 'ueber', 'unter', 'vor', 'nach',
    'bei', 'seit', 'bis', 'ohne', 'gegen', 'trotz', 'waehrend', 'wegen'
  ]);
  
  return words.filter(word => !stopwords.has(word) && word.length > 1);
}
/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate semantic similarity using multiple methods
 */
export function semanticSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeGermanText(str1);
  const normalized2 = normalizeGermanText(str2);
  
  // Exact match
  if (normalized1 === normalized2) return 1.0;
  
  // Trigram similarity (primary method)
  const trigramSim = calculateSimilarity(normalized1, normalized2);
  
  // Keyword overlap
  const keywords1 = new Set(extractSemanticKeywords(str1));
  const keywords2 = new Set(extractSemanticKeywords(str2));
  const keywordIntersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const keywordUnion = new Set([...keywords1, ...keywords2]);
  const keywordSim = keywordUnion.size > 0 ? keywordIntersection.size / keywordUnion.size : 0;
  
  // Levenshtein-based similarity for short strings
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const levDistance = levenshteinDistance(normalized1, normalized2);
  const levSim = maxLength > 0 ? 1 - (levDistance / maxLength) : 0;
  
  // Weighted combination
  return (trigramSim * 0.5) + (keywordSim * 0.3) + (levSim * 0.2);
}

/**
 * Detect if text contains temporal indicators (time-sensitive information)
 */
export function detectTemporal(text: string): {
  isTemporal: boolean;
  temporalType?: 'absolute' | 'relative' | 'recurring';
  confidence: number;
} {
  const normalized = text.toLowerCase();
  
  // Absolute time indicators
  const absolutePatterns = [
    /\b\d{1,2}\.\d{1,2}\.\d{4}\b/, // dates
    /\b\d{1,2}:\d{2}\b/, // times
    /\b(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/,
    /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/
  ];
  
  // Relative time indicators
  const relativePatterns = [
    /\b(heute|gestern|morgen|übermorgen|vorgestern)\b/,
    /\b(jetzt|gerade|momentan|derzeit|aktuell)\b/,
    /\b(vor|nach|seit|bis)\s+\d+\s+(minuten?|stunden?|tagen?|wochen?|monaten?|jahren?)\b/
  ];
  
  // Recurring time indicators
  const recurringPatterns = [
    /\b(täglich|wöchentlich|monatlich|jährlich)\b/,
    /\b(jeden?|jede|jedes)\s+(tag|woche|monat|jahr)\b/,
    /\b(immer|nie|niemals|oft|manchmal|selten)\b/
  ];
  
  let temporalType: 'absolute' | 'relative' | 'recurring' | undefined;
  let confidence = 0;
  
  if (absolutePatterns.some(p => p.test(normalized))) {
    temporalType = 'absolute';
    confidence = 0.9;
  } else if (relativePatterns.some(p => p.test(normalized))) {
    temporalType = 'relative';
    confidence = 0.8;
  } else if (recurringPatterns.some(p => p.test(normalized))) {
    temporalType = 'recurring';
    confidence = 0.7;
  }
  
  return {
    isTemporal: confidence > 0,
    temporalType,
    confidence
  };
}

/**
 * Extract named entities from German text (simplified)
 */
export function extractNamedEntities(text: string): {
  names: string[];
  locations: string[];
  organizations: string[];
} {
  const entities = {
    names: [] as string[],
    locations: [] as string[],
    organizations: [] as string[]
  };
  
  // German name patterns (simplified)
  const namePattern = /\b([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)\b/g;
  const nameMatches = text.match(namePattern) || [];
  
  // German city/location indicators
  const locationKeywords = ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig'];
  const locationPattern = new RegExp(`\\b(${locationKeywords.join('|')})\\b`, 'gi');
  const locationMatches = text.match(locationPattern) || [];
  
  // Organization indicators
  const orgKeywords = ['GmbH', 'AG', 'KG', 'UG', 'e.V.', 'GbR'];
  const orgPattern = new RegExp(`\\b[A-ZÄÖÜ][a-zäöüß\\s]+(?:${orgKeywords.join('|')})\\b`, 'gi');
  const orgMatches = text.match(orgPattern) || [];
  
  entities.names = [...new Set(nameMatches.filter(name => 
    !locationKeywords.includes(name) && name.length > 2
  ))];
  
  entities.locations = [...new Set(locationMatches)];
  entities.organizations = [...new Set(orgMatches)];
  
  return entities;
}

/**
 * Detect sentiment in German text (basic implementation)
 */
export function detectSentiment(text: string): {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
} {
  const normalized = normalizeGermanText(text);
  
  const positiveWords = [
    'gut', 'toll', 'super', 'fantastisch', 'wunderbar', 'schön', 'liebe', 'mag',
    'gefällt', 'freue', 'glücklich', 'zufrieden', 'perfekt', 'ausgezeichnet'
  ];
  
  const negativeWords = [
    'schlecht', 'schlimm', 'furchtbar', 'schrecklich', 'hasse', 'mag nicht',
    'gefällt nicht', 'traurig', 'wütend', 'ärgerlich', 'enttäuscht', 'frustriert'
  ];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of positiveWords) {
    if (normalized.includes(word)) {
      positiveCount++;
    }
  }
  
  for (const word of negativeWords) {
    if (normalized.includes(word)) {
      negativeCount++;
    }
  }
  
  const total = positiveCount + negativeCount;
  if (total === 0) {
    return { sentiment: 'neutral', confidence: 0.5 };
  }
  
  const positiveRatio = positiveCount / total;
  
  if (positiveRatio > 0.6) {
    return { sentiment: 'positive', confidence: positiveRatio };
  } else if (positiveRatio < 0.4) {
    return { sentiment: 'negative', confidence: 1 - positiveRatio };
  } else {
    return { sentiment: 'neutral', confidence: 0.5 };
  }
}
