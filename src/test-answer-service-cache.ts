/**
 * Test the answer service with caching integration
 * Verifies that cache is used properly before calling RAG
 */

import dotenv from 'dotenv';
import { answerQuestion, answerQuestionStream } from './services/answer.service.js';
import * as cache from './utils/answerCache.js';

dotenv.config();

async function testAnswerServiceCaching() {
  console.log('🚀 Answer Service Cache Integration Test\n');
  
  try {
    // Clear cache first
    cache.clear();
    cache.resetStats();
    console.log('🧹 Cache cleared and stats reset');
    
    const testQuestion = 'Wie bezahle ich meine Rechnung?';
    
    // First call - should miss cache and use RAG
    console.log('\n1️⃣ First call (cache miss, uses RAG):');
    const startTime1 = Date.now();
    const result1 = await answerQuestion(testQuestion);
    const time1 = Date.now() - startTime1;
    
    console.log(`   Answer: ${result1.answer.substring(0, 80)}...`);
    console.log(`   Confidence: ${result1.confidence}`);
    console.log(`   Source ID: ${result1.sourceId}`);
    console.log(`   Response time: ${time1}ms`);
    
    // Check cache stats after first call
    const stats1 = cache.getStats();
    console.log(`   Cache stats: ${stats1.hits} hits, ${stats1.misses} misses, ${stats1.entries} entries`);
    
    // Second call - should hit cache
    console.log('\n2️⃣ Second call (cache hit, no RAG):');
    const startTime2 = Date.now();
    const result2 = await answerQuestion(testQuestion);
    const time2 = Date.now() - startTime2;
    
    console.log(`   Answer: ${result2.answer.substring(0, 80)}...`);
    console.log(`   Confidence: ${result2.confidence}`);
    console.log(`   Source ID: ${result2.sourceId}`);
    console.log(`   Response time: ${time2}ms`);
    
    // Check cache stats after second call
    const stats2 = cache.getStats();
    console.log(`   Cache stats: ${stats2.hits} hits, ${stats2.misses} misses, ${stats2.entries} entries`);
    
    // Verify results are identical (except timestamp)
    const resultsMatch = result1.answer === result2.answer &&
                        result1.confidence === result2.confidence &&
                        result1.sourceId === result2.sourceId;
    
    console.log('\n✅ Results Analysis:');
    console.log(`   Results identical: ${resultsMatch ? '✅' : '❌'}`);
    console.log(`   Second call faster: ${time2 < time1 ? '✅' : '❌'} (${time1}ms → ${time2}ms)`);
    console.log(`   Cache hit rate: ${Math.round(stats2.hitRate * 100)}%`);
    console.log(`   Cache working: ${stats2.hits > stats1.hits ? '✅' : '❌'}`);
    
    return resultsMatch && time2 < time1 && stats2.hits > stats1.hits;
    
  } catch (error) {
    console.error('❌ Answer service cache test failed:', error);
    return false;
  }
}

async function testStreamingWithCache() {
  console.log('\n🌊 Testing Streaming with Cache...');
  
  try {
    const testQuestion = 'Was sind die Geschäftszeiten?';
    let streamedContent1 = '';
    let streamedContent2 = '';
    
    // First streaming call (cache miss)
    console.log('   First streaming call (cache miss):');
    const startTime1 = Date.now();
    const result1 = await answerQuestionStream(testQuestion, (chunk) => {
      streamedContent1 += chunk;
    });
    const time1 = Date.now() - startTime1;
    console.log(`     Streamed ${streamedContent1.length} characters in ${time1}ms`);
    
    // Second streaming call (cache hit - streams cached content)
    console.log('   Second streaming call (cache hit):');
    const startTime2 = Date.now();
    const result2 = await answerQuestionStream(testQuestion, (chunk) => {
      streamedContent2 += chunk;
    });
    const time2 = Date.now() - startTime2;
    console.log(`     Streamed ${streamedContent2.length} characters in ${time2}ms`);
    
    const resultsMatch = result1.answer === result2.answer &&
                        result1.confidence === result2.confidence;
    
    const contentMatch = streamedContent1 === streamedContent2;
    
    console.log(`     Results identical: ${resultsMatch ? '✅' : '❌'}`);
    console.log(`     Streamed content identical: ${contentMatch ? '✅' : '❌'}`);
    console.log(`     Cache provides consistent streaming: ${resultsMatch && contentMatch ? '✅' : '❌'}`);
    
    return resultsMatch && contentMatch;
    
  } catch (error) {
    console.error('❌ Streaming cache test failed:', error);
    return false;
  }
}

async function testCacheNormalization() {
  console.log('\n🔧 Testing Cache Key Normalization...');
  
  try {
    const questions = [
      'Router Problem',
      'ROUTER   PROBLEM',
      '  router problem  ',
      'Router problem?'
    ];
    
    // Get answer for first question
    const result1 = await answerQuestion(questions[0]);
    const initialStats = cache.getStats();
    
    // Try other variations
    let allHits = true;
    for (let i = 1; i < questions.length; i++) {
      const result = await answerQuestion(questions[i]);
      if (result.answer !== result1.answer) {
        allHits = false;
        break;
      }
    }
    
    const finalStats = cache.getStats();
    const additionalHits = finalStats.hits - initialStats.hits;
    
    console.log(`   Question variations tested: ${questions.length}`);
    console.log(`   Additional cache hits: ${additionalHits}/${questions.length - 1}`);
    console.log(`   Normalization working: ${allHits && additionalHits === questions.length - 1 ? '✅' : '❌'}`);
    
    return allHits && additionalHits === questions.length - 1;
    
  } catch (error) {
    console.error('❌ Normalization test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing Answer Service with Cache Integration\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Basic caching
  total++;
  if (await testAnswerServiceCaching()) passed++;
  
  // Test 2: Streaming with cache
  total++;
  if (await testStreamingWithCache()) passed++;
  
  // Test 3: Normalization
  total++;
  if (await testCacheNormalization()) passed++;
  
  console.log(`\n🎉 Integration Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All integration tests passed!');
    
    console.log('\n📝 Cache Integration Features:');
    console.log('✅ Cache-first answer retrieval');
    console.log('✅ Automatic RAG result caching (1 hour TTL)');
    console.log('✅ Consistent streaming behavior with cache');
    console.log('✅ Question normalization across variations');
    console.log('✅ Performance improvement on repeated queries');
    console.log('✅ Transparent integration (no API changes)');
    
    // Final cache statistics
    const finalStats = cache.getStats();
    console.log(`\n💾 Final Cache Statistics:`);
    console.log(`   Total entries: ${finalStats.entries}`);
    console.log(`   Cache hits: ${finalStats.hits}`);
    console.log(`   Cache misses: ${finalStats.misses}`);
    console.log(`   Hit rate: ${Math.round(finalStats.hitRate * 100)}%`);
    console.log(`   Evictions: ${finalStats.evictions}`);
    
  } else {
    console.log('❌ Some integration tests failed. Cache may not be working properly.');
  }
}

main().catch(console.error);
