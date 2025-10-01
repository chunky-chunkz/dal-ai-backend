import { describe, it, expect } from 'vitest';
import { 
  FeedbackSchema, 
  FeedbackRequestSchema, 
  FeedbackResponseSchema,
  validateFeedback,
  validateFeedbackRequest,
  validateFeedbackResponse,
  createFeedback,
  createFeedbackResponse,
  type Feedback,
  type FeedbackRequest,
  type FeedbackResponse
} from '../models/feedback.model.js';

describe('Feedback Model', () => {
  describe('FeedbackSchema', () => {
    it('should validate complete feedback object', () => {
      const validFeedback: Feedback = {
        question: 'What is your return policy?',
        helpful: true,
        sourceId: 'faq-1',
        ts: '2025-09-02T10:00:00.000Z'
      };

      const result = FeedbackSchema.parse(validFeedback);
      expect(result).toEqual(validFeedback);
    });

    it('should validate feedback with optional fields omitted', () => {
      const minimalFeedback = {
        question: 'How does shipping work?',
        helpful: false
      };

      const result = FeedbackSchema.parse(minimalFeedback);
      expect(result.question).toBe('How does shipping work?');
      expect(result.helpful).toBe(false);
      expect(result.sourceId).toBeUndefined();
      expect(result.ts).toBeUndefined();
    });

    it('should reject feedback with empty question', () => {
      const invalidFeedback = {
        question: '',
        helpful: true
      };

      expect(() => FeedbackSchema.parse(invalidFeedback)).toThrow('Question is required and cannot be empty');
    });

    it('should reject feedback with missing required fields', () => {
      const invalidFeedback = {
        question: 'Test question'
        // Missing helpful field
      };

      expect(() => FeedbackSchema.parse(invalidFeedback)).toThrow();
    });

    it('should reject feedback with wrong data types', () => {
      const invalidFeedback = {
        question: 'Test question',
        helpful: 'yes' // Should be boolean
      };

      expect(() => FeedbackSchema.parse(invalidFeedback)).toThrow();
    });
  });

  describe('FeedbackRequestSchema', () => {
    it('should validate feedback request', () => {
      const validRequest: FeedbackRequest = {
        question: 'How long does shipping take?',
        helpful: true,
        sourceId: 'faq-2'
      };

      const result = FeedbackRequestSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should validate request without sourceId', () => {
      const request = {
        question: 'What payment methods do you accept?',
        helpful: false
      };

      const result = FeedbackRequestSchema.parse(request);
      expect(result.question).toBe('What payment methods do you accept?');
      expect(result.helpful).toBe(false);
      expect(result.sourceId).toBeUndefined();
    });
  });

  describe('FeedbackResponseSchema', () => {
    it('should validate feedback response', () => {
      const validResponse: FeedbackResponse = {
        success: true,
        message: 'Thank you for your feedback!',
        timestamp: '2025-09-02T10:00:00.000Z'
      };

      const result = FeedbackResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it('should reject response with missing fields', () => {
      const invalidResponse = {
        success: true
        // Missing message and timestamp
      };

      expect(() => FeedbackResponseSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe('Validation helper functions', () => {
    it('validateFeedback should work correctly', () => {
      const feedback = {
        question: 'Test question',
        helpful: true,
        sourceId: 'test-id'
      };

      const result = validateFeedback(feedback);
      expect(result.question).toBe('Test question');
      expect(result.helpful).toBe(true);
      expect(result.sourceId).toBe('test-id');
    });

    it('validateFeedbackRequest should work correctly', () => {
      const request = {
        question: 'Test request',
        helpful: false
      };

      const result = validateFeedbackRequest(request);
      expect(result.question).toBe('Test request');
      expect(result.helpful).toBe(false);
    });

    it('validateFeedbackResponse should work correctly', () => {
      const response = {
        success: true,
        message: 'Success!',
        timestamp: '2025-09-02T10:00:00.000Z'
      };

      const result = validateFeedbackResponse(response);
      expect(result).toEqual(response);
    });
  });

  describe('Utility functions', () => {
    it('createFeedback should create feedback with timestamp', () => {
      const beforeTime = Date.now();
      const feedback = createFeedback('Test question', true, 'source-1');
      const afterTime = Date.now();

      expect(feedback.question).toBe('Test question');
      expect(feedback.helpful).toBe(true);
      expect(feedback.sourceId).toBe('source-1');
      expect(feedback.ts).toBeDefined();
      
      const feedbackTime = new Date(feedback.ts!).getTime();
      expect(feedbackTime).toBeGreaterThanOrEqual(beforeTime);
      expect(feedbackTime).toBeLessThanOrEqual(afterTime);
    });

    it('createFeedback should work without sourceId', () => {
      const feedback = createFeedback('Test question', false);

      expect(feedback.question).toBe('Test question');
      expect(feedback.helpful).toBe(false);
      expect(feedback.sourceId).toBeUndefined();
      expect(feedback.ts).toBeDefined();
    });

    it('createFeedbackResponse should create response with timestamp', () => {
      const beforeTime = Date.now();
      const response = createFeedbackResponse(true, 'Thank you!');
      const afterTime = Date.now();

      expect(response.success).toBe(true);
      expect(response.message).toBe('Thank you!');
      expect(response.timestamp).toBeDefined();
      
      const responseTime = new Date(response.timestamp).getTime();
      expect(responseTime).toBeGreaterThanOrEqual(beforeTime);
      expect(responseTime).toBeLessThanOrEqual(afterTime);
    });
  });
});
