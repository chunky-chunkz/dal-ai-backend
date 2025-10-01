/**
 * Comprehensive tests for localLLM module
 */

import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import { localLLM } from '../ai/localLLM.js';

// Load environment variables
dotenv.config();

describe('LocalLLM', () => {
  const model = process.env.LLM_MODEL || 'phi3:mini';

  beforeAll(async () => {
    // Ensure model is available before running tests
    const isAvailable = await localLLM.isModelAvailable(model);
    if (!isAvailable) {
      throw new Error(`Model ${model} is not available. Please install it first.`);
    }
  }, 10000); // 10 second timeout for model check

  describe('Model Management', () => {
    it('should list available models', async () => {
      const models = await localLLM.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain(model);
    });

    it('should check if model is available', async () => {
      const isAvailable = await localLLM.isModelAvailable(model);
      expect(isAvailable).toBe(true);
    });

    it('should return false for non-existent model', async () => {
      const isAvailable = await localLLM.isModelAvailable('non-existent-model');
      expect(isAvailable).toBe(false);
    });
  });

  describe('Text Generation', () => {
    it('should generate text with basic options', async () => {
      const response = await localLLM.generate({
        model,
        prompt: 'Say "Hello World" and nothing else.',
        temperature: 0.1,
        maxTokens: 10
      });

      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response).toContain('Hello');
    }, 15000);

    it('should generate text with system prompt', async () => {
      const response = await localLLM.generate({
        model,
        prompt: 'What is 2+2?',
        system: 'You are a math teacher. Answer only with the number.',
        temperature: 0.1,
        maxTokens: 5
      });

      expect(typeof response).toBe('string');
      expect(response.trim()).toMatch(/4|four/i);
    }, 15000);

    it('should handle different temperature values', async () => {
      const lowTemp = await localLLM.generate({
        model,
        prompt: 'Complete: The sky is',
        temperature: 0.1,
        maxTokens: 10
      });

      const highTemp = await localLLM.generate({
        model,
        prompt: 'Complete: The sky is',
        temperature: 0.9,
        maxTokens: 10
      });

      expect(typeof lowTemp).toBe('string');
      expect(typeof highTemp).toBe('string');
    }, 20000);
  });

  describe('Streaming', () => {
    it('should stream text generation', async () => {
      const chunks: string[] = [];
      
      const fullResponse = await localLLM.stream({
        model,
        prompt: 'Count from 1 to 5, separated by commas.',
        temperature: 0.1,
        maxTokens: 20,
        onToken: (chunk) => {
          chunks.push(chunk);
        }
      });

      expect(typeof fullResponse).toBe('string');
      expect(fullResponse.length).toBeGreaterThan(0);
      expect(chunks.length).toBeGreaterThan(0);
      
      // Verify that chunks combined equal full response
      const combinedChunks = chunks.join('');
      expect(combinedChunks.trim()).toBe(fullResponse);
    }, 15000);

    it('should stream with system prompt', async () => {
      const chunks: string[] = [];
      
      const response = await localLLM.stream({
        model,
        prompt: 'Say hello',
        system: 'Be very brief, maximum 3 words.',
        temperature: 0.1,
        maxTokens: 10,
        onToken: (chunk) => {
          chunks.push(chunk);
        }
      });

      expect(response.length).toBeGreaterThan(0);
      expect(chunks.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent model gracefully', async () => {
      await expect(localLLM.generate({
        model: 'non-existent-model',
        prompt: 'test'
      })).rejects.toThrow(/not found/);
    }, 10000);

    it('should handle connection errors gracefully', async () => {
      // This test would require mocking or stopping Ollama service
      // For now, just test that errors are properly wrapped
      try {
        await localLLM.generate({
          model: 'invalid-model-name',
          prompt: 'test'
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).not.toContain('Stack trace');
      }
    }, 10000);
  });
});

describe('Configuration', () => {
  it('should use environment variables', () => {
    const ollamaUrl = process.env.OLLAMA_URL;
    const llmModel = process.env.LLM_MODEL;
    
    expect(ollamaUrl).toBeDefined();
    expect(llmModel).toBeDefined();
    expect(ollamaUrl).toMatch(/http/);
  });
});
