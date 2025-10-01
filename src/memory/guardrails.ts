/**
 * Memory Extraction Guardrails
 * 
 * Provides security measures to protect against prompt injection attacks
 * and ensure safe input processing for LLM-based memory extraction.
 */

/**
 * Dangerous patterns that could be used for prompt injection attacks
 */
const DANGEROUS_PATTERNS = [
  // Direct instruction attempts
  /ignore\s+(previous|all|above|earlier|prior)\s+(instructions?|prompts?|commands?|rules?)/gi,
  /forget\s+(previous|all|above|earlier|prior)\s+(instructions?|prompts?|commands?|rules?)/gi,
  /disregard\s+(previous|all|above|earlier|prior)\s+(instructions?|prompts?|commands?|rules?)/gi,
  
  // System message manipulation
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
  /user\s*:\s*/gi,
  /human\s*:\s*/gi,
  /ai\s*:\s*/gi,
  
  // Role playing attempts
  /you\s+are\s+(now|a|an)\s+/gi,
  /pretend\s+(to\s+be|you\s+are)/gi,
  /act\s+as\s+(a|an)\s+/gi,
  /roleplay\s+as/gi,
  /assume\s+the\s+role/gi,
  
  // Instruction override attempts
  /new\s+instructions?\s*:/gi,
  /updated?\s+instructions?\s*:/gi,
  /instead\s+of\s+/gi,
  /rather\s+than\s+/gi,
  /don't\s+(extract|remember|store|save)/gi,
  /do\s+not\s+(extract|remember|store|save)/gi,
  
  // Output manipulation
  /respond\s+with\s+(only|just)/gi,
  /output\s+(only|just)/gi,
  /return\s+(only|just)/gi,
  /print\s+(only|just)/gi,
  /say\s+(only|just)/gi,
  
  // JSON/format manipulation
  /```json/gi,
  /```/g,
  /\[\s*\]/g, // Empty JSON arrays
  /\{\s*\}/g, // Empty JSON objects
  
  // System escape attempts
  /\\n|\\r|\\t/g,
  /<script/gi,
  /<\/script>/gi,
  /javascript:/gi,
  /data:/gi,
  
  // German equivalents
  /ignoriere\s+(vorherige|alle|obige|frühere)\s+(anweisungen?|befehle?|regeln?)/gi,
  /vergiss\s+(vorherige|alle|obige|frühere)\s+(anweisungen?|befehle?|regeln?)/gi,
  /missachte\s+(vorherige|alle|obige|frühere)\s+(anweisungen?|befehle?|regeln?)/gi,
  /neue\s+anweisungen?\s*:/gi,
  /aktualisierte?\s+anweisungen?\s*:/gi,
  /stattdessen\s+/gi,
  /anstatt\s+/gi,
  /du\s+bist\s+(jetzt|ein|eine)\s+/gi,
  /tue\s+so\s+als\s+(ob|wärst)/gi,
  /verhalte\s+dich\s+wie/gi,
  /antworte\s+(nur|ausschließlich)\s+mit/gi,
  /gib\s+(nur|ausschließlich)\s+/gi,
];

/**
 * Suspicious keywords that should be monitored but not necessarily blocked
 */
const SUSPICIOUS_KEYWORDS = [
  // Command-like words
  'execute', 'run', 'eval', 'compile', 'process',
  'ausführen', 'laufen', 'verarbeiten',
  
  // System references
  'admin', 'administrator', 'root', 'sudo', 'system',
  'administrator', 'verwaltung', 'berechtigung',
  
  // Instruction words
  'command', 'instruction', 'directive', 'rule',
  'befehl', 'anweisung', 'regel', 'direktive',
  
  // Override words
  'override', 'bypass', 'skip', 'avoid',
  'überschreiben', 'umgehen', 'überspringen',
];

/**
 * Sanitize utterance by removing or neutralizing dangerous patterns
 * 
 * @param text - The input text to sanitize
 * @returns Sanitized text safe for LLM processing
 */
export function sanitizeUtterance(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let sanitized = text.trim();
  
  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Remove excessive punctuation that could be used for injection
  sanitized = sanitized.replace(/[!?]{3,}/g, '!!');
  sanitized = sanitized.replace(/[.]{3,}/g, '...');
  
  // Remove potential encoding attacks
  sanitized = sanitized.replace(/%[0-9a-fA-F]{2}/g, '');
  sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, '');
  sanitized = sanitized.replace(/\\x[0-9a-fA-F]{2}/g, '');
  
  // Remove potential XSS patterns
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Limit consecutive special characters
  sanitized = sanitized.replace(/[^\w\s]{3,}/g, (match) => match.substring(0, 2));
  
  return sanitized;
}

/**
 * Clamp text length to prevent token limit issues and potential abuse
 * 
 * @param text - The input text to clamp
 * @param max - Maximum allowed length (default: 800 characters)
 * @returns Text clamped to maximum length
 */
