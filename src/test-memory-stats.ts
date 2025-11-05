/**
 * Test script to generate memory events for statistics
 */

import { evaluateAndMaybeStore } from './memory/manager.js';
import { findRelevant } from './memory/retriever.js';
import { logMemoryEvent, now, hh } from './memory/metrics/logger.js';

async function testMemoryOperations() {
  console.log('🧪 Testing memory operations to generate statistics...\n');

  const testUserId = 'test-stats-user';
  const utterances = [
    'Meine Lieblingsfarbe ist Blau',
    'Ich wohne in Berlin',
    'Ich arbeite als Softwareentwickler',
    'Mein Hobby ist Fotografieren',
    'Ich trinke gerne Kaffee',
  ];

  // Test saving memories
  console.log('📝 Testing memory saves...');
  for (const utterance of utterances) {
    try {
      const result = await evaluateAndMaybeStore(testUserId, utterance);
      console.log(`  - Utterance: "${utterance}"`);
      console.log(`    Saved: ${result.saved.length}, Suggestions: ${result.suggestions.length}, Rejected: ${result.rejected.length}`);
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }

  // Test retrieving memories
  console.log('\n🔍 Testing memory retrieval...');
  const queries = [
    'Was ist meine Lieblingsfarbe?',
    'Wo wohne ich?',
    'Was ist mein Beruf?',
  ];

  for (const query of queries) {
    try {
      const startTime = Date.now();
      const results = await findRelevant(testUserId, query, 5);
      const latency = Date.now() - startTime;
      console.log(`  - Query: "${query}"`);
      console.log(`    Found: ${results.length} memories, Latency: ${latency}ms`);
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }

  // Add some manual test events
  console.log('\n📊 Adding manual test events...');
  await logMemoryEvent({
    type: 'consolidate',
    userId: testUserId,
    action: 'merge',
    originalIds: ['id1', 'id2'],
    ts: now()
  });

  await logMemoryEvent({
    type: 'summarize',
    userId: testUserId,
    clusterSize: 5,
    archived: 3,
    ts: now()
  });

  console.log('\n✅ Test complete! Check data/metrics/memory_events.ndjson');
}

testMemoryOperations().catch(console.error);
