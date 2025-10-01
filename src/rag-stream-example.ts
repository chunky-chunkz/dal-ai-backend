/**
 * Usage example for ragLocalAnswerStream
 * Shows how to use the RAG streaming orchestrator
 */

import { ragLocalAnswerStream } from './ai/rag.local.js';

/**
 * Example usage of the RAG streaming orchestrator
 */
async function exampleUsage() {
  const question = "Wie kann ich meine Rechnung bezahlen?";
  
  // Create abort controller for cancellation support
  const abortController = new AbortController();
  
  console.log(`🤔 Question: ${question}\n`);
  console.log('🔄 Streaming answer:\n');
  
  // Get the streaming result object
  const stream = ragLocalAnswerStream(question, abortController.signal);
  
  // Set up token streaming - this gets called for each chunk
  stream.onToken((chunk: string) => {
    process.stdout.write(chunk);
  });
  
  try {
    // Wait for completion and get final result
    const result = await stream.done();
    
    console.log('\n\n📊 Final Result:');
    console.log('================');
    console.log(`✨ Answer: ${result.answer}`);
    console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`📚 Sources: ${result.sourceIds.length > 0 ? result.sourceIds.join(', ') : 'None'}`);
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log('\n⚠️  Request was cancelled');
    } else {
      console.error('\n❌ Error:', error);
    }
  }
}

/**
 * Example with cancellation
 */
async function exampleWithCancellation() {
  const question = "Erkläre mir alle Details über Sunrise Services";
  const abortController = new AbortController();
  
  // Cancel after 2 seconds
  setTimeout(() => {
    console.log('\n⏰ Cancelling request...');
    abortController.abort();
  }, 2000);
  
  console.log(`🤔 Question: ${question}\n`);
  console.log('🔄 Streaming answer (will be cancelled):\n');
  
  const stream = ragLocalAnswerStream(question, abortController.signal);
  
  stream.onToken((chunk: string) => {
    process.stdout.write(chunk);
  });
  
  try {
    await stream.done();
  } catch (error) {
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log('\n✅ Successfully cancelled the stream');
    } else {
      console.error('\n❌ Unexpected error:', error);
    }
  }
}

export { exampleUsage, exampleWithCancellation };
