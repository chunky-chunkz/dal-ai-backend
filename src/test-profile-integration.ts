/**
 * Test script for profile integration in answer service
 */

import { answerQuestion } from './services/answer.service.js';
import { setProfile, findFact, getProfile } from './memory/profileStore.js';

async function testProfileIntegration() {
  console.log('🧪 Testing Profile Integration in Answer Service\n');

  try {
    // Test 1: Store some profile information manually
    console.log('1. Storing profile information manually...');
    await setProfile('Roman', 'lieblingsfarbe', 'blau');
    await setProfile('Maria', 'beruf', 'Lehrerin');
    await setProfile('Peter', 'hobby', 'Fotografie');
    console.log('✅ Manual profile data stored\n');

    // Test 2: Query profile information
    console.log('2. Testing profile queries...');
    
    const result1 = await answerQuestion('Was ist Romans Lieblingsfarbe?');
    console.log(`Q: Was ist Romans Lieblingsfarbe?`);
    console.log(`A: ${result1.answer} (Confidence: ${result1.confidence})`);
    console.log(`Source: ${result1.sourceId}\n`);

    const result2 = await answerQuestion('Lieblingsfarbe von Roman');
    console.log(`Q: Lieblingsfarbe von Roman`);
    console.log(`A: ${result2.answer} (Confidence: ${result2.confidence})`);
    console.log(`Source: ${result2.sourceId}\n`);

    const result3 = await answerQuestion('Was arbeitet Maria?');
    console.log(`Q: Was arbeitet Maria?`);
    console.log(`A: ${result3.answer} (Confidence: ${result3.confidence})`);
    console.log(`Source: ${result3.sourceId}\n`);

    // Test 3: Store new profile information via natural language
    console.log('3. Testing profile information extraction...');
    
    const result4 = await answerQuestion('Annas Lieblingsessen ist Pizza');
    console.log(`Q: Annas Lieblingsessen ist Pizza`);
    console.log(`A: ${result4.answer} (Confidence: ${result4.confidence})\n`);

    const result5 = await answerQuestion('Tom mag Kaffee');
    console.log(`Q: Tom mag Kaffee`);
    console.log(`A: ${result5.answer} (Confidence: ${result5.confidence})\n`);

    const result6 = await answerQuestion('Lisa wohnt in Berlin');
    console.log(`Q: Lisa wohnt in Berlin`);
    console.log(`A: ${result6.answer} (Confidence: ${result6.confidence})\n`);

    // Test 4: Verify stored information
    console.log('4. Verifying stored profile information...');
    
    const annaEssen = await findFact('Anna', 'lieblingsessen');
    console.log(`Anna's Lieblingsessen: ${annaEssen}`);

    const tomMag = await findFact('Tom', 'mag');
    console.log(`Tom mag: ${tomMag}`);

    const lisaWohnort = await findFact('Lisa', 'wohnort');
    console.log(`Lisa's Wohnort: ${lisaWohnort}\n`);

    // Test 5: Query the newly stored information
    console.log('5. Testing queries for newly stored information...');
    
    const result7 = await answerQuestion('Was ist Annas Lieblingsessen?');
    console.log(`Q: Was ist Annas Lieblingsessen?`);
    console.log(`A: ${result7.answer} (Confidence: ${result7.confidence})`);
    console.log(`Source: ${result7.sourceId}\n`);

    const result8 = await answerQuestion('Wo wohnt Lisa?');
    console.log(`Q: Wo wohnt Lisa?`);
    console.log(`A: ${result8.answer} (Confidence: ${result8.confidence})`);
    console.log(`Source: ${result8.sourceId}\n`);

    // Test 6: Display all profiles
    console.log('6. All stored profiles:');
    console.log('Roman:', getProfile('Roman'));
    console.log('Maria:', getProfile('Maria'));
    console.log('Peter:', getProfile('Peter'));
    console.log('Anna:', getProfile('Anna'));
    console.log('Tom:', getProfile('Tom'));
    console.log('Lisa:', getProfile('Lisa'));

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testProfileIntegration();
}

export { testProfileIntegration };
