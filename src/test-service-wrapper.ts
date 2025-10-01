/**
 * Test for the updated answerQuestionStream service wrapper
 * Shows how to use the service wrapper with AbortSignal support
 */

import { answerQuestionStream } from './services/answer.service.js';

/**
 * Test the service wrapper streaming functionality
 */
async function testServiceWrapper() {
  const question = "Wie kann ich meine Rechnung bezahlen?";
  const abortController = new AbortController();
  
  console.log(`🧪 Testing service wrapper: "${question}"\n`);
  console.log('🔄 Streaming response:\n');
  
  try {
    let fullAnswer = '';
    
    // Use the service wrapper with AbortSignal
    const result = await answerQuestionStream(
      question,
      (chunk: string) => {
        process.stdout.write(chunk);
        fullAnswer += chunk;
      },
      abortController.signal
    );
    
    console.log('\n\n📊 Service Result:');
    console.log('='.repeat(40));
    console.log(`✨ Answer: ${result.answer}`);
    console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`📚 Source ID: ${result.sourceId || 'None'}`);
    console.log(`⏰ Timestamp: ${result.timestamp}`);
    console.log(`📝 Streamed: "${fullAnswer}"`);
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log('\n⚠️  Request was cancelled');
    } else {
      console.error('\n❌ Error:', error);
    }
  }
}

/**
 * Test cancellation functionality
 */
async function testServiceCancellation() {
  const question = "Erkläre mir alle Details über Sunrise Services";
  const abortController = new AbortController();
  
  // Cancel after 1 second
  setTimeout(() => {
    console.log('\n⏰ Cancelling request...');
    abortController.abort();
  }, 1000);
  
  console.log(`🧪 Testing cancellation: "${question}"\n`);
  console.log('🔄 Streaming response (will be cancelled):\n');
  
  try {
    await answerQuestionStream(
      question,
      (chunk: string) => {
        process.stdout.write(chunk);
      },
      abortController.signal
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log('\n✅ Successfully cancelled the stream');
    } else {
      console.error('\n❌ Unexpected error:', error);
    }
  }
}

/**
 * Test service wrapper benefits (caching, guardrails, etc.)
 */
async function testServiceFeatures() {
  console.log('🧪 Testing service wrapper features:\n');
  
  // Test 1: Sensitive content detection
  console.log('1. Testing sensitive content detection:');
  try {
    await answerQuestionStream(
      "Kann ich deine persönlichen Daten haben?",
      (chunk: string) => process.stdout.write(chunk)
    );
  } catch (error) {
    console.error('Error:', error);
  }
  
  console.log('\n\n2. Testing normal question:');
  // Test 2: Normal question
  try {
    await answerQuestionStream(
      "Wie erreiche ich den Kundenservice?",
      (chunk: string) => process.stdout.write(chunk)
    );
  } catch (error) {
    console.error('Error:', error);
  }
  
  console.log('\n\n3. Testing cached response (run twice):');
  // Test 3: Caching (run the same question twice)
  for (let i = 1; i <= 2; i++) {
    console.log(`\n   Run ${i}:`);
    try {
      await answerQuestionStream(
        "Was kostet eine Rufnummernportierung?",
        (chunk: string) => process.stdout.write(chunk)
      );
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('🚀 Starting Service Wrapper Tests...\n');
    
    console.log('='.repeat(60));
    console.log('Test 1: Basic Streaming');
    console.log('='.repeat(60));
    await testServiceWrapper();
    
    console.log('\n' + '='.repeat(60));
    console.log('Test 2: Cancellation Support');
    console.log('='.repeat(60));
    await testServiceCancellation();
    
    console.log('\n' + '='.repeat(60));
    console.log('Test 3: Service Features (Guardrails, Caching)');
    console.log('='.repeat(60));
    await testServiceFeatures();
    
    console.log('\n\n🎉 All service wrapper tests completed!');
    
  } catch (error) {
    console.error('\n\n💥 Test failed:', error);
    process.exit(1);
  }
}

export { testServiceWrapper, testServiceCancellation, testServiceFeatures, runTests };
