/**
 * Task: Health check for local LLM pipeline.
 * Steps:
 * - Check OLLAMA_URL reachable (HTTP GET /api/tags).
 * - Check model exists (env LLM_MODEL) in /api/tags; suggest 'ollama pull' if missing.
 * - Run 1-shot prompt "Antworte 'OK' auf Deutsch." -> expect "OK" in response.
 * - Exit non-zero on failure with helpful messages.
 */

import dotenv from 'dotenv';
import { localLLM } from '../ai/localLLM.js';

// Load environment variables
dotenv.config();

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    size: number;
    digest: string;
    details: {
      format: string;
      family: string;
      families?: string[];
      parameter_size: string;
      quantization_level: string;
    };
    modified_at: string;
  }>;
}

async function checkOllamaConnection(): Promise<boolean> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  
  console.log(`🔍 Checking Ollama connection at ${ollamaUrl}...`);
  
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    
    if (!response.ok) {
      console.error(`❌ Ollama API returned status ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const data = await response.json() as OllamaTagsResponse;
    console.log(`✅ Ollama is running and reachable`);
    console.log(`📋 Found ${data.models.length} models installed`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to connect to Ollama at ${ollamaUrl}`);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    console.error(`   💡 Make sure Ollama is installed and running:`);
    console.error(`      - Install: https://ollama.ai/download`);
    console.error(`      - Start: ollama serve`);
    return false;
  }
}

async function checkModelExists(): Promise<boolean> {
  const modelName = process.env.LLM_MODEL || 'phi3:mini';
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  
  console.log(`🔍 Checking if model '${modelName}' is available...`);
  
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    const data = await response.json() as OllamaTagsResponse;
    
    const modelExists = data.models.some(model => 
      model.name === modelName || model.name === `${modelName}:latest`
    );
    
    if (modelExists) {
      console.log(`✅ Model '${modelName}' is installed`);
      return true;
    } else {
      console.error(`❌ Model '${modelName}' not found`);
      console.error(`   💡 Available models:`);
      data.models.forEach(model => {
        console.error(`      - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(1)} GB)`);
      });
      console.error(`   💡 To install the missing model, run:`);
      console.error(`      ollama pull ${modelName}`);
      
      // If it's our custom model, show how to create it
      if (modelName === 'sunrise-phi3') {
        console.error(`   💡 For custom sunrise-phi3 model, run:`);
        console.error(`      ollama pull phi3:mini`);
        console.error(`      ollama create sunrise-phi3 -f Modelfile`);
      }
      
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to check model availability`);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function testLLMGeneration(): Promise<boolean> {
  const modelName = process.env.LLM_MODEL || 'phi3:mini';
  
  console.log(`🔍 Testing LLM generation with model '${modelName}'...`);
  
  try {
    const response = await localLLM.generate({
      model: modelName,
      prompt: 'Antworte \'OK\' auf Deutsch.',
      temperature: 0.1, // Very low temperature for deterministic response
      maxTokens: 10 // Short response expected
    });
    
    const normalizedResponse = response.toLowerCase().trim();
    const containsOk = normalizedResponse.includes('ok');
    
    if (containsOk) {
      console.log(`✅ LLM generation test passed`);
      console.log(`   Response: "${response}"`);
      return true;
    } else {
      console.error(`❌ LLM generation test failed`);
      console.error(`   Expected response containing 'OK', got: "${response}"`);
      console.error(`   💡 The model may not be responding correctly to German prompts`);
      return false;
    }
  } catch (error) {
    console.error(`❌ LLM generation test failed`);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      
      // Provide specific guidance based on error type
      if (error.message.includes('connect')) {
        console.error(`   💡 Connection issue - ensure Ollama is running`);
      } else if (error.message.includes('model')) {
        console.error(`   💡 Model issue - ensure '${modelName}' is installed`);
      } else if (error.message.includes('timeout')) {
        console.error(`   💡 Timeout - the model may be loading (first request can be slow)`);
      }
    }
    return false;
  }
}

async function checkLLMHealth(): Promise<number> {
  console.log('🚀 Starting Local LLM Health Check...\n');
  
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const modelName = process.env.LLM_MODEL || 'phi3:mini';
  
  console.log(`📋 Configuration:`);
  console.log(`   OLLAMA_URL: ${ollamaUrl}`);
  console.log(`   LLM_MODEL: ${modelName}`);
  console.log('');
  
  let allChecksPass = true;
  
  // Step 1: Check Ollama connection
  const connectionOk = await checkOllamaConnection();
  if (!connectionOk) {
    allChecksPass = false;
  }
  console.log('');
  
  // Step 2: Check model exists (only if connection is OK)
  if (connectionOk) {
    const modelOk = await checkModelExists();
    if (!modelOk) {
      allChecksPass = false;
    }
    console.log('');
    
    // Step 3: Test LLM generation (only if model exists)
    if (modelOk) {
      const generationOk = await testLLMGeneration();
      if (!generationOk) {
        allChecksPass = false;
      }
    }
  }
  
  console.log('');
  if (allChecksPass) {
    console.log('🎉 All LLM health checks passed!');
    console.log('✅ Local LLM pipeline is ready for use');
    return 0; // Success
  } else {
    console.log('💥 LLM health check failed');
    console.log('❌ Please fix the issues above before using the LLM pipeline');
    return 1; // Failure
  }
}

// Run the health check if this script is executed directly
// Check if this script is being run directly by looking at the process.argv
const isMainModule = process.argv[1]?.endsWith('check-llm.ts') || process.argv[1]?.endsWith('check-llm.js');

if (isMainModule) {
  checkLLMHealth()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('💥 Unexpected error during health check:', error);
      process.exit(1);
    });
}

// Export for testing
export { checkLLMHealth, checkOllamaConnection, checkModelExists, testLLMGeneration };
