/**
 * Simple test script to run evaluations
 */

import { runSingleTurnEvaluation } from './dist/utils/eval.comprehensive.js';

async function testEvaluation() {
  console.log('🧪 Testing evaluation system...');
  
  try {
    const results = await runSingleTurnEvaluation();
    console.log('✅ Evaluation completed!');
    console.log(`Accuracy: ${results.accuracy}%`);
    console.log(`Fallback Rate: ${results.fallbackRate}%`);
    console.log(`P50 Response Time: ${results.p50ResponseTime}ms`);
  } catch (error) {
    console.error('❌ Evaluation failed:', error);
  }
}

testEvaluation();
