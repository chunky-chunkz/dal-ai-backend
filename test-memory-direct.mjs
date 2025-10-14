/**
 * Direct test of memory system
 */

import { evaluateAndMaybeStore } from './dist/memory/manager.js';
import { listByUser } from './dist/memory/store.js';

const testUserId = 'test-user-123';

console.log('🧪 Testing Memory System Directly\n');

// Test 1: Store a favorite color
console.log('📝 Test 1: Store favorite color');
const result1 = await evaluateAndMaybeStore(testUserId, 'Meine Lieblingsfarbe ist rot');
console.log('Result:', {
  saved: result1.saved.length,
  suggestions: result1.suggestions.length,
  rejected: result1.rejected.length
});

// Test 2: List all memories for this user
console.log('\n📋 Test 2: List memories');
const memories = await listByUser(testUserId);
console.log('Memories found:', memories.length);
memories.forEach(m => {
  console.log(`  - ${m.key}: ${m.value} (type: ${m.type})`);
});

// Test 3: Try again with another statement
console.log('\n📝 Test 3: Store another preference');
const result2 = await evaluateAndMaybeStore(testUserId, 'Ich trinke gerne Kaffee');
console.log('Result:', {
  saved: result2.saved.length,
  suggestions: result2.suggestions.length
});

// Test 4: List again
console.log('\n📋 Test 4: List memories again');
const memories2 = await listByUser(testUserId);
console.log('Memories found:', memories2.length);
memories2.forEach(m => {
  console.log(`  - ${m.key}: ${m.value} (type: ${m.type})`);
});

console.log('\n✅ Test completed!');
