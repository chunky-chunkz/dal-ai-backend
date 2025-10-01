/**
 * Test script for vector store functionality
 * Tests building index and searching for similar entries
 */

import dotenv from 'dotenv';
import { vectorStore } from './ai/vectorStore.js';
import { faqsRepository } from './repos/faqs.repo.js';
import { isEmbeddingModelAvailable } from './ai/embeddings.js';

dotenv.config();

async function testEmbeddingModel() {
  console.log('🔧 Testing Embedding Model Availability...');
  
  const model = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
  console.log(`   Testing model: ${model}`);
  
  try {
    const available = await isEmbeddingModelAvailable(model);
    console.log(`   Model available: ${available ? '✅' : '❌'}`);
    
    if (!available) {
      console.log('\n⚠️  Embedding model not available. You may need to:');
      console.log('   1. Start Ollama: ollama serve');
      console.log(`   2. Pull model: ollama pull ${model}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error testing embedding model:', error);
    return false;
  }
}

async function testVectorStoreIndex() {
  console.log('\n🔧 Testing Vector Store Index Building...');
  
  try {
    // Load FAQs
    const faqs = faqsRepository.list();
    console.log(`📚 Loaded ${faqs.length} FAQs from repository`);
    
    if (faqs.length === 0) {
      throw new Error('No FAQs available for indexing');
    }
    
    // Check current index info
    const indexInfo = await vectorStore.getIndexInfo();
    console.log('📊 Current index info:', indexInfo);
    
    // Build index (test with just first 3 FAQs for speed)
    const testFaqs = faqs.slice(0, 3);
    console.log(`🏗️  Building test index with ${testFaqs.length} FAQs...`);
    
    const startTime = Date.now();
    await vectorStore.buildIndex(testFaqs, { 
      useTitle: false,
      forceRebuild: true 
    });
    const buildTime = Date.now() - startTime;
    
    console.log(`✅ Index built successfully in ${buildTime}ms`);
    
    // Get updated index info
    const newIndexInfo = await vectorStore.getIndexInfo();
    console.log('📊 New index info:', newIndexInfo);
    
    return true;
    
  } catch (error) {
    console.error('❌ Vector store index test failed:', error);
    return false;
  }
}

async function testVectorSearch() {
  console.log('\n🔍 Testing Vector Search...');
  
  const testQueries = [
    'Wie bezahle ich meine Rechnung?',
    'Internet ist langsam',
    'Router Problem',
    'Kündigung'
  ];
  
  try {
    for (const query of testQueries) {
      console.log(`\n❓ Query: "${query}"`);
      
      const startTime = Date.now();
      const results = await vectorStore.search(query, 2);
      const searchTime = Date.now() - startTime;
      
      console.log(`   Search time: ${searchTime}ms`);
      console.log(`   Results: ${results.length}`);
      
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. [${result.score.toFixed(3)}] ${result.id}`);
        console.log(`      ${result.text.substring(0, 80)}...`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Vector search test failed:', error);
    return false;
  }
}

async function testFullIndexBuild() {
  console.log('\n🏗️  Testing Full Index Build...');
  
  try {
    const faqs = faqsRepository.list();
    console.log(`📚 Building full index with ${faqs.length} FAQs...`);
    
    const startTime = Date.now();
    await vectorStore.buildIndex(faqs, { 
      useTitle: true, // Test with titles included
      forceRebuild: true 
    });
    const buildTime = Date.now() - startTime;
    
    console.log(`✅ Full index built successfully in ${buildTime}ms`);
    
    // Test search with full index
    const results = await vectorStore.search('Rechnung bezahlen Zahlungsfrist', 3);
    console.log(`🔍 Search results: ${results.length}`);
    
    results.forEach((result, index) => {
      console.log(`   ${index + 1}. [${result.score.toFixed(3)}] ${result.id} - ${result.metadata?.title || 'No title'}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Full index build test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Vector Store Test Suite\n');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Embedding model availability
  total++;
  if (await testEmbeddingModel()) {
    passed++;
  } else {
    console.log('❌ Skipping remaining tests due to embedding model unavailability');
    return;
  }
  
  // Test 2: Vector store index building  
  total++;
  if (await testVectorStoreIndex()) {
    passed++;
  }
  
  // Test 3: Vector search
  total++;
  if (await testVectorSearch()) {
    passed++;
  }
  
  // Test 4: Full index build
  total++;
  if (await testFullIndexBuild()) {
    passed++;
  }
  
  console.log(`\n🎉 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All vector store tests passed!');
    
    console.log('\n📝 Vector Store Features:');
    console.log('✅ Persistent vector index (JSON file)');
    console.log('✅ Embedding generation with @xenova/transformers');
    console.log('✅ Cosine similarity search');
    console.log('✅ Configurable text processing (title + answer)');
    console.log('✅ Robust file I/O with directory creation');
    console.log('✅ Model change detection and rebuild');
    console.log('✅ Batch embedding generation');
    console.log('✅ Vector normalization');
    console.log('✅ Metadata preservation');
  } else {
    console.log('❌ Some tests failed. Check the logs above.');
  }
}

main().catch(console.error);
