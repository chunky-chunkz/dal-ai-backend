/**
 * Unit Tests for Memory System Components
 * 
 * Tests for:
 * - PII detection and handling
 * - Memory extraction with sample sentences
 * - Memory scoring algorithms
 * - Policy compliance
 */

import { describe, test, expect } from 'vitest';
import { detectPII, maskPII } from '../src/memory/pii.js';
import { extractCandidates } from '../src/memory/extractor.js';
import { scoreCandidate } from '../src/memory/scorer.js';
import { classifyRisk, isAllowedType, defaultTTL } from '../src/memory/policy.js';

describe('PII Detection Tests', () => {
  test('should detect email addresses', () => {
    const result = detectPII('Meine Email ist john.doe@example.com');
    expect(result.hasPII).toBe(true);
    expect(result.matches.some(m => m.kind === 'email')).toBe(true);
  });

  test('should detect phone numbers', () => {
    const result = detectPII('Meine Telefonnummer ist +49 30 12345678');
    expect(result.hasPII).toBe(true);
    expect(result.matches.some(m => m.kind === 'phone')).toBe(true);
  });

  test('should detect IBAN', () => {
    const result = detectPII('Meine IBAN ist DE89370400440532013000');
    expect(result.hasPII).toBe(true);
    expect(result.matches.some(m => m.kind === 'iban')).toBe(true);
  });

  test('should detect credit card numbers', () => {
    const result = detectPII('Meine Kreditkarte ist 4532 1234 5678 9012');
    expect(result.hasPII).toBe(true);
    expect(result.matches.some(m => m.kind === 'card')).toBe(true);
  });

  test('should NOT detect harmless preferences', () => {
    const result = detectPII('Ich trinke gerne Kaffee am Morgen');
    expect(result.hasPII).toBe(false);
  });

  test('should mask PII correctly', () => {
    const masked = maskPII('Email: john@example.com, Phone: 030-123456');
    expect(masked).not.toContain('john@example.com');
    expect(masked).not.toContain('030-123456');
    expect(masked).toContain('[EMAIL]');
    expect(masked).toContain('[PHONE]');
  });
});

describe('Memory Extraction Tests', () => {
  test('should extract preference from coffee statement', async () => {
    const candidates = await extractCandidates('Ich trinke gerne Kaffee am Morgen', 'test-user');
    expect(candidates.length).toBeGreaterThan(0);
    
    const coffeePreference = candidates.find(c => 
      c.type === 'preference' && c.value.includes('kaffee')
    );
    expect(coffeePreference).toBeDefined();
    expect(coffeePreference?.confidence).toBeGreaterThan(0.5);
  });

  test('should extract profile fact from job statement', async () => {
    const candidates = await extractCandidates('Ich arbeite als Software-Entwickler', 'test-user');
    expect(candidates.length).toBeGreaterThan(0);
    
    const jobFact = candidates.find(c => 
      c.type === 'profile_fact' && c.key.includes('beruf')
    );
    expect(jobFact).toBeDefined();
    expect(jobFact?.value).toContain('entwickler');
  });

  test('should extract location from residence statement', async () => {
    const candidates = await extractCandidates('Ich wohne in Berlin', 'test-user');
    expect(candidates.length).toBeGreaterThan(0);
    
    const locationFact = candidates.find(c => 
      c.value.includes('berlin')
    );
    expect(locationFact).toBeDefined();
    expect(locationFact?.type).toBe('profile_fact');
  });

  test('should extract multiple facts from complex statement', async () => {
    const candidates = await extractCandidates(
      'Ich heiße Anna, arbeite als Designerin in München und trinke gerne Tee', 
      'test-user'
    );
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    
    // Should extract name, job, location, and preference
    const types = candidates.map(c => c.type);
    expect(types).toContain('profile_fact');
    expect(types).toContain('preference');
  });

  test('should reject password statements', async () => {
    const candidates = await extractCandidates('Mein Passwort ist geheim123', 'test-user');
    expect(candidates.length).toBe(0);
  });

  test('should reject health data', async () => {
    const candidates = await extractCandidates('Ich leide an Diabetes', 'test-user');
    expect(candidates.length).toBe(0);
  });

  test('should reject political statements', async () => {
    const candidates = await extractCandidates('Ich wähle immer die CDU', 'test-user');
    expect(candidates.length).toBe(0);
  });

  test('should handle empty or unclear statements', async () => {
    const candidates = await extractCandidates('Hmm, interessant...', 'test-user');
    expect(candidates.length).toBe(0);
  });
});

