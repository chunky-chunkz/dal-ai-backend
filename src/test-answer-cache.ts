/**
 * Test suite for answer cache with TTL
 * Tests caching, normalization, TTL expiration, and statistics
 */

import dotenv from 'dotenv';
import * as cache from './utils/answerCache.js';

dotenv.config();

async function testNormalization() {
  console.log('🔧 Testing Key Normalization...');
  
  try {
    // Test different variations of the same question
    const question1 = 'Wie bezahle ich meine Rechnung?';
    const question2 = 'WIE   BEZAHLE   ICH   MEINE  RECHNUNG?';
    const question3 = '  wie bezahle ich meine rechnung?  ';
    
    const testAnswer = {
      answer: 'Sie können Ihre Rechnung online bezahlen.',
      confidence: 0.85,
      sourceId: 'rechnung-bezahlen'
    };
    
    // Put answer with first variation
    cache.put(question1, testAnswer);
    console.log('   Stored answer for:', `"${question1}"`);
    
    // Try to retrieve with different variations
    const result1 = cache.get(question1);
    const result2 = cache.get(question2);
    const result3 = cache.get(question3);
    
    const allMatch = result1 && result2 && result3 && 
                    result1.answer === result2.answer && 
                    result2.answer === result3.answer;
    
    console.log('   Question variations match:', allMatch ? '✅' : '❌');
    console.log('   Normalized key works for all variations');
    
    return allMatch;
  } catch (error) {
    console.error('❌ Normalization test failed:', error);
    return false;
  }
}

async function testTTL() {
  console.log('\n⏰ Testing TTL Expiration...');
  
  try {
    const question = 'Test TTL question';
    const testAnswer = {
      answer: 'This will expire soon.',
      confidence: 0.75
    };
    
    // Store with very short TTL (100ms)
    cache.put(question, testAnswer, 100);
    console.log('   Stored answer with 100ms TTL');
    
    // Should be available immediately
    const immediate = cache.get(question);
    console.log('   Immediate retrieval:', immediate ? '✅' : '❌');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should be expired now
    const expired = cache.get(question);
    console.log('   After expiration:', expired === null ? '✅' : '❌');
    
    return immediate !== null && expired === null;
  } catch (error) {
    console.error('❌ TTL test failed:', error);
    return false;
  }
}

async function testBasicCaching() {
  console.log('\n📦 Testing Basic Cache Operations...');
  
  try {
    // Clear cache first
    cache.clear();
    console.log('   Cache cleared');
    
    const question = 'What is the payment process?';
    const answer = {
      answer: 'You can pay online or by bank transfer.',
      confidence: 0.92,
      sourceId: 'payment-info'
    };
    
    // Test cache miss
    const miss = cache.get(question);
    console.log('   Cache miss (empty cache):', miss === null ? '✅' : '❌');
    
    // Store answer
    cache.put(question, answer);
    console.log('   Answer stored in cache');
    
    // Test cache hit
    const hit = cache.get(question);
    const hitMatch = hit && 
                    hit.answer === answer.answer &&
                    hit.confidence === answer.confidence &&
                    hit.sourceId === answer.sourceId;
    console.log('   Cache hit (correct data):', hitMatch ? '✅' : '❌');
    
    // Test has() method
    const hasResult = cache.has(question);
    console.log('   has() method works:', hasResult ? '✅' : '❌');
    
    return miss === null && hitMatch && hasResult;
  } catch (error) {
    console.error('❌ Basic caching test failed:', error);
    return false;
  }
}

