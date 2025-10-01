/**
 * Quick test for the ragLocalAnswerStream implementation
 */

import { ragLocalAnswerStream } from './ai/rag.local.js';

async function testRagStream() {
  console.log('🚀 Testing RAG Local Answer Stream...');
  
  const question = "Wie kann ich meine Rechnung einsehen?";
  console.log(`Question: ${question}`);
  
  // Create an AbortController for testing cancellation
  const abortController = new AbortController();
  
  try {
    // Get the streaming result
    const streamResult = ragLocalAnswerStream(question, abortController.signal);
    
    console.log('\n📝 Streaming response:');
    console.log('---------------------');
    
    // Set up token callback
    streamResult.onToken((chunk: string) => {
      process.stdout.write(chunk);
    });
    
    // Wait for completion
    const finalResult = await streamResult.done();
    
    console.log('\n\n📊 Final Result:');
    console.log('================');
    console.log(`Answer: ${finalResult.answer}`);
    console.log(`Confidence: ${finalResult.confidence}`);
    console.log(`Source IDs: ${finalResult.sourceIds.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test cancellation
async function testRagStreamCancellation() {
  console.log('\n🛑 Testing cancellation...');
  
  const question = "What is the meaning of life?";
  const abortController = new AbortController();
  
  // Cancel after 100ms
  setTimeout(() => {
    console.log('⏰ Aborting request...');
    abortController.abort();
  }, 100);
  
  try {
    const streamResult = ragLocalAnswerStream(question, abortController.signal);
    
    streamResult.onToken((chunk: string) => {
      process.stdout.write(chunk);
    });
    
    await streamResult.done();
    console.log('\n❌ Should have been cancelled!');
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log('\n✅ Cancellation test passed!');
    } else {
      console.error('\n❌ Unexpected error:', error);
    }
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await testRagStream();
    await testRagStreamCancellation();
  })();
}

export { testRagStream, testRagStreamCancellation };
