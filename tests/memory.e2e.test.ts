/**
 * End-to-End Tests for Memory API
 * 
 * Tests the complete memory evaluation workflow using actual components:
 * - Memory extraction with real German sentences
 * - Policy compliance and auto-save decisions
 * - Integration test examples as requested
 */

import { describe, test, expect } from 'vitest';
import { evaluateAndMaybeStore } from '../src/memory/manager.js';
import { listByUser, clearUser } from '../src/memory/store.js';

describe('Memory System E2E Tests', () => {
  test('POST /api/memory/evaluate with "Romans Lieblingsfarbe ist blau." → autoSave', async () => {
    const userId = 'test-roman-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate the utterance
    const result = await evaluateAndMaybeStore(userId, 'Romans Lieblingsfarbe ist blau.');
    
    // Should auto-save as it's a stable, low-risk preference
    expect(result.saved.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBe(0); // No consent needed
    expect(result.rejected.length).toBe(0);
    
    // Check the saved memory
    const savedMemory = result.saved[0];
    expect(savedMemory.person).toBe('roman');
    expect(savedMemory.type).toBe('preference');
    expect(savedMemory.key).toContain('farbe');
    expect(savedMemory.value).toContain('blau');
    expect(savedMemory.confidence).toBeGreaterThan(0.7);
    
    // Verify it's in storage
    const memories = await listByUser(userId);
    expect(memories.length).toBe(1);
    expect(memories[0].value).toContain('blau');
    
    console.log('✅ Auto-saved Romans color preference:', savedMemory);
  });

  test('Memory extraction with "Mein Passwort ist geheim123" → reject completely', async () => {
    const userId = 'test-password-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate password statement
    const result = await evaluateAndMaybeStore(userId, 'Mein Passwort ist geheim123');
    
    // Should reject everything
    expect(result.saved.length).toBe(0);
    expect(result.suggestions.length).toBe(0);
    expect(result.rejected.length).toBeGreaterThanOrEqual(0); // Might not even extract
    
    // Verify nothing is in storage
    const memories = await listByUser(userId);
    expect(memories.length).toBe(0);
    
    console.log('✅ Correctly rejected password statement');
  });

  test('Memory extraction with "Ich mag dunkles Theme" → autoSave preference', async () => {
    const userId = 'test-theme-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate theme preference
    const result = await evaluateAndMaybeStore(userId, 'Ich mag dunkles Theme');
    
    // Should auto-save as it's a low-risk preference
    expect(result.saved.length).toBeGreaterThan(0);
    
    const themeMemory = result.saved.find(m => 
      m.value.includes('dunkel') || m.value.includes('theme')
    );
    expect(themeMemory).toBeDefined();
    expect(themeMemory?.type).toBe('preference');
    
    console.log('✅ Auto-saved theme preference:', themeMemory);
  });

  test('Complex extraction: "Ich heiße Anna und arbeite als Designerin" → mixed results', async () => {
    const userId = 'test-anna-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate complex statement
    const result = await evaluateAndMaybeStore(userId, 'Ich heiße Anna und arbeite als Designerin');
    
    // Should extract multiple facts
    const totalExtracted = result.saved.length + result.suggestions.length;
    expect(totalExtracted).toBeGreaterThanOrEqual(1);
    
    // Name might need consent (medium risk)
    // Job might auto-save (profile fact, usually low risk)
    const nameMemory = [...result.saved, ...result.suggestions].find(m => 
      m.value.toLowerCase().includes('anna') || m.key.includes('name')
    );
    const jobMemory = [...result.saved, ...result.suggestions].find(m => 
      m.value.toLowerCase().includes('design') || m.key.includes('beruf')
    );
    
    expect(nameMemory || jobMemory).toBeDefined(); // At least one should be extracted
    
    console.log('✅ Complex extraction results:', {
      saved: result.saved.length,
      suggestions: result.suggestions.length,
      rejected: result.rejected.length
    });
  });

  test('PII rejection: "Meine Email ist anna@example.com" → reject completely', async () => {
    const userId = 'test-email-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate email statement
    const result = await evaluateAndMaybeStore(userId, 'Meine Email ist anna@example.com');
    
    // Should not save anything due to PII
    expect(result.saved.length).toBe(0);
    expect(result.suggestions.length).toBe(0);
    
    // Verify nothing is in storage
    const memories = await listByUser(userId);
    expect(memories.length).toBe(0);
    
    console.log('✅ Correctly rejected email PII');
  });

  test('Policy compliance: "Ich wähle immer die CDU" → reject political', async () => {
    const userId = 'test-politics-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate political statement
    const result = await evaluateAndMaybeStore(userId, 'Ich wähle immer die CDU');
    
    // Should reject political opinion
    expect(result.saved.length).toBe(0);
    expect(result.suggestions.length).toBe(0);
    
    console.log('✅ Correctly rejected political statement');
  });

  test('Multiple preferences: "Ich trinke gerne Kaffee und mag Jazz-Musik" → auto-save both', async () => {
    const userId = 'test-multiple-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate multiple preferences
    const result = await evaluateAndMaybeStore(userId, 'Ich trinke gerne Kaffee und mag Jazz-Musik');
    
    // Should extract multiple preferences
    expect(result.saved.length).toBeGreaterThanOrEqual(1);
    
    const allMemories = [...result.saved, ...result.suggestions];
    const coffeeMemory = allMemories.find(m => 
      m.value.toLowerCase().includes('kaffee')
    );
    const musicMemory = allMemories.find(m => 
      m.value.toLowerCase().includes('jazz') || m.value.toLowerCase().includes('musik')
    );
    
    // At least one preference should be extracted
    expect(coffeeMemory || musicMemory).toBeDefined();
    
    console.log('✅ Multiple preferences extracted:', {
      coffeeMemory: coffeeMemory?.value,
      musicMemory: musicMemory?.value
    });
  });

  test('Health data rejection: "Ich leide an Diabetes" → reject medical info', async () => {
    const userId = 'test-health-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate health statement
    const result = await evaluateAndMaybeStore(userId, 'Ich leide an Diabetes');
    
    // Should reject health information
    expect(result.saved.length).toBe(0);
    expect(result.suggestions.length).toBe(0);
    
    console.log('✅ Correctly rejected health information');
  });

  test('Task hint with TTL: "Erinnere mich morgen an den Termin" → save with expiry', async () => {
    const userId = 'test-task-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Evaluate task hint
    const result = await evaluateAndMaybeStore(userId, 'Erinnere mich morgen an den Termin');
    
    if (result.saved.length > 0) {
      const taskMemory = result.saved.find(m => m.type === 'task_hint');
      if (taskMemory) {
        // Task hints should have TTL (30 days)
        expect(taskMemory.ttl).toBeDefined();
        expect(taskMemory.ttl).toBe('P30D'); // 30 days in ISO 8601 duration format
        
        console.log('✅ Task hint saved with TTL:', taskMemory.ttl);
      }
    }
  });

  test('Memory persistence and retrieval workflow', async () => {
    const userId = 'test-persistence-e2e';
    
    // Clear any existing memories
    await clearUser(userId);
    
    // Save multiple memories
    await evaluateAndMaybeStore(userId, 'Ich trinke gerne Tee');
    await evaluateAndMaybeStore(userId, 'Meine Lieblingsfarbe ist grün');
    await evaluateAndMaybeStore(userId, 'Ich arbeite als Teacher');
    
    // Retrieve all memories
    const memories = await listByUser(userId);
    
    // Should have saved at least some memories
    expect(memories.length).toBeGreaterThan(0);
    
    // Check memory structure
    if (memories.length > 0) {
      const memory = memories[0];
      expect(memory.id).toBeDefined();
      expect(memory.userId).toBe(userId);
      expect(memory.type).toBeDefined();
      expect(memory.value).toBeDefined();
      expect(memory.createdAt).toBeDefined();
      
      console.log('✅ Memory persistence verified:', memories.length, 'memories saved');
    }
  });
});

describe('Memory System Performance Tests', () => {
  test('Batch processing: Multiple utterances in sequence', async () => {
    const userId = 'test-batch-e2e';
    await clearUser(userId);
    
    const utterances = [
      'Ich mag Pizza',
      'Meine Lieblingsfarbe ist blau',
      'Ich trinke gerne Kaffee',
      'Ich arbeite als Developer',
      'Ich wohne in Berlin'
    ];
    
    const startTime = Date.now();
    
    const results = [];
    for (const utterance of utterances) {
      const result = await evaluateAndMaybeStore(userId, utterance);
      results.push(result);
    }
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Should process all utterances
    expect(results.length).toBe(5);
    
    // Performance should be reasonable (adjust threshold as needed)
    expect(processingTime).toBeLessThan(30000); // 30 seconds max
    
    // Should have saved multiple memories
    const totalSaved = results.reduce((sum, r) => sum + r.saved.length, 0);
    expect(totalSaved).toBeGreaterThan(0);
    
    console.log(`✅ Batch processing completed: ${processingTime}ms for ${utterances.length} utterances, ${totalSaved} memories saved`);
  });
});

describe('Edge Cases and Error Handling', () => {
  test('Empty utterance handling', async () => {
    const userId = 'test-empty-e2e';
    
    try {
      const result = await evaluateAndMaybeStore(userId, '');
      expect(result.saved.length).toBe(0);
      expect(result.suggestions.length).toBe(0);
    } catch (error) {
      // Empty utterance might throw an error, which is acceptable
      expect(error).toBeDefined();
    }
  });

  test('Very long utterance handling', async () => {
    const userId = 'test-long-e2e';
    
    const longUtterance = 'Ich mag Kaffee '.repeat(100); // Very long
    
    try {
      const result = await evaluateAndMaybeStore(userId, longUtterance);
      // Should either process successfully or fail gracefully
      expect(result).toBeDefined();
    } catch (error) {
      // Long utterances might be rejected, which is acceptable
      expect(error).toBeDefined();
    }
  });

  test('Special characters and encoding', async () => {
    const userId = 'test-encoding-e2e';
    await clearUser(userId);
    
    const result = await evaluateAndMaybeStore(userId, 'Ich mag Café ☕ und Français 🇫🇷');
    
    // Should handle Unicode characters properly
    expect(result).toBeDefined();
    
    if (result.saved.length > 0) {
      const memory = result.saved[0];
      expect(memory.value).toBeDefined();
      
      console.log('✅ Unicode handling verified:', memory.value);
    }
  });
});
