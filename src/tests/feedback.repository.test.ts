import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FeedbackRepository } from '../repos/feedback.repo.js';
import { type Feedback, createFeedback } from '../models/feedback.model.js';

describe('FeedbackRepository', () => {
  let feedbackRepo: FeedbackRepository;
  let testFilePath: string;

  beforeEach(async () => {
    feedbackRepo = new FeedbackRepository();
    testFilePath = feedbackRepo.getFilePath();
    
    // Clean up before each test
    await feedbackRepo.clear();

    // Mock console methods to avoid test output pollution
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up after each test
    await feedbackRepo.clear();
    vi.restoreAllMocks();
  });

  describe('save', () => {
    it('should save feedback to NDJSON file', async () => {
      await feedbackRepo.save('What is your return policy?', true, 'faq-1');

      // Check if file exists
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Check file content
      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.trim().split('\n');
      
      expect(lines).toHaveLength(1);
      
      const feedback = JSON.parse(lines[0]);
      expect(feedback.question).toBe('What is your return policy?');
      expect(feedback.helpful).toBe(true);
      expect(feedback.sourceId).toBe('faq-1');
      expect(feedback.ts).toBeDefined();
    });

    it('should save feedback without sourceId', async () => {
      await feedbackRepo.save('How does shipping work?', false);

      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.trim().split('\n');
      
      expect(lines).toHaveLength(1);
      
      const feedback = JSON.parse(lines[0]);
      expect(feedback.question).toBe('How does shipping work?');
      expect(feedback.helpful).toBe(false);
      expect(feedback.sourceId).toBeUndefined();
      expect(feedback.ts).toBeDefined();
    });

    it('should append multiple feedback entries', async () => {
      await feedbackRepo.save('Question 1', true, 'faq-1');
      await feedbackRepo.save('Question 2', false, 'faq-2');
      await feedbackRepo.save('Question 3', true);

      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.trim().split('\n');
      
      expect(lines).toHaveLength(3);
      
      const feedback1 = JSON.parse(lines[0]);
      const feedback2 = JSON.parse(lines[1]);
      const feedback3 = JSON.parse(lines[2]);
      
      expect(feedback1.question).toBe('Question 1');
      expect(feedback1.helpful).toBe(true);
      expect(feedback1.sourceId).toBe('faq-1');
      
      expect(feedback2.question).toBe('Question 2');
      expect(feedback2.helpful).toBe(false);
      expect(feedback2.sourceId).toBe('faq-2');
      
      expect(feedback3.question).toBe('Question 3');
      expect(feedback3.helpful).toBe(true);
      expect(feedback3.sourceId).toBeUndefined();
    });

    it('should handle validation errors', async () => {
      await expect(feedbackRepo.save('', true)).rejects.toThrow('Failed to save feedback');
    });
  });

  describe('saveFeedback', () => {
    it('should save a complete feedback object', async () => {
      const feedback: Feedback = createFeedback('Test question', true, 'test-id');
      
      await feedbackRepo.saveFeedback(feedback);

      const content = await fs.readFile(testFilePath, 'utf8');
      const lines = content.trim().split('\n');
      
      expect(lines).toHaveLength(1);
      
      const savedFeedback = JSON.parse(lines[0]);
      expect(savedFeedback.question).toBe('Test question');
      expect(savedFeedback.helpful).toBe(true);
      expect(savedFeedback.sourceId).toBe('test-id');
      expect(savedFeedback.ts).toBe(feedback.ts);
    });

    it('should validate feedback object before saving', async () => {
      const invalidFeedback = {
        question: '', // Invalid empty question
        helpful: true
      } as Feedback;

      await expect(feedbackRepo.saveFeedback(invalidFeedback)).rejects.toThrow('Failed to save feedback');
    });
  });

  describe('loadAll', () => {
    it('should return empty array when no file exists', async () => {
      const feedback = await feedbackRepo.loadAll();
      expect(feedback).toEqual([]);
    });

    it('should load all feedback entries from file', async () => {
      // Save some test feedback
      await feedbackRepo.save('Question 1', true, 'faq-1');
      await feedbackRepo.save('Question 2', false, 'faq-2');
      await feedbackRepo.save('Question 3', true);

      const feedback = await feedbackRepo.loadAll();
      
      expect(feedback).toHaveLength(3);
      
      expect(feedback[0].question).toBe('Question 1');
      expect(feedback[0].helpful).toBe(true);
      expect(feedback[0].sourceId).toBe('faq-1');
      
      expect(feedback[1].question).toBe('Question 2');
      expect(feedback[1].helpful).toBe(false);
      expect(feedback[1].sourceId).toBe('faq-2');
      
      expect(feedback[2].question).toBe('Question 3');
      expect(feedback[2].helpful).toBe(true);
      expect(feedback[2].sourceId).toBeUndefined();
    });

    it('should skip invalid lines and continue with valid ones', async () => {
      // Manually create a file with some invalid lines
      const fileContent = [
        JSON.stringify({ question: 'Valid 1', helpful: true, ts: '2025-09-02T10:00:00.000Z' }),
        '{ invalid json }',
        JSON.stringify({ question: 'Valid 2', helpful: false, ts: '2025-09-02T10:01:00.000Z' }),
        JSON.stringify({ helpful: true }), // Missing required question field
        JSON.stringify({ question: 'Valid 3', helpful: true, ts: '2025-09-02T10:02:00.000Z' })
      ].join('\n') + '\n';

      // Ensure data directory exists
      const dataDir = join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(testFilePath, fileContent, 'utf8');

      const feedback = await feedbackRepo.loadAll();
      
      expect(feedback).toHaveLength(3); // Only valid entries
      expect(feedback[0].question).toBe('Valid 1');
      expect(feedback[1].question).toBe('Valid 2');
      expect(feedback[2].question).toBe('Valid 3');
    });

    it('should handle empty lines correctly', async () => {
      // Create file with empty lines
      const fileContent = [
        JSON.stringify({ question: 'Question 1', helpful: true, ts: '2025-09-02T10:00:00.000Z' }),
        '',
        JSON.stringify({ question: 'Question 2', helpful: false, ts: '2025-09-02T10:01:00.000Z' }),
        '   ', // Whitespace only
        JSON.stringify({ question: 'Question 3', helpful: true, ts: '2025-09-02T10:02:00.000Z' })
      ].join('\n') + '\n';

      const dataDir = join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(testFilePath, fileContent, 'utf8');

      const feedback = await feedbackRepo.loadAll();
      
      expect(feedback).toHaveLength(3);
      expect(feedback[0].question).toBe('Question 1');
      expect(feedback[1].question).toBe('Question 2');
      expect(feedback[2].question).toBe('Question 3');
    });
  });

  describe('getStats', () => {
    it('should return zero stats when no feedback exists', async () => {
      const stats = await feedbackRepo.getStats();
      
      expect(stats).toEqual({
        total: 0,
        helpful: 0,
        unhelpful: 0,
        helpfulRate: 0
      });
    });

    it('should calculate correct statistics', async () => {
      // Save test feedback: 3 helpful, 2 unhelpful
      await feedbackRepo.save('Question 1', true);
      await feedbackRepo.save('Question 2', false);
      await feedbackRepo.save('Question 3', true);
      await feedbackRepo.save('Question 4', true);
      await feedbackRepo.save('Question 5', false);

      const stats = await feedbackRepo.getStats();
      
      expect(stats.total).toBe(5);
      expect(stats.helpful).toBe(3);
      expect(stats.unhelpful).toBe(2);
      expect(stats.helpfulRate).toBe(60); // 3/5 = 60%
    });

    it('should handle all helpful feedback', async () => {
      await feedbackRepo.save('Question 1', true);
      await feedbackRepo.save('Question 2', true);

      const stats = await feedbackRepo.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.helpful).toBe(2);
      expect(stats.unhelpful).toBe(0);
      expect(stats.helpfulRate).toBe(100);
    });

    it('should handle all unhelpful feedback', async () => {
      await feedbackRepo.save('Question 1', false);
      await feedbackRepo.save('Question 2', false);

      const stats = await feedbackRepo.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.helpful).toBe(0);
      expect(stats.unhelpful).toBe(2);
      expect(stats.helpfulRate).toBe(0);
    });

    it('should round helpful rate to 2 decimal places', async () => {
      // 1 helpful out of 3 = 33.333...%
      await feedbackRepo.save('Question 1', true);
      await feedbackRepo.save('Question 2', false);
      await feedbackRepo.save('Question 3', false);

      const stats = await feedbackRepo.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.helpful).toBe(1);
      expect(stats.unhelpful).toBe(2);
      expect(stats.helpfulRate).toBe(33.33);
    });
  });

  describe('getFilePath', () => {
    it('should return the correct file path', () => {
      const expectedPath = join(process.cwd(), 'data', 'feedback.ndjson');
      expect(feedbackRepo.getFilePath()).toBe(expectedPath);
    });
  });

  describe('clear', () => {
    it('should delete the feedback file', async () => {
      // Create some feedback first
      await feedbackRepo.save('Test question', true);

      // Verify file exists
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Clear the file
      await feedbackRepo.clear();

      // Verify file no longer exists
      const fileExistsAfter = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExistsAfter).toBe(false);
    });

    it('should not throw error when file does not exist', async () => {
      // Should not throw even when file doesn't exist
      await expect(feedbackRepo.clear()).resolves.not.toThrow();
    });
  });
});
