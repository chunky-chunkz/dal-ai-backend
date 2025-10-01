import { processAndStoreMemories, createMemoryContext } from './src/memory/userMemory.js';

async function testMemorySystem() {
  console.log('🧪 Testing Memory System...\n');

  // Test 1: User Roman sagt seine Lieblingsfarbe ist blau
  console.log('📝 Test 1: User Roman - Lieblingsfarbe blau');
  await processAndStoreMemories('meine lieblingsfarbe ist blau', 'user_roman_123');
  
  const romanContext = await createMemoryContext('user_roman_123');
  console.log('Roman Context:', romanContext);
  console.log('');

  // Test 2: User Dzhangr sagt seine Lieblingsfarbe ist rot
  console.log('📝 Test 2: User Dzhangr - Lieblingsfarbe rot');
  await processAndStoreMemories('meine lieblingsfarbe ist rot', 'user_dzhangr_456');
  
  const dzhangrContext = await createMemoryContext('user_dzhangr_456');
  console.log('Dzhangr Context:', dzhangrContext);
  console.log('');

  // Test 3: Nochmal Roman's Context abrufen
  console.log('📝 Test 3: Roman Context nochmal abrufen');
  const romanContext2 = await createMemoryContext('user_roman_123');
  console.log('Roman Context (2nd time):', romanContext2);
}

testMemorySystem().catch(console.error);
