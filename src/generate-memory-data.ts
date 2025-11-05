/**
 * Generate more realistic memory events for statistics
 */

import { evaluateAndMaybeStore } from './memory/manager.js';
import { retrieveForPrompt } from './memory/retriever.js';
import { logMemoryEvent, now, hh } from './memory/metrics/logger.js';

async function generateRealisticData() {
  console.log('🧪 Generating realistic memory data...\n');

  const users = ['user-1', 'user-2', 'user-3'];
  
  // Various utterances that will create different outcomes
  const utterances = [
    { text: 'Meine Lieblingsfarbe ist Rot', shouldSave: true },
    { text: 'Ich wohne in München', shouldSave: true },
    { text: 'Ich bin 35 Jahre alt', shouldSave: true },  // Medium risk - age
    { text: 'Ich arbeite als Data Scientist', shouldSave: true },
    { text: 'Mein Hobby ist Wandern', shouldSave: true },
    { text: 'Ich mag Pizza', shouldSave: true },
    { text: 'Das Wetter ist schön heute', shouldSave: false },  // Low value - should be rejected
    { text: 'Ich habe einen Hund', shouldSave: true },
    { text: 'Meine Email ist test@example.com', shouldSave: false },  // PII - should be rejected
    { text: 'Ich fahre gerne Fahrrad', shouldSave: true },
    { text: 'Ich spreche Deutsch und Englisch', shouldSave: true },
    { text: 'Danke für die Information', shouldSave: false },  // No information - should be rejected
    { text: 'Mein Geburtstag ist am 15. März', shouldSave: true },
    { text: 'Ich trinke jeden Morgen Kaffee', shouldSave: true },
    { text: 'Okay verstanden', shouldSave: false },  // No information
    { text: 'Ich lese gerne Science Fiction', shouldSave: true },
  ];

  const queries = [
    'Was ist meine Lieblingsfarbe?',
    'Wo wohne ich?',
    'Was ist mein Beruf?',
    'Was sind meine Hobbys?',
    'Welche Sprachen spreche ich?',
    'Was mag ich essen?',
    'Was mache ich gerne in meiner Freizeit?',
    'Wann habe ich Geburtstag?',
  ];

  // Generate data for multiple users
  for (const userId of users) {
    console.log(`\n👤 Processing user: ${userId}`);
    console.log('─'.repeat(50));
    
    let saved = 0;
    let suggested = 0;
    let rejected = 0;

    // Save memories
    console.log('📝 Saving memories...');
    for (const { text, shouldSave } of utterances) {
      try {
        const result = await evaluateAndMaybeStore(userId, text);
        saved += result.saved.length;
        suggested += result.suggestions.length;
        rejected += result.rejected.length;
        
        if (result.saved.length > 0 || result.suggestions.length > 0 || result.rejected.length > 0) {
          const status = result.saved.length > 0 ? '✅ Saved' : 
                        result.suggestions.length > 0 ? '💭 Suggested' : '🚫 Rejected';
          console.log(`  ${status}: "${text.substring(0, 50)}..."`);
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
      }
    }

    console.log(`\n📊 User ${userId} summary: ${saved} saved, ${suggested} suggested, ${rejected} rejected`);

    // Retrieve memories (simulate real usage)
    console.log(`\n🔍 Testing retrievals for ${userId}...`);
    for (const query of queries.slice(0, 5)) {  // Do 5 queries per user
      try {
        const startTime = Date.now();
        const result = await retrieveForPrompt(userId, query, 5);
        const latency = Date.now() - startTime;
        console.log(`  Query: "${query}" → ${result.relevant.length} results (${latency}ms)`);
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
      }
    }

    // Add some consolidation/summarization events
    await logMemoryEvent({
      type: 'consolidate',
      userId,
      action: 'update',
      originalIds: [`mem_${Date.now()}_1`, `mem_${Date.now()}_2`],
      ts: now()
    });
  }

  // Add some error events
  await logMemoryEvent({
    type: 'error',
    where: 'test-scenario',
    message: 'Simulated error for testing',
    ts: now()
  });

  console.log('\n✅ Data generation complete!');
  console.log('\n📊 Statistics should now show meaningful data');
}

generateRealisticData().catch(console.error);
