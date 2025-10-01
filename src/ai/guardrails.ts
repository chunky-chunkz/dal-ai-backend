/**
 * Minimal guardrails for PII masking and sensitive topic detection
 * Provides pre-processing safety checks before RAG processing
 */

/**
 * PII patterns for masking sensitive information
 */
const PII_PATTERNS = {
  // Email addresses (more specific)
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // IBAN (International Bank Account Number) - handles spaces and various formats
  iban: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){1,7}(?:\s?\d{2})?\b/g,
  
  // Phone numbers (German formats, more specific to avoid conflicts)
  phone: /(?:\+49[\s-]?|0)(?:\(0\)|)\s?[1-9]\d{1,4}[\s-]?\d{6,8}\b/g,
  
  // Credit card numbers (Luhn-like pattern)
  creditCard: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
  
  // German tax ID (exactly 11 digits, standalone)
  taxId: /\b(?<!\d)\d{11}(?!\d)\b/g,
  
  // German social security number (specific pattern)
  socialSecurity: /\b\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}\b/g,
  
  // Bank account numbers (8-12 digits, standalone)
  bankAccount: /\b(?<!\d)\d{8,12}(?!\d)\b/g,
  
  // Postal codes with city names (German format)
  postalCodeWithAddress: /\b\d{5}\s+[A-Za-zäöüÄÖÜß][A-Za-zäöüÄÖÜß\s-]{2,}\b/g
};

/**
 * Sensitive keywords that require special handling
 * These topics should be escalated to human agents
 */
const SENSITIVE_KEYWORDS = [
  // Legal terms
  'recht', 'rechte', 'rechtlich', 'anwalt', 'gericht', 'klage', 'klagen',
  'rechtschutz', 'rechtsberatung', 'abmahnung', 'schadensersatz',
  
  // Cancellation and termination
  'kündigung', 'kündigen', 'beenden', 'vertrag auflösen', 'stornieren',
  'vertrag kündigen', 'abo kündigen', 'widerruf', 'widerrufen',
  
  // Personal data and privacy
  'personendaten', 'datenschutz', 'gdpr', 'dsgvo', 'löschung',
  'daten löschen', 'auskunft', 'datenauskunft', 'privatsphäre',
  
  // Complaints and disputes
  'beschwerde', 'reklamation', 'streit', 'problem', 'unzufrieden',
  'schlichtung', 'ombudsmann', 'verbraucherschutz',
  
  // Billing disputes
  'rechnung falsch', 'falsche abrechnung', 'reklamation rechnung',
  'überhöhte kosten', 'unberechtigte forderung',
  
  // Account security
  'gehackt', 'betrug', 'missbrauch', 'unauthorized', 'identity theft',
  'identitätsdiebstahl', 'phishing', 'verdächtig',
  
  // Financial hardship
  'zahlungsunfähig', 'insolvenz', 'privatinsolvenz', 'überschuldung',
  'kann nicht zahlen', 'arbeitslos', 'arbeitslosigkeit',
  
  // Medical/health (if applicable)
  'notfall', 'medical', 'gesundheit', 'krankheit', 'unfall'
];

/**
 * Mask personally identifiable information in text
 * @param text - Input text that may contain PII
 * @returns Text with PII masked using placeholders
 */
export function maskPII(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let maskedText = text;

  // Process more specific patterns first to avoid conflicts
  
  // Mask IBAN (before phone numbers)
  maskedText = maskedText.replace(PII_PATTERNS.iban, '[IBAN]');

  // Mask credit card numbers
  maskedText = maskedText.replace(PII_PATTERNS.creditCard, '[CARD]');

  // Mask social security numbers (specific pattern)
  maskedText = maskedText.replace(PII_PATTERNS.socialSecurity, '[SSN]');

  // Mask emails
  maskedText = maskedText.replace(PII_PATTERNS.email, '[EMAIL]');

  // Mask phone numbers
  maskedText = maskedText.replace(PII_PATTERNS.phone, '[PHONE]');

  // Mask German tax IDs (11 digits, standalone)
  maskedText = maskedText.replace(PII_PATTERNS.taxId, '[TAX_ID]');

  // Mask postal codes with addresses
  maskedText = maskedText.replace(PII_PATTERNS.postalCodeWithAddress, '[ADDRESS]');

  // Mask bank account numbers last (most general)
  maskedText = maskedText.replace(PII_PATTERNS.bankAccount, '[ACCOUNT]');

  return maskedText;
}

/**
 * Check if text contains sensitive topics that require human handling
 * @param text - Input text to analyze for sensitive content
 * @returns True if text contains sensitive keywords or patterns
 */