describe('Memory Scoring Tests', () => {
  test('should score stable preferences highly', () => {
    const candidate = {
      type: 'preference' as const,
      key: 'lieblingsfarbe',
      value: 'blau',
      confidence: 0.9,
      person: 'self'
    };
    
    const score = scoreCandidate(candidate, []);
    expect(score).toBeGreaterThan(0.7);
  });

  test('should score vague preferences lower', () => {
    const candidate = {
      type: 'preference' as const,
      key: 'mag',
      value: 'etwas',
      confidence: 0.4,
      person: 'self'
    };
    
    const score = scoreCandidate(candidate, []);
    expect(score).toBeLessThan(0.6);
  });

  test('should score profile facts highly', () => {
    const candidate = {
      type: 'profile_fact' as const,
      key: 'beruf',
      value: 'software-entwickler',
      confidence: 0.9,
      person: 'self'
    };
    
    const score = scoreCandidate(candidate, []);
    expect(score).toBeGreaterThan(0.8);
  });

  test('should reduce score for duplicates', () => {
    const candidate = {
      type: 'preference' as const,
      key: 'lieblingsfarbe',
      value: 'blau',
      confidence: 0.9,
      person: 'self'
    };
    
    const existingMemories = [
      {
        id: 'existing-1',
        person: 'self',
        type: 'preference',
        key: 'lieblingsfarbe',
        value: 'blau',
        confidence: 0.9,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    const score = scoreCandidate(candidate, existingMemories);
    expect(score).toBeLessThan(0.5); // Should be heavily penalized for duplication
  });
});

describe('Policy Tests', () => {
  test('should classify passwords as high risk', () => {
    const risk = classifyRisk('Mein Passwort ist abc123', 'preference');
    expect(risk).toBe('high');
  });

  test('should classify health data as high risk', () => {
    const risk = classifyRisk('Ich habe Diabetes', 'profile_fact');
    expect(risk).toBe('high');
  });

  test('should classify preferences as low risk', () => {
    const risk = classifyRisk('Ich mag Pizza', 'preference');
    expect(risk).toBe('low');
  });

  test('should classify contact info as medium risk', () => {
    const risk = classifyRisk('Mein Name ist Anna', 'contact');
    expect(risk).toBe('medium');
  });

  test('should allow standard memory types', () => {
    expect(isAllowedType('preference')).toBe(true);
    expect(isAllowedType('profile_fact')).toBe(true);
    expect(isAllowedType('contact')).toBe(true);
    expect(isAllowedType('task_hint')).toBe(true);
    expect(isAllowedType('invalid_type')).toBe(false);
  });

  test('should provide correct TTL for memory types', () => {
    expect(defaultTTL('preference')).toBeNull(); // No expiration
    expect(defaultTTL('profile_fact')).toBeNull(); // No expiration
    expect(defaultTTL('contact')).toBe('P90D'); // 90 days
    expect(defaultTTL('task_hint')).toBe('P30D'); // 30 days
  });
});

describe('Integration Tests - Policy Examples', () => {
  test('Romans Lieblingsfarbe ist blau - should auto-save', async () => {
    // This should be auto-saved as it's a stable preference
    const candidates = await extractCandidates('Romans Lieblingsfarbe ist blau', 'test-user');
    expect(candidates.length).toBeGreaterThan(0);
    
    const colorPreference = candidates.find(c => 
      c.person === 'roman' && c.key.includes('farbe')
    );
    expect(colorPreference).toBeDefined();
    expect(colorPreference?.value).toContain('blau');
    
    // Should be low risk and high confidence
    const risk = classifyRisk(colorPreference?.value || '', colorPreference?.type || '');
    expect(risk).toBe('low');
    expect(colorPreference?.confidence).toBeGreaterThan(0.8);
  });

  test('Meine Adresse ist... - should reject (PII)', () => {
    const piiResult = detectPII('Meine Adresse ist Musterstraße 123, 12345 Berlin');
    expect(piiResult.hasPII).toBe(true);
    
    const risk = classifyRisk('Meine Adresse ist Musterstraße 123', 'contact');
    expect(risk).toBe('high');
  });

  test('Ich mag dunkles Theme - should suggest or auto-save', async () => {
    const candidates = await extractCandidates('Ich mag dunkles Theme', 'test-user');
    expect(candidates.length).toBeGreaterThan(0);
    
    const themePreference = candidates.find(c => 
      c.value.includes('dunkel') || c.value.includes('theme')
    );
    expect(themePreference).toBeDefined();
    expect(themePreference?.type).toBe('preference');
    
    // Should be safe to auto-save (low risk)
    const risk = classifyRisk(themePreference?.value || '', themePreference?.type || '');
    expect(risk).toBe('low');
  });

  test('Task hint should expire after 30 days', () => {
    const ttl = defaultTTL('task_hint');
    expect(ttl).toBe('P30D');
  });

  test('Profile facts should not expire', () => {
    const ttl = defaultTTL('profile_fact');
    expect(ttl).toBeNull();
  });
});
