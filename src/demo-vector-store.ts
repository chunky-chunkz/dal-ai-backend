/**
 * Demonstration of Vector Store usage
 * Shows how to build an index and perform searches
 */

import dotenv from 'dotenv';
import { vectorStore } from './ai/vectorStore.js';
import { faqsRepository } from './repos/faqs.repo.js';

dotenv.config();

async function demonstrateVectorStore() {
  console.log('🚀 Vector Store Demonstration\n');

  try {
    // 1. Load FAQs
    console.log('📚 Loading FAQs...');
    const faqs = faqsRepository.list();
    console.log(`   Loaded ${faqs.length} FAQs`);

    // 2. Check if index exists
    console.log('\n🔍 Checking existing index...');
    const indexInfo = await vectorStore.getIndexInfo();
    if (indexInfo.exists) {
      console.log(`   ✅ Index exists: ${indexInfo.entries} entries, model: ${indexInfo.model}`);
      console.log(`   📅 Created: ${indexInfo.created}`);
    } else {
      console.log('   ❌ No index found');
    }

    // 3. Build index if needed (or force rebuild with small subset for demo)
    console.log('\n🏗️  Building vector index...');
    const demoFaqs = faqs.slice(0, 5); // Just use first 5 FAQs for demo
    await vectorStore.buildIndex(demoFaqs, {
      useTitle: true,
      forceRebuild: true // Force rebuild for demo
    });

    // 4. Demonstrate searches
    console.log('\n🔍 Performing similarity searches...');
    
    const queries = [
      'Wie bezahle ich meine Rechnung?',
      'Internet langsam',
      'Router funktioniert nicht'
    ];

    for (const query of queries) {
      console.log(`\n❓ Query: "${query}"`);
      const results = await vectorStore.search(query, 3);
      
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. [Score: ${result.score.toFixed(3)}] ${result.id}`);
        console.log(`      Title: ${result.metadata?.title || 'No title'}`);
        console.log(`      Text: ${result.text.substring(0, 100)}...`);
      });
    }

    // 5. Show index statistics
    console.log('\n📊 Vector Store Statistics:');
    const finalInfo = await vectorStore.getIndexInfo();
    console.log(`   Entries: ${finalInfo.entries}`);
    console.log(`   Model: ${finalInfo.model}`);
    console.log(`   Version: ${finalInfo.version}`);
    console.log(`   Created: ${finalInfo.created}`);

    console.log('\n✅ Vector Store demonstration completed successfully!');

  } catch (error) {
    console.error('\n❌ Demonstration failed:', error);
    
    if (error instanceof Error && error.message.includes('not available')) {
      console.log('\n💡 To fix this issue:');
      console.log('   1. Make sure Ollama is running: ollama serve');
      console.log('   2. Pull the embedding model: ollama pull nomic-embed-text');
      console.log('   3. Verify model is available: ollama list');
    }
  }
}

// Run demonstration
demonstrateVectorStore();
