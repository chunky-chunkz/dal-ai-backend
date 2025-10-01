/**
 * Test updated answer service with RAG integration
 */

import dotenv from 'dotenv';
import { answerQuestion, answerQuestionStream, answerQuestionLegacy } from './services/answer.service.js';

dotenv.config();

async function testAnswerService() {
  console.log('🔧 Testing Updated Answer Service with RAG Integration\n');

  try {
    // Test 1: High confidence RAG question
    console.log('1️⃣ Testing high confidence question...');
    const q1 = 'Warum ist mein Internet so langsam?';
    console.log(`❓ Question: "${q1}"`);

    const response1 = await answerQuestion(q1);
    console.log('📄 Answer:', response1.answer);
    console.log('🎯 Confidence:', response1.confidence.toFixed(3));
    console.log('📚 Source ID:', response1.sourceId || 'none');
    console.log('⏰ Timestamp:', response1.timestamp);
    console.log('-'.repeat(60));

    // Test 2: Low confidence question
    console.log('\n2️⃣ Testing low confidence question...');
    const q2 = 'Was ist die beste Pizza in Rom?';
    console.log(`❓ Question: "${q2}"`);

    const response2 = await answerQuestion(q2);
    console.log('📄 Answer:', response2.answer);
    console.log('🎯 Confidence:', response2.confidence.toFixed(3));
    console.log('📚 Source ID:', response2.sourceId || 'none');
    console.log('✅ Should be fallback:', response2.answer.includes('Ticket erstellen'));
    console.log('-'.repeat(60));

    // Test 3: Empty question
    console.log('\n3️⃣ Testing empty question...');
    const q3 = '';
    console.log(`❓ Question: "${q3}"`);

    const response3 = await answerQuestion(q3);
    console.log('📄 Answer:', response3.answer);
    console.log('🎯 Confidence:', response3.confidence.toFixed(3));
    console.log('✅ Should be uncertain answer:', response3.answer.includes('Ticket erstellen'));
    console.log('-'.repeat(60));

    // Test 4: Streaming answer
    console.log('\n4️⃣ Testing streaming answer...');
    const q4 = 'Wie bezahle ich meine Rechnung?';
    console.log(`❓ Question: "${q4}"`);
    console.log('🌊 Streaming response:');

    let streamedContent = '';
    const startTime = Date.now();
    
    const streamResponse = await answerQuestionStream(q4, (chunk) => {
      process.stdout.write(chunk);
      streamedContent += chunk;
    });

    const streamTime = Date.now() - startTime;
    
    console.log('\n\n📊 Stream results:');
    console.log('🎯 Confidence:', streamResponse.confidence.toFixed(3));
    console.log('📚 Source ID:', streamResponse.sourceId || 'none');
    console.log('⏱️  Stream time:', streamTime + 'ms');
    console.log('✅ Content match:', streamedContent.trim() === streamResponse.answer);
    console.log('-'.repeat(60));

    // Test 5: Compare legacy vs RAG
    console.log('\n5️⃣ Comparing Legacy vs RAG responses...');
    const q5 = 'Router Reset durchführen';
    console.log(`❓ Question: "${q5}"`);

    const [legacyResponse, ragResponse] = await Promise.all([
      answerQuestionLegacy(q5),
      answerQuestion(q5)
    ]);

    console.log('\n📜 Legacy Response:');
    console.log('   Answer:', legacyResponse.answer.substring(0, 100) + '...');
    console.log('   Confidence:', legacyResponse.confidence.toFixed(3));
    console.log('   Source:', legacyResponse.sourceId);

    console.log('\n🤖 RAG Response:');
    console.log('   Answer:', ragResponse.answer.substring(0, 100) + '...');
    console.log('   Confidence:', ragResponse.confidence.toFixed(3));
    console.log('   Source:', ragResponse.sourceId);

    console.log('\n✅ All answer service tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  }
}

async function testErrorHandling() {
  console.log('\n🛡️  Testing Error Handling...');

  try {
    // Test with various edge cases
    const edgeCases = [
      null as any,
      undefined as any,
      '',
      '   ',
      'a',
      'ab',
      '?!@#$%^&*()',
      'x'.repeat(1000)
    ];

    for (const testCase of edgeCases) {
      try {
        const response = await answerQuestion(testCase);
        console.log(`✅ Input "${String(testCase).substring(0, 20)}" → Confidence: ${response.confidence.toFixed(3)}`);
      } catch (error) {
        console.log(`❌ Input "${String(testCase).substring(0, 20)}" → Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    console.log('🛡️  Error handling tests completed.');

  } catch (error) {
    console.error('❌ Error handling test failed:', error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  await testAnswerService();
  await testErrorHandling();
  console.log('\n🎉 All tests completed!');
}

main().catch(console.error);
