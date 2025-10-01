/**
 * PII (Personally Identifiable Information) Detection and Masking
 * 
 * Provides utilities to detect and mask sensitive personal information
 * in text content with performance-optimized regex patterns.
 */

export interface PIIMatch {
  kind: "email" | "phone" | "iban" | "card" | "ssn" | "passport";
  value: string;
  start: number;
  end: number;
}

export interface PIIDetectionResult {
  hasPII: boolean;
  matches: PIIMatch[];
}

/**
 * Comprehensive regex patterns for PII detection
 */
const PII_PATTERNS = {
  // Email addresses - RFC 5322 compliant but simplified for performance
  email: /\b[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/g,
  
  // Phone numbers - international and domestic formats
  phone: /(?:\+\d{1,3}[-.\s]?)?\(?(?:\d{3})\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:\+\d{1,3}[-.\s]?)?\(?(?:\d{2,4})\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
  
  // IBAN - International Bank Account Number
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{1,23}\b/g,
  
  // Credit card numbers - simplified pattern to catch common formats
  card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  
  // Social Security Numbers (US format)
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  
  // Passport numbers (basic pattern for common formats)
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g
};

/**
 * Masking templates for different PII types
 */
const MASKING_TEMPLATES = {
  email: () => '[EMAIL]',
  phone: () => '[PHONE]',
  iban: () => '[IBAN]',
  card: () => '[CARD]',
  ssn: () => '[SSN]',
  passport: () => '[PASSPORT]'
};

/**
 * Detect PII in the given text
 * 
 * @param text - Text to analyze for PII
 * @returns Detection result with matches and their locations
 */
export function detectPII(text: string): PIIDetectionResult {
  const matches: PIIMatch[] = [];
  
  // Process each PII pattern type
  for (const [kind, pattern] of Object.entries(PII_PATTERNS)) {
    // Reset regex state for each iteration
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Validate the match based on type-specific rules
      if (isValidPIIMatch(kind as keyof typeof PII_PATTERNS, match[0])) {
        matches.push({
          kind: kind as PIIMatch['kind'],
          value: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      // Prevent infinite loops on zero-length matches
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  }
  
  // Sort matches by position in text
  matches.sort((a, b) => a.start - b.start);
  
  return {
    hasPII: matches.length > 0,
    matches
  };
}

/**
 * Mask PII in the given text with placeholders
 * 
 * @param text - Text to mask PII in
 * @returns Text with PII replaced by placeholders
 */
export function maskPII(text: string): string {
  const detection = detectPII(text);
  
  if (!detection.hasPII) {
    return text;
  }

  let result = text;
  
  // Process matches in reverse order to maintain correct indices
  for (let i = detection.matches.length - 1; i >= 0; i--) {
    const match = detection.matches[i];
    const maskTemplate = MASKING_TEMPLATES[match.kind];
    const masked = maskTemplate();
    
    result = result.substring(0, match.start) + masked + result.substring(match.end);
  }
  
  return result;
}

/**
 * Validate if a regex match is actually valid PII
 * 
 * @param kind - Type of PII being validated
 * @param value - The matched value
 * @returns True if the match is valid PII
 */
function isValidPIIMatch(kind: keyof typeof PII_PATTERNS, value: string): boolean {
  switch (kind) {
    case 'email':
      return isValidEmail(value);
    
    case 'phone':
      return isValidPhone(value);
    
    case 'iban':
      return isValidIBAN(value);
    
    case 'card':
      return isValidCreditCard(value);
    
    case 'ssn':
      return isValidSSN(value);
    
    case 'passport':
      return isValidPassport(value);
    
    default:
      return true;
  }
}

/**
 * Validate email address structure
 */
function isValidEmail(email: string): boolean {
  // Basic validation - has @ symbol and valid domain structure
  const parts = email.split('@');
  return parts.length === 2 && 
         parts[0].length > 0 && 
         parts[1].includes('.') && 
         parts[1].length > 3;
}

/**
 * Validate phone number format
 */
function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Valid phone numbers have 7-15 digits (international standard)
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Validate IBAN format
 */
function isValidIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  
  // Basic structure validation: 2 letters + 2 digits + alphanumeric
  return /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned) && 
         cleaned.length >= 15 && 
         cleaned.length <= 34;
}

/**
 * Validate credit card number using Luhn algorithm
 */
function isValidCreditCard(card: string): boolean {
  // Remove all non-digit characters
  const digits = card.replace(/\D/g, '');
  
  // Must be 13-19 digits
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  
  // Luhn algorithm validation
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Validate Social Security Number format
 */
function isValidSSN(ssn: string): boolean {
  const digits = ssn.replace(/\D/g, '');
  
  // Must be exactly 9 digits
  if (digits.length !== 9) {
    return false;
  }
  
  // Invalid SSN patterns
  const invalidPatterns = [
    '000000000',
    '111111111',
    '222222222',
    '333333333',
    '444444444',
    '555555555',
    '666666666',
    '777777777',
    '888888888',
    '999999999'
  ];
  
  return !invalidPatterns.includes(digits);
}

/**
 * Validate passport number format
 */
function isValidPassport(passport: string): boolean {
  // Remove spaces and convert to uppercase
  const cleaned = passport.replace(/\s/g, '').toUpperCase();
  
  // Basic validation: must be 6-9 characters, starting with 1-2 letters
  return /^[A-Z]{1,2}\d{6,8}$/.test(cleaned);
}

/**
 * Get PII statistics for a text
 * 
 * @param text - Text to analyze
 * @returns Statistics about PII found in the text
 */
export function getPIIStats(text: string): Record<PIIMatch['kind'], number> {
  const detection = detectPII(text);
  const stats: Record<PIIMatch['kind'], number> = {
    email: 0,
    phone: 0,
    iban: 0,
    card: 0,
    ssn: 0,
    passport: 0
  };
  
  for (const match of detection.matches) {
    stats[match.kind]++;
  }
  
  return stats;
}

/**
 * Check if text contains any PII (quick check without detailed matches)
 * 
 * @param text - Text to check
 * @returns True if any PII is detected
 */
export function hasPII(text: string): boolean {
  // Quick check using combined regex for performance
  const quickPattern = /\b[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b|\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{1,23}\b|\b(?:4\d{3}|5[1-5]\d{2}|6(?:011|5\d{2})|3[47]\d{2})(?:[-\s]?\d{4}){3}\b/g;
  
  return quickPattern.test(text);
}
