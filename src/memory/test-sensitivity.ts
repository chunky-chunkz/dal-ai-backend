/**
 * Quick test script to verify increased memory extraction sensitivity
 * 
 * Tests with borderline sentences to see if more memories are now saved
 */

import { evaluateAndMaybeStore } from './manager.js';

const TEST_SENTENCES = [
  "Ich mag Python und TypeScript.",
  "Ich bin im DevOps Team.",
  "Ich lese gerne Science Fiction Bücher.",
  "Ich arbeite meistens remote.",
  "Ich trinke morgens Kaffee.",
  "Ich bevorzuge VS Code als Editor.",
  "Ich mache gerne Sport am Wochenende.",
  "Ich höre oft Podcasts beim Joggen.",
  "Ich nutze Linux als Betriebssystem.",
  "Meine Lieblingsfarbe ist grün."
];

async function runTest() {
  console.log('🧪 Testing increased memory sensitivity with adjusted thresholds\n');
  console.log('📋 Thresholds:');
  console.log('   - Auto-save: >= 0.6 (was 0.75)');
  console.log('   - Suggestion: >= 0.35 (was 0.5)');
  console.log('   - Reject: < 0.35\n');
  
  const testUserId = 'test-sensitivity-user';
  
  let totalSaved = 0;
  let totalSuggested = 0;
  let totalRejected = 0;
  
  for (const sentence of TEST_SENTENCES) {
    console.log(`\n📝 Testing: "${sentence}"`);
    
    try {
      const result = await evaluateAndMaybeStore(testUserId, sentence);
      
      console.log(`   ✅ Saved: ${result.saved.length}`);
      console.log(`   💭 Suggested: ${result.suggestions.length}`);
      console.log(`   ❌ Rejected: ${result.rejected.length}`);
      
      if (result.saved.length > 0) {
        result.saved.forEach(m => console.log(`      → ${m.key}: ${m.value} (${m.confidence.toFixed(3)})`));
      }
      if (result.suggestions.length > 0) {
        result.suggestions.forEach(m => console.log(`      ? ${m.key}: ${m.value} (${m.confidence.toFixed(3)})`));
      }
      
      totalSaved += result.saved.length;
      totalSuggested += result.suggestions.length;
      totalRejected += result.rejected.length;
      
    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log('\n\n📊 SUMMARY:');
  console.log(`   Total sentences tested: ${TEST_SENTENCES.length}`);
  console.log(`   Total memories saved: ${totalSaved}`);
  console.log(`   Total suggestions: ${totalSuggested}`);
  console.log(`   Total rejected: ${totalRejected}`);
  console.log(`   Save rate: ${((totalSaved + totalSuggested) / TEST_SENTENCES.length * 100).toFixed(1)}%`);
  console.log('\n✅ Test complete! If save rate is high, sensitivity is working.');
}

// Run the test
runTest().catch(console.error);
