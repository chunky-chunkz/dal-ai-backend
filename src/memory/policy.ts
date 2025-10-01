/**
 * Memory Policy and Risk Classification
 * 
 * Defines what types of memories are allowed, how they should be handled,
 * and provides risk assessment for memory content.
 * 
 * Policy Examples:
 * - Nie speichern: Passwörter, TAN, IBAN, Kreditkarten, Ausweis-Nr., Gesundheitsdaten, religiöse/politische Überzeugungen
 * - Nur mit Consent: echte Adresse, private E-Mail/Telefon, Terminpräferenzen  
 * - Auto-Save: stabile Präferenzen & neutrale Profile-Fakten (Lieblingsfarbe, bevorzugte Sprache, Name, Rolle, Team)
 * - TTL: task_hint läuft nach 30 Tagen ab, wenn nicht genutzt
 */

export interface MemoryPolicy {
  allowedTypes: string[];
  autoSaveTypes: string[];
  askConsentTypes: string[];
  neverSavePatterns: RegExp[];
  sensitiveKeywords: string[];
  bannedContentTypes: string[];
}

/**
 * Enhanced memory policy configuration based on recommendations
 */
export const MEMORY_POLICY: MemoryPolicy = {
  // Types of memories that are allowed to be stored
  allowedTypes: ["preference", "profile_fact", "contact", "task_hint"],
  
  // Auto-Save: stabile Präferenzen & neutrale Profile-Fakten
  autoSaveTypes: ["preference", "profile_fact"],
  
  // Nur mit Consent: echte Adresse, private E-Mail/Telefon, Terminpräferenzen
  askConsentTypes: ["contact", "task_hint"],
  
  // Nie speichern: Patterns that should NEVER be stored
  neverSavePatterns: [
    // Passwörter, TAN, PINs - erweitert für deutsche Formulierungen
    /(?:password|passwd|pwd|pin|tan|token|secret|key|auth|login|passwort|kennwort|geheim)\s*[:=]?\s*\S+/gi,
    /(?:mein|das|sein|ihr)\s+(?:passwort|kennwort|geheimwort)\s+(?:ist|lautet)\s+\S+/gi,
    
    // Kreditkarten (Luhn-validated patterns)
    /\b(?:4\d{3}|5[1-5]\d{2}|6(?:011|5\d{2}))\s?-?\s?\d{4}\s?-?\s?\d{4}\s?-?\s?\d{4}\b/g,
    
    // IBAN numbers
    /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{1,23}\b/g,
    
    // Politische Aussagen
    /(?:ich|wir)\s+(?:wähle|wählen|bin|sind)\s+(?:immer\s+)?(?:die\s+)?(?:cdu|spd|fdp|grüne|afd|linke)/gi,
    
    // Ausweis-Nr., Personalausweis, Reisepass
    /(?:ausweis|personalausweis|reisepass|id)[-\s]*(?:nr|nummer)?\s*[:=]\s*[A-Z0-9]+/gi,
    
    // Private addresses (detailed street addresses)
    /\b\d+\s+[A-Za-zäöüÄÖÜß]+(?:straße|str\.?|gasse|platz|weg|allee)\s*\d*[a-z]?\b/gi,
    
    // Private E-Mail/Telefon (full patterns for rejection)
    /\b[A-Za-z0-9._%+-]+@(?:gmail|yahoo|hotmail|outlook|web|gmx|t-online)\.[A-Za-z]{2,}\b/gi,
    /(?:\+49|0)\s*\d{2,4}[-\s]?\d{3,8}[-\s]?\d{0,8}/g,
    
    // Gesundheitsdaten keywords
    /(?:krankheit|diagnose|medikament|therapie|behandlung|patient|arzt|krankenhaus|blutdruck|diabetes|krebs)/gi,
    
    // Social Security, Tax IDs
    /\b\d{3}-?\d{2}-?\d{4}\b/g,
    /steuer[-\s]*(?:id|nummer)\s*[:=]\s*\d+/gi,
    
    // API keys and sensitive tokens
    /(?:api[_-]?key|access[_-]?token|bearer[_-]?token)\s*[:=]\s*['\"]?[a-zA-Z0-9_-]{20,}['\"]?/gi
  ],

  // Religiöse/politische Überzeugungen - sensitive keywords for rejection
  sensitiveKeywords: [
    // Religiöse Überzeugungen
    "religion", "glaube", "kirchgang", "gebet", "christlich", "muslimisch", "jüdisch", "hindu", "buddhistisch",
    "katholisch", "protestantisch", "orthodox", "atheist", "agnostiker", "glaubensrichtung",
    
    // Politische Überzeugungen  
    "politik", "partei", "wählen", "wahlverhalten", "politische", "rechts", "links", "konservativ", "liberal",
    "sozialdemokratisch", "cdu", "spd", "fdp", "grüne", "afd", "linke", "demonstration", "protest",
    
    // Gesundheitsdaten
    "krankheit", "diagnose", "medikament", "therapie", "behandlung", "patient", "symptom", "allergie",
    "operation", "blutdruck", "diabetes", "depression", "angst", "psychologie", "psychiater"
  ],

  // Content types that are completely banned
  bannedContentTypes: [
    "password", "credentials", "financial_data", "health_data", "government_id", 
    "religious_belief", "political_belief", "private_address", "sensitive_personal"
  ]
};

/**
 * TTL Configuration - task_hint läuft nach 30 Tagen ab
 */
export const TTL_CONFIG = {
  preference: null, // No expiration for stable preferences
  profile_fact: null, // No expiration for profile facts
  contact: "P90D", // 90 days for contact info (ISO 8601 duration)
  task_hint: "P30D" // 30 days for task hints
};

/**
 * Risk levels for memory content
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * Classify the risk level of memory content
 * 
 * @param text - The text content to analyze
 * @param type - The memory type (preference, profile_fact, contact, task_hint)
 * @returns Risk level: low, medium, or high
 */
export function classifyRisk(text: string, type: string): RiskLevel {
  const lowerText = text.toLowerCase();
  
  // High risk: Contains banned patterns
  for (const pattern of MEMORY_POLICY.neverSavePatterns) {
    if (pattern.test(text)) {
      return "high";
    }
  }
  
  // Medium risk: Contains sensitive keywords
  const hasSensitiveContent = MEMORY_POLICY.sensitiveKeywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (hasSensitiveContent) {
    return "medium";
  }
  
  // Medium risk: Contact information (inherently more sensitive)
  if (type === "contact") {
    return "medium";
  }
  
  // Medium risk: Very long content (might contain unintended sensitive data)
  if (text.length > 1000) {
    return "medium";
  }
  
  // Low risk: Everything else
  return "low";
}

/**
 * Get the default TTL (Time To Live) for a memory type
 * 
 * @param type - The memory type
 * @returns TTL duration string (ISO 8601 duration) or null for permanent
 */
export function defaultTTL(type: string): string | null {
  // Use TTL_CONFIG for consistent policy
  switch (type) {
    case "preference":
      return TTL_CONFIG.preference; // null - stable preferences don't expire
    case "profile_fact":
      return TTL_CONFIG.profile_fact; // null - profile facts don't expire
    case "contact":
      return TTL_CONFIG.contact; // P90D - contact info expires after 90 days
    case "task_hint":
      return TTL_CONFIG.task_hint; // P30D - task hints expire after 30 days
    default:
      return "P30D"; // Default 30 days for unknown types
  }
}

/**
 * Check if a memory type is allowed
 */
export function isAllowedType(type: string): boolean {
  return MEMORY_POLICY.allowedTypes.includes(type);
}

/**
 * Check if a memory type requires user consent
 */
export function requiresConsent(type: string): boolean {
  return MEMORY_POLICY.askConsentTypes.includes(type);
}

/**
 * Check if a memory type can be auto-saved
 */
export function canAutoSave(type: string): boolean {
  return MEMORY_POLICY.autoSaveTypes.includes(type);
}

/**
 * Sanitize text by removing or masking banned patterns
 * 
 * @param text - Text to sanitize
 * @returns Sanitized text with sensitive data masked
 */
export function sanitizeText(text: string): string {
  let sanitized = text;
  
  // Mask email addresses (keep domain for context)
  sanitized = sanitized.replace(
    /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
    '***@$2'
  );
  
  // Remove other banned patterns completely
  for (const pattern of MEMORY_POLICY.neverSavePatterns) {
    // Apply all patterns for sanitization
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  return sanitized;
}