export function isSensitive(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const normalizedText = text.toLowerCase();

  // Check for sensitive keywords
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  // Check for combinations that might indicate legal issues
  const legalCombinations = [
    ['vertrag', 'problem'],
    ['rechnung', 'falsch'],
    ['service', 'schlecht'],
    ['kündig', 'grund'],
    ['beschwer', 'manager']
  ];

  for (const [word1, word2] of legalCombinations) {
    if (normalizedText.includes(word1) && normalizedText.includes(word2)) {
      return true;
    }
  }

  return false;
}

/**
 * Get list of detected sensitive keywords in text
 * @param text - Input text to analyze
 * @returns Array of detected sensitive keywords
 */
export function getSensitiveKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const normalizedText = text.toLowerCase();
  const detectedKeywords: string[] = [];

  for (const keyword of SENSITIVE_KEYWORDS) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      detectedKeywords.push(keyword);
    }
  }

  return detectedKeywords;
}

/**
 * Check if text contains PII that was masked
 * @param originalText - Original text
 * @param maskedText - Text after PII masking
 * @returns True if PII was found and masked
 */
export function containsPII(originalText: string, maskedText: string): boolean {
  return originalText !== maskedText;
}

/**
 * Generate a safe response for sensitive topics
 * @param detectedKeywords - List of sensitive keywords found
 * @returns Appropriate response message for escalation
 */
export function getSensitiveTopicResponse(detectedKeywords: string[] = []): {
  answer: string;
  confidence: number;
  requiresHuman: boolean;
} {
  let message: string;

  // Categorize the type of sensitive topic
  const hasLegalKeywords = detectedKeywords.some(k => 
    ['recht', 'anwalt', 'gericht', 'klage'].some(legal => k.includes(legal))
  );
  
  const hasCancellationKeywords = detectedKeywords.some(k => 
    ['kündigung', 'kündigen', 'beenden'].some(cancel => k.includes(cancel))
  );
  
  const hasPrivacyKeywords = detectedKeywords.some(k => 
    ['personendaten', 'datenschutz', 'dsgvo'].some(privacy => k.includes(privacy))
  );

  if (hasLegalKeywords) {
    message = "Ihre Anfrage betrifft rechtliche Aspekte. Für qualifizierte Rechtsberatung verbinde ich Sie gerne mit einem Spezialisten. Soll ich ein Support-Ticket für Sie erstellen?";
  } else if (hasCancellationKeywords) {
    message = "Für Kündigungen und Vertragsänderungen ist unser Kundenservice der richtige Ansprechpartner. Soll ich Sie mit einem Mitarbeiter verbinden oder ein Ticket erstellen?";
  } else if (hasPrivacyKeywords) {
    message = "Datenschutzanfragen werden von unserem spezialisierten Team bearbeitet. Ich leite Ihre Anfrage gerne weiter. Soll ich ein Support-Ticket für Sie erstellen?";
  } else {
    message = "Ihre Anfrage erfordert persönliche Betreuung. Soll ich Sie mit einem Mitarbeiter verbinden oder ein Support-Ticket erstellen?";
  }

  return {
    answer: message,
    confidence: 0.95, // High confidence in escalation decision
    requiresHuman: true
  };
}

/**
 * Apply all guardrails to a question before RAG processing
 * @param question - User's question
 * @returns Processed question and guardrail results
 */
export function applyGuardrails(question: string): {
  maskedQuestion: string;
  isSensitive: boolean;
  containsPII: boolean;
  sensitiveKeywords: string[];
  shouldEscalate: boolean;
} {
  if (!question || typeof question !== 'string') {
    return {
      maskedQuestion: question || '',
      isSensitive: false,
      containsPII: false,
      sensitiveKeywords: [],
      shouldEscalate: false
    };
  }

  // Mask PII first
  const maskedQuestion = maskPII(question);
  const hasPII = containsPII(question, maskedQuestion);

  // Check for sensitive content
  const sensitive = isSensitive(question);
  const sensitiveKeywords = getSensitiveKeywords(question);

  // Determine if escalation is needed
  const shouldEscalate = sensitive || hasPII;

  return {
    maskedQuestion,
    isSensitive: sensitive,
    containsPII: hasPII,
    sensitiveKeywords,
    shouldEscalate
  };
}

/**
 * Get guardrails statistics for monitoring
 */
export function getGuardrailsStats(): {
  piiPatterns: number;
  sensitiveKeywords: number;
  version: string;
} {
  return {
    piiPatterns: Object.keys(PII_PATTERNS).length,
    sensitiveKeywords: SENSITIVE_KEYWORDS.length,
    version: '1.0.0'
  };
}
