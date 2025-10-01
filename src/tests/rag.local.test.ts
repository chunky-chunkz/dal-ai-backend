/**
 * Comprehensive tests for RAG Local implementation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import { ragLocalAnswer, ragLocalAnswerStream, ragLocalAnswerStreamAsync } from '../ai/rag.local.js';

dotenv.config();

describe('RAG Local', () => {
  const model = process.env.LLM_MODEL || 'phi3:mini';

  beforeAll(async () => {
    // Small delay to ensure model is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 5000);

  describe('Basic RAG Functionality', () => {
    it('should provide relevant answers for FAQ questions', async () => {
      const response = await ragLocalAnswer('Warum ist mein Internet so langsam?');
      
      expect(response.answer).toBeDefined();
      expect(typeof response.answer).toBe('string');
      expect(response.answer.length).toBeGreaterThan(10);
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(response.sourceIds)).toBe(true);
      expect(response.sourceIds.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle payment related questions', async () => {
      const response = await ragLocalAnswer('Wie bezahle ich meine Rechnung?');
      
      expect(response.answer).toBeDefined();
      expect(response.answer.toLowerCase()).toMatch(/rechnung|bezahl|zahl/);
      expect(response.confidence).toBeGreaterThan(0.5);
      expect(response.sourceIds.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle questions with no relevant context', async () => {
      const response = await ragLocalAnswer('Was ist die beste Pizza in Italien?');
      
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeLessThan(0.8); // Should have lower confidence
      expect(Array.isArray(response.sourceIds)).toBe(true);
    }, 20000);

    it('should limit results to k documents', async () => {
      const response1 = await ragLocalAnswer('Internet problem', 1);
      const response2 = await ragLocalAnswer('Internet problem', 5);
      
      expect(response1.sourceIds.length).toBeLessThanOrEqual(1);
      expect(response2.sourceIds.length).toBeLessThanOrEqual(5);
    }, 20000);
  });

  describe('Confidence Scoring', () => {
    it('should provide higher confidence for exact matches', async () => {
      const exactMatch = await ragLocalAnswer('Zahlungsfrist für Rechnungen');
      const partialMatch = await ragLocalAnswer('Rechnung');
      
      expect(exactMatch.confidence).toBeGreaterThanOrEqual(partialMatch.confidence);
    }, 20000);

    it('should normalize confidence scores correctly', async () => {
      const response = await ragLocalAnswer('Router reset');
      
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    }, 15000);
  });

  describe('Streaming RAG', () => {
    it('should stream responses correctly', async () => {
      const chunks: string[] = [];
      
      const response = await ragLocalAnswerStream(
        'Wie starte ich meinen Router neu?',
        3,
        (chunk) => chunks.push(chunk)
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.sourceIds.length).toBeGreaterThan(0);
      
      // Verify streaming content matches final answer
      const streamedContent = chunks.join('');
      expect(streamedContent.trim()).toBe(response.answer);
    }, 20000);

    it('should handle streaming with no matches', async () => {
      const chunks: string[] = [];
      
      const response = await ragLocalAnswerStream(
        'How to bake a perfect cake?',
        3,
        (chunk) => chunks.push(chunk)
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(response.confidence).toBeLessThan(0.5);
    }, 15000);
  });

  describe('Async Streaming Interface', () => {
    it('should work with async streaming interface', async () => {
      const { onToken, donePromise } = ragLocalAnswerStreamAsync('SIM-Karte ersetzen');
      
      const tokens: string[] = [];
      const originalOnToken = onToken;
      
      // Wrap onToken to capture tokens
      Object.defineProperty({ onToken }, 'onToken', {
        value: (chunk: string) => {
          tokens.push(chunk);
          originalOnToken(chunk);
        }
      });

      const response = await donePromise;
      
      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.sourceIds).toBeDefined();
    }, 20000);
  });

  describe('German Language Support', () => {
    it('should respond in German', async () => {
      const response = await ragLocalAnswer('Internet Störung');
      
      expect(response.answer).toBeDefined();
      // Check for common German words/patterns
      expect(response.answer).toMatch(/(?:sie|der|die|das|und|oder|bei|für|mit|können|sollten)/i);
    }, 15000);

    it('should handle German special characters', async () => {
      const response = await ragLocalAnswer('Kündigungsfristen');
      
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle empty questions gracefully', async () => {
      const response = await ragLocalAnswer('');
      
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeLessThanOrEqual(0.5);
    }, 10000);

    it('should handle very short questions', async () => {
      const response = await ragLocalAnswer('?');
      
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeLessThanOrEqual(0.5);
    }, 10000);
  });

  describe('Source ID Tracking', () => {
    it('should return relevant source IDs', async () => {
      const response = await ragLocalAnswer('WLAN funktioniert nicht');
      
      expect(Array.isArray(response.sourceIds)).toBe(true);
      expect(response.sourceIds.length).toBeGreaterThan(0);
      expect(response.sourceIds.every(id => typeof id === 'string')).toBe(true);
    }, 15000);

    it('should limit source IDs to k parameter', async () => {
      const response1 = await ragLocalAnswer('Internet', 2);
      const response2 = await ragLocalAnswer('Internet', 4);
      
      expect(response1.sourceIds.length).toBeLessThanOrEqual(2);
      expect(response2.sourceIds.length).toBeLessThanOrEqual(4);
    }, 20000);
  });
});
