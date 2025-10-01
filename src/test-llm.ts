/**
 * Simple test script for localLLM wrapper
 */

import dotenv from 'dotenv';
import { localLLM } from './ai/localLLM.js';

// Load environment variables
dotenv.config();

async function testLocalLLM() {
  const model = process.env.LLM_MODEL || 'phi3:mini';
  
  console.log('🤖 Testing Local LLM Integration...');
  console.log(`📦 Using model: ${model}`);
  console.log(`🌐 Ollama URL: ${process.env.OLLAMA_URL}`);
  
  try {
    // Test 1: Check if model is available
    console.log('\n1️⃣ Checking model availability...');
    const isAvailable = await localLLM.isModelAvailable(model);
    console.log(`✅ Model ${model} available: ${isAvailable}`);
    
    if (!isAvailable) {
      console.log('❌ Model not available. Please ensure phi3:mini is installed.');
      return;
    }

    // Test 2: List available models
    console.log('\n2️⃣ Listing available models...');
    const models = await localLLM.listModels();
    console.log('📋 Available models:', models);

    // Test 3: Basic generation test
    console.log('\n3️⃣ Testing basic generation...');
    const response = await localLLM.generate({
      model,
      prompt: 'What is the capital of Germany?',
      system: 'You are a helpful assistant. Answer briefly and accurately.',
      temperature: 0.1,
      maxTokens: 50
    });
    console.log('💬 Response:', response);

    // Test 4: Streaming test
    console.log('\n4️⃣ Testing streaming generation...');
    console.log('💭 Streaming response: ', { newline: false });
    
    const streamResponse = await localLLM.stream({
      model,
      prompt: 'Explain what AI is in one sentence.',
      system: 'Be concise and clear.',
      temperature: 0.1,
      maxTokens: 80,
      onToken: (chunk) => {
        process.stdout.write(chunk);
      }
    });
    
    console.log('\n📝 Full response:', streamResponse);

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run tests
testLocalLLM().catch(console.error);
