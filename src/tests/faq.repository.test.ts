import { describe, it, expect, beforeEach } from 'vitest';
import { FaqRepository } from '../repos/faq.repository';

describe('FaqRepository', () => {
  let repository: FaqRepository;

  beforeEach(() => {
    repository = new FaqRepository();
  });

  describe('loadFaqs', () => {
    it('should load FAQs from JSON file', async () => {
      await repository.loadFaqs();
      const faqs = await repository.getAllFaqs();
      
      expect(faqs).toBeDefined();
      expect(faqs.length).toBeGreaterThan(0);
      expect(faqs[0]).toHaveProperty('id');
      expect(faqs[0]).toHaveProperty('question');
      expect(faqs[0]).toHaveProperty('keywords');
      expect(faqs[0]).toHaveProperty('answer');
    });
  });

  describe('searchByKeywords', () => {
    beforeEach(async () => {
      await repository.loadFaqs();
    });

    it('should find FAQs by question keywords', async () => {
      const results = await repository.searchByKeywords('rechnung einsehen');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].confidence).toBeGreaterThan(0);
      expect(results[0].faq.question).toContain('Rechnung');
    });

    it('should find FAQs by keywords', async () => {
      const results = await repository.searchByKeywords('roaming');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].confidence).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', async () => {
      const results = await repository.searchByKeywords('completelyunmatchablexyz789');
      
      expect(results).toEqual([]);
    });

    it('should return results sorted by confidence', async () => {
      const results = await repository.searchByKeywords('sim');
      
      if (results.length > 1) {
        expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
      }
    });
  });

  describe('findById', () => {
    beforeEach(async () => {
      await repository.loadFaqs();
    });

    it('should find FAQ by ID', async () => {
      const faq = await repository.findById('1');
      
      expect(faq).toBeDefined();
      expect(faq?.id).toBe('1');
    });

    it('should return undefined for non-existent ID', async () => {
      const faq = await repository.findById('nonexistent');
      
      expect(faq).toBeUndefined();
    });
  });
});
