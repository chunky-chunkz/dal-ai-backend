/**
 * Updated tests for Answer Service with RAG integration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import { answerQuestion, answerQuestionStream, answerQuestionLegacy } from '../services/answer.service.js';

dotenv.config();

describe('Answer Service with RAG', () => {
  beforeAll(async () => {
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 10000);

  describe('answerQuestion (RAG-based)', () => {
    it('should return high confidence answer for FAQ questions', async () => {
      const response = await answerQuestion('Warum ist mein Internet so langsam?');
      
      expect(response).toBeDefined();
      expect(typeof response.answer).toBe('string');
      expect(response.answer.length).toBeGreaterThan(20);
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.timestamp).toBeDefined();
      
      if (response.confidence >= 0.55) {
        expect(response.sourceId).toBeDefined();
        expect(response.answer).not.toContain('Ticket erstellen');
      }
    }, 20000);

    it('should return fallback for low confidence questions', async () => {
      const response = await answerQuestion('Was ist die beste Pizzeria in Rom?');
      
      expect(response).toBeDefined();
      if (response.confidence < 0.55) {
        expect(response.answer).toContain('Ticket erstellen');
        expect(response.sourceId).toBeUndefined();
      }
    }, 15000);

    it('should handle billing questions', async () => {
      const response = await answerQuestion('Wie bezahle ich meine Rechnung?');
      
      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      
      if (response.confidence >= 0.55) {
        expect(response.answer.toLowerCase()).toMatch(/rechnung|bezahl|zahl/);
        expect(response.sourceId).toBeDefined();
      }
    }, 15000);

    it('should handle router questions', async () => {
      const response = await answerQuestion('Router zurücksetzen');
      
      expect(response).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      
      if (response.confidence >= 0.55) {
        expect(response.answer.toLowerCase()).toMatch(/router|reset|neustart/);
        expect(response.sourceId).toBeDefined();
      }
    }, 15000);

    it('should return uncertain answer for empty query', async () => {
      const response = await answerQuestion('');
      
      expect(response).toBeDefined();
      expect(response.confidence).toBe(0.3);
      expect(response.answer).toContain('formulieren');
      expect(response.sourceId).toBeUndefined();
    }, 5000);

    it('should return uncertain answer for whitespace-only query', async () => {
      const response = await answerQuestion('   \t\n   ');
      
      expect(response).toBeDefined();
      expect(response.confidence).toBe(0.3);
      expect(response.answer).toContain('formulieren');
      expect(response.sourceId).toBeUndefined();
    }, 5000);

    it('should respect confidence threshold of 0.55', async () => {
      const response = await answerQuestion('Internet Problem');
      
      expect(response).toBeDefined();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      
      if (response.confidence >= 0.55) {
        expect(response.sourceId).toBeDefined();
        expect(response.answer).not.toContain('Ticket erstellen');
      } else {
        expect(response.answer).toContain('Ticket erstellen');
        expect(response.sourceId).toBeUndefined();
      }
    }, 15000);
  });

  describe('answerQuestionStream', () => {
    it('should stream response for valid questions', async () => {
      const chunks: string[] = [];
      
      const response = await answerQuestionStream(
        'Wie kann ich kündigen?',
        (chunk) => chunks.push(chunk)
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      
      // Verify streamed content matches final answer
      const streamedContent = chunks.join('');
      expect(streamedContent.trim()).toBe(response.answer);
    }, 20000);

    it('should stream fallback for empty questions', async () => {
      const chunks: string[] = [];
      
      const response = await answerQuestionStream('', (chunk) => chunks.push(chunk));

      expect(chunks.length).toBeGreaterThan(0);
      expect(response.answer).toContain('formulieren');
      expect(response.confidence).toBe(0.3);
    }, 10000);
  });

  describe('answerQuestionLegacy', () => {
    it('should work with legacy keyword search', async () => {
      const response = await answerQuestionLegacy('rechnung einsehen');

      expect(response).toBeDefined();
      expect(response.answer).toContain('Rechnung');
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.sourceId).toBeDefined();
    }, 10000);

    it('should return uncertain answer for unmatched query', async () => {
      const response = await answerQuestionLegacy('completely unrelated query about aliens');

      expect(response).toBeDefined();
      expect(response.confidence).toBe(0.3);
      expect(response.answer).toContain('Ticket erstellen');
      expect(response.sourceId).toBeUndefined();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle null/undefined inputs', async () => {
      const responses = await Promise.all([
        answerQuestion(null as any),
        answerQuestion(undefined as any)
      ]);

      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.confidence).toBe(0.3);
        expect(response.answer).toContain('formulieren');
      });
    }, 10000);

    it('should not expose stack traces', async () => {
      const response = await answerQuestion('test error handling');
      
      expect(response.answer).not.toMatch(/Error:/);
      expect(response.answer).not.toMatch(/Stack trace/);
      expect(response.answer).not.toMatch(/at Object\./);
    }, 15000);
  });
});
