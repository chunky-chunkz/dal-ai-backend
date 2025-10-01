/**
 * Test the FAQ repository search directly
 */
import { FaqRepository } from './dist/repos/faq.repository.js';

async function testFaqSearch() {
  console.log('🔍 Testing FAQ repository search...');
  
  const faqRepo = new FaqRepository();
  
  const testQuestions = [
    "EU-Roaming kostenlos?",
    "Roaming-Gebühren",
    "Internet im Urlaub",
    "Router neu starten",
    "Rechnung bezahlen"
  ];
  
  for (const question of testQuestions) {
    console.log(`\n❓ Testing: "${question}"`);
    
    try {
      const results = await faqRepo.findByQuery(question);
      
      if (results.length > 0) {
        console.log(`✅ Found ${results.length} matches:`);
        for (const result of results) {
          console.log(`   - ${result.faq.id} (confidence: ${result.confidence.toFixed(3)})`);
          console.log(`     Answer: ${result.faq.answer.substring(0, 80)}...`);
        }
      } else {
        console.log('❌ No matches found');
      }
    } catch (error) {
      console.error(`❌ Error searching: ${error.message}`);
    }
  }
}

testFaqSearch().catch(console.error);
