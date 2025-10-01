/**
 * Test RAG implementation with local Phi-3
 */

import dotenv from 'dotenv';
import { ragLocalAnswer, ragLocalAnswerStream } from './ai/rag.local.js';

dotenv.config();

async function testRagLocal() {
  console.log('🔍 Testing RAG Local Implementation...\n');

  try {
    // Test 1: Basic RAG query
    console.log('1️⃣ Testing basic RAG query...');
    const question1 = 'Warum ist mein Internet so langsam?';
    console.log(`❓ Question: "${question1}"`);

    const response1 = await ragLocalAnswer(question1);
    console.log('📄 Answer:', response1.answer);
    console.log('🎯 Confidence:', response1.confidence.toFixed(3));
    console.log('📚 Source IDs:', response1.sourceIds);
    console.log('─'.repeat(60));

    // Test 2: Different question
    console.log('\n2️⃣ Testing different question...');
    const question2 = 'Wie kann ich meine Rechnung bezahlen?';
    console.log(`❓ Question: "${question2}"`);

    const response2 = await ragLocalAnswer(question2);
    console.log('📄 Answer:', response2.answer);
    console.log('🎯 Confidence:', response2.confidence.toFixed(3));
    console.log('📚 Source IDs:', response2.sourceIds);
    console.log('─'.repeat(60));

    // Test 3: Question with no good match
    console.log('\n3️⃣ Testing question with no match...');
    const question3 = 'Welche Farbe hat der Himmel auf Mars?';
    console.log(`❓ Question: "${question3}"`);

    const response3 = await ragLocalAnswer(question3);
    console.log('📄 Answer:', response3.answer);
    console.log('🎯 Confidence:', response3.confidence.toFixed(3));
    console.log('📚 Source IDs:', response3.sourceIds);
    console.log('─'.repeat(60));

    // Test 4: Streaming RAG
    console.log('\n4️⃣ Testing streaming RAG...');
    const question4 = 'Wie melde ich einen Umzug an?';
    console.log(`❓ Question: "${question4}"`);
    console.log('🌊 Streaming response:');

    let streamedContent = '';
    const streamResponse = await ragLocalAnswerStream(question4, 3, (chunk) => {
      process.stdout.write(chunk);
      streamedContent += chunk;
    });

    console.log('\n\n📊 Stream results:');
    console.log('🎯 Confidence:', streamResponse.confidence.toFixed(3));
    console.log('📚 Source IDs:', streamResponse.sourceIds);
    console.log('✅ Streamed content matches final:', streamedContent.trim() === streamResponse.answer);

    console.log('\n✅ All RAG tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  }
}

testRagLocal().catch(console.error);
