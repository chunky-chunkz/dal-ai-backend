/**
 * Test the complete memory integration with the answer service
 */

import { answerQuestion } from './src/services/answer.service.js';

console.log('🧪 Testing Memory Integration with Answer Service\n');

const testCases = [
  {
    name: 'User preference statement',
    question: 'Ich trinke gerne Kaffee am Morgen',
    userId: 'test-user-coffee'
  },
  {
    name: 'Profile information',
    question: 'Ich arbeite als Software-Entwickler in Berlin',
    userId: 'test-user-profile'
  },
  {
    name: 'Question with memory suggestions',
    question: 'Was ist meine Lieblingsfarbe? Ich mag übrigens Blau sehr gerne.',
    userId: 'test-user-color'
  },
  {
    name: 'Normal question without memory',
    question: 'Wie ist das Wetter heute?',
    userId: 'test-user-weather'
  }
];

for (const testCase of testCases) {
  console.log(`\n📝 Testing: ${testCase.name}`);
  console.log(`Question: "${testCase.question}"`);
  console.log(`User ID: ${testCase.userId}`);
  
  try {
    const response = await answerQuestion(
      testCase.question,
      'test-session-' + Date.now(),
      '', // memoryContext - let the service handle it
      testCase.userId
    );
    
    console.log('✅ Response:');
    console.log(`  Answer: "${response.answer}"`);
    console.log(`  Confidence: ${response.confidence}`);
    
    // Check if memory suggestions are included
    if (response.answer.includes('(Ich kann mir merken:')) {
      console.log('💡 Memory suggestions detected in response!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

console.log('\n✅ Memory integration test completed!');