async function testCacheStats() {
  console.log('\n📊 Testing Cache Statistics...');
  
  try {
    // Clear cache and reset stats
    cache.clear();
    cache.resetStats();
    
    const questions = [
      'How to reset password?',
      'What are the business hours?',
      'How to cancel subscription?'
    ];
    
    const answers = questions.map((_, i) => ({
      answer: `Answer for question ${i + 1}`,
      confidence: 0.8 + (i * 0.05),
      sourceId: `source-${i + 1}`
    }));
    
    // Store answers
    questions.forEach((q, i) => cache.put(q, answers[i]));
    console.log(`   Stored ${questions.length} answers`);
    
    // Generate some hits and misses
    cache.get(questions[0]); // hit
    cache.get(questions[1]); // hit
    cache.get('Non-existent question'); // miss
    cache.get(questions[2]); // hit
    cache.get('Another miss'); // miss
    
    const stats = cache.getStats();
    console.log('   Stats:', stats);
    console.log('   Entries:', stats.entries === 3 ? '✅' : '❌');
    console.log('   Hits:', stats.hits === 3 ? '✅' : '❌');
    console.log('   Misses:', stats.misses === 2 ? '✅' : '❌');
    console.log('   Hit Rate:', stats.hitRate === 0.6 ? '✅' : '❌');
    
    const statsValid = stats.entries === 3 && 
                      stats.hits === 3 && 
                      stats.misses === 2 && 
                      stats.hitRate === 0.6;
    
    return statsValid;
  } catch (error) {
    console.error('❌ Stats test failed:', error);
    return false;
  }
}

async function testCacheEviction() {
  console.log('\n🗑️  Testing Cache Eviction...');
  
  try {
    cache.clear();
    
    // Add entries that will expire
    const expiredQuestions = [
      'Expired question 1',
      'Expired question 2'
    ];
    
    // Add with short TTL
    expiredQuestions.forEach(q => {
      cache.put(q, { answer: 'Will expire', confidence: 0.5 }, 50);
    });
    
    // Add entry with long TTL
    cache.put('Long lasting question', { answer: 'Will persist', confidence: 0.8 }, 10000);
    
    console.log('   Initial size:', cache.size());
    
    // Wait for some to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Access cache to trigger cleanup
    cache.get('Long lasting question');
    
    const finalSize = cache.size();
    console.log('   Size after eviction:', finalSize);
    
    const stats = cache.getStats();
    console.log('   Evictions:', stats.evictions);
    
    // Should have 1 entry left and some evictions
    const evictionWorked = finalSize === 1 && stats.evictions > 0;
    console.log('   Eviction successful:', evictionWorked ? '✅' : '❌');
    
    return evictionWorked;
  } catch (error) {
    console.error('❌ Eviction test failed:', error);
    return false;
  }
}

async function testPerformance() {
  console.log('\n⚡ Testing Cache Performance...');
  
  try {
    cache.clear();
    
    const testAnswer = {
      answer: 'Performance test answer',
      confidence: 0.85,
      sourceId: 'perf-test'
    };
    
    // Store answer
    cache.put('Performance question', testAnswer);
    
    // Time multiple cache hits
    const iterations = 10000;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      cache.get('Performance question');
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    
    console.log(`   ${iterations} cache hits in ${endTime - startTime}ms`);
    console.log(`   Average time per hit: ${avgTime.toFixed(4)}ms`);
    
    const performanceGood = avgTime < 0.1; // Should be very fast
    console.log('   Performance acceptable:', performanceGood ? '✅' : '❌');
    
    return performanceGood;
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Answer Cache Test Suite\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Basic caching
  total++;
  if (await testBasicCaching()) passed++;
  
  // Test 2: Key normalization
  total++;
  if (await testNormalization()) passed++;
  
  // Test 3: TTL expiration
  total++;
  if (await testTTL()) passed++;
  
  // Test 4: Cache statistics
  total++;
  if (await testCacheStats()) passed++;
  
  // Test 5: Cache eviction
  total++;
  if (await testCacheEviction()) passed++;
  
  // Test 6: Performance
  total++;
  if (await testPerformance()) passed++;
  
  console.log(`\n🎉 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All cache tests passed!');
    
    console.log('\n📝 Answer Cache Features:');
    console.log('✅ In-memory caching with TTL');
    console.log('✅ Question normalization (case, whitespace)');
    console.log('✅ Automatic expiration and cleanup');
    console.log('✅ Comprehensive statistics tracking');
    console.log('✅ High performance (sub-millisecond access)');
    console.log('✅ Memory efficient with automatic eviction');
    
    // Final stats
    const finalStats = cache.getStats();
    console.log(`\n💾 Final Cache State: ${finalStats.entries} entries, ${finalStats.hits} hits, ${finalStats.misses} misses (${Math.round(finalStats.hitRate * 100)}% hit rate)`);
  } else {
    console.log('❌ Some cache tests failed. Check the logs above.');
  }
}

main().catch(console.error);
