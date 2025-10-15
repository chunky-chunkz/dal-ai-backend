#!/usr/bin/env node

// Simple test to see if LLM is responding
import { localLLM } from './src/ai/localLLM.js';

async function testLLM() {
  console.log('🧪 Testing LLM connection...\n');

  try {
    const response = await localLLM({
      model: 'phi3:mini',
      prompt: 'Hallo, bist du da? Antworte mit JA oder NEIN.',
      stream: false
    });

    console.log('✅ LLM Response:');
    console.log(response.response);
    console.log('\n✅ LLM is working!');

  } catch (error) {
    console.error('❌ LLM Error:', error.message);
    console.error('\nℹ️  Make sure Ollama is running: ollama serve');
    console.error('ℹ️  And phi3:mini model is pulled: ollama pull phi3:mini');
  }
}

testLLM();
