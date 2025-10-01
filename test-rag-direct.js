/**
 * Test the RAG system directly to see confidence levels
 */
import { ragLocalAnswer } from './dist/ai/rag.local.js';

async function testRagDirectly() {
  console.log('🤖 Testing RAG system directly...');
  
  const testQuestions = [
    "EU-Roaming kostenlos?",
    "Router neu starten",
    "Rechnung bezahlen"
  ];
  
  for (const question of testQuestions) {
    console.log(`\n❓ Testing RAG with: "${question}"`);
    
    try {
      const result = await ragLocalAnswer(question, 3, "test-session");
      
      console.log(`✅ RAG Response:`);
      console.log(`   Answer: ${result.answer ? result.answer.substring(0, 100) : 'no answer'}...`);
      console.log(`   Confidence: ${result.confidence}`);
      console.log(`   Source IDs: ${result.sourceIds ? result.sourceIds.join(', ') : 'none'}`);
      console.log(`   Model Used: ${result.modelUsed || 'unknown'}`);
      
      if (result.confidence >= 0.55) {
        console.log('   ✅ Would pass confidence threshold (≥0.55)');
      } else {
        console.log('   ❌ Would fail confidence threshold (<0.55)');
      }
    } catch (error) {
      console.error(`❌ Error testing RAG: ${error.message}`);
    }
  }
}

testRagDirectly().catch(console.error);
