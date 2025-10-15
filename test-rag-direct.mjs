#!/usr/bin/env node
import { ragLocalAnswer } from './src/ai/rag.local.js';

async function testRagDirectly() {
  console.log('🔬 Testing RAG function directly...\n');

  const question = "Was ist die Lieblingsfarbe von Roman?";
  console.log(`❓ Question: ${question}\n`);

  try {
    const result = await ragLocalAnswer(question, 3);
    
    console.log('✅ Result:');
    console.log(`📝 Answer: ${result.answer}`);
    console.log(`🎯 Confidence: ${result.confidence.toFixed(3)}`);
    console.log(`📚 Source IDs (${result.sourceIds.length}):`);
    result.sourceIds.forEach((id, idx) => {
      console.log(`   ${idx + 1}. ${id}`);
    });
    console.log(`🌐 Source: ${result.source || 'N/A'}`);
    console.log(`🤖 Model: ${result.modelUsed || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRagDirectly();
