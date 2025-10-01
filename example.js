#!/usr/bin/env node

/**
 * Example usage of the Chatbot API
 * 
 * This script demonstrates how to interact with the chatbot backend
 * Run with: npm run example
 */

import { createApp } from './src/app.js';

const questions = [
  'What is your refund policy?',
  'How long does shipping take?',
  'What payment methods do you accept?',
  'Can I track my order?',
  'Do you ship internationally?',
  'How do I create an account?',
  'What if I receive a damaged item?',
  'How much does express shipping cost?', // No direct match
  'xyz invalid question 123' // No match at all
];

async function demonstrateAPI() {
  console.log('🤖 Chatbot API Demonstration\n');
  console.log('=' .repeat(50));
  
  const app = await createApp();
  
  for (const question of questions) {
    console.log(`\n❓ Question: "${question}"`);
    console.log('-' .repeat(50));
    
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/answer',
        payload: { question }
      });
      
      const result = JSON.parse(response.body);
      const confidenceColor = result.confidence > 0.7 ? '🟢' : 
                             result.confidence > 0.4 ? '🟡' : '🔴';
      
      console.log(`${confidenceColor} Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`💬 Answer: ${result.answer}`);
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Demonstration complete!');
  
  await app.close();
}

demonstrateAPI().catch(console.error);