export function clampLength(text: string, max: number = 800): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= max) {
    return text;
  }
  
  // Try to break at word boundary near the limit
  const truncated = text.substring(0, max);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > max * 0.8) {
    // If we can find a good word boundary, use it
    return truncated.substring(0, lastSpace).trim() + '...';
  } else {
    // Otherwise, hard truncate
    return truncated.trim() + '...';
  }
}

/**
 * Check if text contains suspicious patterns
 * 
 * @param text - Text to analyze
 * @returns Analysis result with risk indicators
 */
export function analyzeSuspiciousContent(text: string): {
  hasDangerousPatterns: boolean;
  hasSuspiciousKeywords: boolean;
  suspiciousMatches: string[];
  riskLevel: 'low' | 'medium' | 'high';
} {
  const lowerText = text.toLowerCase();
  const suspiciousMatches: string[] = [];
  
  // Check for dangerous patterns
  let hasDangerousPatterns = false;
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      hasDangerousPatterns = true;
      break;
    }
  }
  
  // Check for suspicious keywords
  let hasSuspiciousKeywords = false;
  for (const keyword of SUSPICIOUS_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      hasSuspiciousKeywords = true;
      suspiciousMatches.push(keyword);
    }
  }
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  if (hasDangerousPatterns) {
    riskLevel = 'high';
  } else if (hasSuspiciousKeywords) {
    riskLevel = suspiciousMatches.length > 2 ? 'medium' : 'low';
  }
  
  return {
    hasDangerousPatterns,
    hasSuspiciousKeywords,
    suspiciousMatches,
    riskLevel
  };
}

/**
 * Comprehensive input validation and sanitization for memory extraction
 * 
 * @param text - Raw input text
 * @param maxLength - Maximum allowed length
 * @returns Sanitized and validated text with metadata
 */
export function validateAndSanitizeInput(
  text: string, 
  maxLength: number = 800
): {
  sanitized: string;
  originalLength: number;
  finalLength: number;
  wasClamped: boolean;
  wasSanitized: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
} {
  const originalLength = text?.length || 0;
  const warnings: string[] = [];
  
  // Initial validation
  if (!text || typeof text !== 'string') {
    return {
      sanitized: '',
      originalLength: 0,
      finalLength: 0,
      wasClamped: false,
      wasSanitized: false,
      riskLevel: 'low',
      warnings: ['Invalid input: not a string']
    };
  }
  
  // Check for minimum length
  if (text.trim().length < 3) {
    warnings.push('Input too short (minimum 3 characters)');
  }
  
  // Analyze suspicious content before sanitization
  const analysis = analyzeSuspiciousContent(text);
  
  if (analysis.hasDangerousPatterns) {
    warnings.push('Dangerous patterns detected and filtered');
  }
  
  if (analysis.hasSuspiciousKeywords) {
    warnings.push(`Suspicious keywords detected: ${analysis.suspiciousMatches.join(', ')}`);
  }
  
  // Sanitize the text
  const sanitized = sanitizeUtterance(text);
  const wasSanitized = sanitized !== text;
  
  // Clamp length
  const clamped = clampLength(sanitized, maxLength);
  const wasClamped = clamped !== sanitized;
  
  if (wasClamped) {
    warnings.push(`Text truncated from ${sanitized.length} to ${clamped.length} characters`);
  }
  
  return {
    sanitized: clamped,
    originalLength,
    finalLength: clamped.length,
    wasClamped,
    wasSanitized,
    riskLevel: analysis.riskLevel,
    warnings
  };
}

/**
 * Check if input is safe for LLM processing
 * 
 * @param text - Text to validate
 * @returns True if text is safe to process
 */
export function isSafeForProcessing(text: string): boolean {
  const analysis = analyzeSuspiciousContent(text);
  return analysis.riskLevel !== 'high';
}

/**
 * Log security events for monitoring
 * 
 * @param event - Security event details
 */
export function logSecurityEvent(event: {
  type: 'dangerous_pattern' | 'suspicious_keyword' | 'length_violation' | 'sanitization';
  text: string;
  matches?: string[];
  userId?: string;
  timestamp?: Date;
}): void {
  const logEntry = {
    ...event,
    timestamp: event.timestamp || new Date(),
    textLength: event.text.length,
    textPreview: event.text.substring(0, 100) + (event.text.length > 100 ? '...' : '')
  };
  
  // In production, this would go to a security monitoring system
  console.warn('🚨 Security Event:', JSON.stringify(logEntry, null, 2));
}

/**
 * Rate limiting helper for extraction requests
 */
export class ExtractionRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  
  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  /**
   * Check if user can make an extraction request
   */
  canMakeRequest(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => 
      now - timestamp < this.windowMs
    );
    
    this.requests.set(userId, recentRequests);
    
    return recentRequests.length < this.maxRequests;
  }
  
  /**
   * Record a new request
   */
  recordRequest(userId: string): void {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    userRequests.push(now);
    this.requests.set(userId, userRequests);
  }
  
  /**
   * Get remaining requests for user
   */
  getRemainingRequests(userId: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const recentRequests = userRequests.filter(timestamp => 
      now - timestamp < this.windowMs
    );
    
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}
