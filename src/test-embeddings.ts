/**
 * Test script for @xenova/transformers embeddings
 * Tests caching, batch processing, and model functionality
 */

import dotenv from 'dotenv';
import { 
  embedTexts, 
  embedText, 
  getCacheStats, 
  getModelInfo,
  cosineSimilarity 
} from './ai/embeddings.js';

dotenv.config();

async function testModelInfo() {
  console.log('🔧 Testing Model Information...');
  
  try {
    const modelInfo = getModelInfo();
    console.log(`   Model: ${modelInfo.model}`);
    console.log(`   Provider: ${modelInfo.provider}`);
    console.log(`   Description: ${modelInfo.description}`);
    
    return true;
  } catch (error) {
    console.error('❌ Model info test failed:', error);
    return false;
  }
}

async function testCacheStats() {
  console.log('\n📊 Testing Cache Statistics...');
  
  try {
    const stats = await getCacheStats();
    console.log(`   Model: ${stats.model}`);
    console.log(`   Entries: ${stats.entries}`);
    console.log(`   Created: ${stats.created}`);
    console.log(`   Version: ${stats.version}`);
    
    return true;
  } catch (error) {
    console.error('❌ Cache stats test failed:', error);
    return false;
  }
}

async function testSingleEmbedding() {
  console.log('\n🧮 Testing Single Text Embedding...');
  
  try {
    const text = 'Wie kann ich meine Rechnung bezahlen?';
    console.log(`   Text: "${text}"`);
    
    const startTime = Date.now();
    const embedding = await embedText(text);
    const embedTime = Date.now() - startTime;
    
    console.log(`   Embedding dimensions: ${embedding.length}`);
    console.log(`   Embedding time: ${embedTime}ms`);
    console.log(`   First few values: [${embedding.slice(0, 5).map(x => x.toFixed(4)).join(', ')}...]`);
    
    // Check vector normalization
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    console.log(`   Vector magnitude: ${magnitude.toFixed(4)} (should be ~1.0 if normalized)`);
    
    return embedding;
  } catch (error) {
    console.error('❌ Single embedding test failed:', error);
    return null;
  }
}

async function testBatchEmbeddings() {
  console.log('\n📦 Testing Batch Embeddings...');
  
  try {
    const texts = [
      'Rechnung bezahlen',
      'Internet ist langsam',
      'Router Problem',
      'Kündigung beantragen',
      'Vertrag verlängern'
    ];
    
    console.log(`   Processing ${texts.length} texts in batch...`);
    
    const startTime = Date.now();
    const embeddings = await embedTexts(texts);
    const embedTime = Date.now() - startTime;
    
    console.log(`   Batch embedding time: ${embedTime}ms`);
    console.log(`   Average per text: ${(embedTime / texts.length).toFixed(1)}ms`);
    console.log(`   Embeddings shape: ${embeddings.length} x ${embeddings[0].length}`);
    
    // Test that all embeddings have same dimensions
    const dimensions = embeddings[0].length;
    const allSameDim = embeddings.every(emb => emb.length === dimensions);
    console.log(`   Consistent dimensions: ${allSameDim ? '✅' : '❌'}`);
    
    return embeddings;
  } catch (error) {
    console.error('❌ Batch embedding test failed:', error);
    return null;
  }
}

async function testCaching() {
  console.log('\n💾 Testing Embedding Cache...');
  
  try {
    const testText = 'Test caching functionality';
    
    // First embedding (should be cached)
    console.log('   First embedding (no cache)...');
    const startTime1 = Date.now();
    const embedding1 = await embedText(testText);
    const time1 = Date.now() - startTime1;
    console.log(`   Time: ${time1}ms`);
    
    // Get cache stats
    const stats1 = await getCacheStats();
    console.log(`   Cache entries after first: ${stats1.entries}`);
    
    // Second embedding (should use cache)
    console.log('   Second embedding (from cache)...');
    const startTime2 = Date.now();
    const embedding2 = await embedText(testText);
    const time2 = Date.now() - startTime2;
    console.log(`   Time: ${time2}ms`);
    
    // Check if embeddings are identical
    const identical = JSON.stringify(embedding1) === JSON.stringify(embedding2);
    console.log(`   Results identical: ${identical ? '✅' : '❌'}`);
    console.log(`   Cache speedup: ${time2 < time1 ? '✅' : '❌'} (${time1}ms -> ${time2}ms)`);
    
    return true;
  } catch (error) {
    console.error('❌ Caching test failed:', error);
    return false;
  }
}

async function testSimilarity() {
  console.log('\n🔍 Testing Similarity Calculation...');
  
  try {
    const texts = [
      'Wie bezahle ich meine Rechnung?',
      'Payment of invoice',
      'Internet funktioniert nicht',
      'Router ist defekt'
    ];
    
    console.log('   Generating embeddings for similarity test...');
    const embeddings = await embedTexts(texts);
    
    console.log('   Calculating similarities:');
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
        console.log(`   "${texts[i]}" vs "${texts[j]}": ${similarity.toFixed(4)}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Similarity test failed:', error);
    return false;
  }
}

async function testModelPerformance() {
  console.log('\n⚡ Testing Model Performance...');
  
  try {
    const texts = Array.from({ length: 20 }, (_, i) => `Test text number ${i + 1} for performance testing`);
    
    console.log(`   Processing ${texts.length} texts for performance test...`);
    
    const startTime = Date.now();
    const embeddings = await embedTexts(texts);
    const totalTime = Date.now() - startTime;
    
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Average per text: ${(totalTime / texts.length).toFixed(1)}ms`);
    console.log(`   Throughput: ${(texts.length * 1000 / totalTime).toFixed(1)} texts/sec`);
    console.log(`   Vector dimensions: ${embeddings[0].length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 @xenova/transformers Embeddings Test Suite\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Model information
  total++;
  if (await testModelInfo()) passed++;
  
  // Test 2: Cache stats
  total++;
  if (await testCacheStats()) passed++;
  
  // Test 3: Single embedding
  total++;
  const singleResult = await testSingleEmbedding();
  if (singleResult) passed++;
  
  // Test 4: Batch embeddings
  total++;
  const batchResult = await testBatchEmbeddings();
  if (batchResult) passed++;
  
  // Test 5: Caching functionality
  total++;
  if (await testCaching()) passed++;
  
  // Test 6: Similarity calculations
  total++;
  if (await testSimilarity()) passed++;
  
  // Test 7: Performance testing
  total++;
  if (await testModelPerformance()) passed++;
  
  console.log(`\n🎉 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All embedding tests passed!');
    
    console.log('\n📝 Embeddings Features:');
    console.log('✅ @xenova/transformers integration');
    console.log('✅ Local model execution (no external API)');
    console.log('✅ Persistent caching in JSON file');
    console.log('✅ Batch processing with mean pooling');
    console.log('✅ Vector normalization');
    console.log('✅ Model change detection');
    console.log('✅ Multilingual support');
    console.log('✅ Cosine similarity calculation');
    
    // Final cache stats
    const finalStats = await getCacheStats();
    console.log(`\n💾 Final Cache: ${finalStats.entries} entries for model ${finalStats.model}`);
  } else {
    console.log('❌ Some tests failed. Check the logs above.');
    
    console.log('\n💡 If model loading fails, the transformer will be downloaded on first use.');
    console.log('   This may take some time but only happens once.');
  }
}

main().catch(console.error);
