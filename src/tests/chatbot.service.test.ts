import { describe, it, expect, beforeEach } from 'vitest';
import { ChatbotService } from '../services/chatbot.service';

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    service = new ChatbotService();
    await service.initialize();
  });

  describe('getAnswer', () => {
    it('should return answer for valid question', async () => {
      const response = await service.getAnswer({
        question: 'What is your refund policy?'
      });

      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it('should return default answer for unmatched question', async () => {
      const response = await service.getAnswer({
        question: 'completelyunmatchablequestionxyz789'
      });

      expect(response).toBeDefined();
      expect(response.answer).toContain("couldn't find an answer");
      expect(response.confidence).toBe(0);
    });

    it('should handle questions about shipping', async () => {
      const response = await service.getAnswer({
        question: 'How long does delivery take?'
      });

      expect(response).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.answer.toLowerCase()).toMatch(/shipping|delivery|days/);
    });

    it('should handle questions about payment', async () => {
      const response = await service.getAnswer({
        question: 'What payment methods do you accept?'
      });

      expect(response).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.answer.toLowerCase()).toMatch(/payment|credit|card/);
    });
  });
});
