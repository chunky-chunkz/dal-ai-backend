import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { FeedbackController, FeedbackRequestBody } from '../controllers/feedback.controller.js';
import { FeedbackRequest } from '../models/feedback.model.js';
import { FeedbackRepository } from '../repos/feedback.repo.js';

// Mock the feedback repository
vi.mock('../repos/feedback.repo.js', () => {
  const mockRepository = {
    save: vi.fn(),
    saveFeedback: vi.fn(),
    loadAll: vi.fn(),
    getStats: vi.fn(),
    clear: vi.fn(),
    getFilePath: vi.fn()
  };

  return {
    FeedbackRepository: vi.fn(() => mockRepository),
    feedbackRepository: mockRepository
  };
});

describe('FeedbackController', () => {
  let feedbackController: FeedbackController;
  let mockRequest: Partial<FastifyRequest<{ Body: FeedbackRequestBody }>>;
  let mockReply: Partial<FastifyReply>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockSend: ReturnType<typeof vi.fn>;
  let mockRepository: any;

  beforeEach(async () => {
    // Get the mocked repository
    const { feedbackRepository } = await import('../repos/feedback.repo.js');
    mockRepository = feedbackRepository;

    feedbackController = new FeedbackController();
    
    // Mock reply object
    mockSend = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ send: mockSend });
    mockReply = {
      status: mockStatus as any,
      send: mockSend as any
    };

    // Mock console methods to avoid test output pollution
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitFeedback', () => {
    it('should process positive feedback successfully', async () => {
      const feedbackData: FeedbackRequest = {
        question: 'What is your return policy?',
        helpful: true,
        sourceId: 'faq-1'
      };

      mockRequest = { body: feedbackData };
      mockRepository.save.mockResolvedValue(undefined);

      await feedbackController.submitFeedback(
        mockRequest as FastifyRequest<{ Body: FeedbackRequestBody }>,
        mockReply as FastifyReply
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        'What is your return policy?',
        true,
        'faq-1'
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockSend).toHaveBeenCalledWith({
        ok: true
      });
    });

    it('should process negative feedback successfully', async () => {
      const feedbackData: FeedbackRequest = {
        question: 'How long does shipping take?',
        helpful: false,
        sourceId: 'faq-2'
      };

      mockRequest = { body: feedbackData };
      mockRepository.save.mockResolvedValue(undefined);

      await feedbackController.submitFeedback(
        mockRequest as FastifyRequest<{ Body: FeedbackRequestBody }>,
        mockReply as FastifyReply
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        'How long does shipping take?',
        false,
        'faq-2'
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockSend).toHaveBeenCalledWith({
        ok: true
      });
    });

    it('should process feedback without sourceId', async () => {
      const feedbackData: FeedbackRequest = {
        question: 'What payment methods do you accept?',
        helpful: true
      };

      mockRequest = { body: feedbackData };
      mockRepository.save.mockResolvedValue(undefined);

      await feedbackController.submitFeedback(
        mockRequest as FastifyRequest<{ Body: FeedbackRequestBody }>,
        mockReply as FastifyReply
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        'What payment methods do you accept?',
        true,
        undefined
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockSend).toHaveBeenCalledWith({
        ok: true
      });
    });

    it('should handle validation errors gracefully', async () => {
      // Create invalid feedback data (empty question)
      const invalidFeedbackData = {
        question: '',
        helpful: true
      };

      mockRequest = { body: invalidFeedbackData };

      await feedbackController.submitFeedback(
        mockRequest as FastifyRequest<{ Body: FeedbackRequestBody }>,
        mockReply as FastifyReply
      );

      // Repository should not be called
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockSend).toHaveBeenCalledWith({
        ok: false
      });
    });

    it('should handle missing required fields', async () => {
      // Create invalid feedback data (missing helpful field)
      const invalidFeedbackData = {
        question: 'Test question'
        // Missing helpful field
      } as any;

      mockRequest = { body: invalidFeedbackData };

      await feedbackController.submitFeedback(
        mockRequest as FastifyRequest<{ Body: FeedbackRequestBody }>,
        mockReply as FastifyReply
      );

      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockSend).toHaveBeenCalledWith({
        ok: false
      });
    });

    it('should handle repository errors gracefully', async () => {
      const feedbackData: FeedbackRequest = {
        question: 'Test question',
        helpful: true
      };

      mockRequest = { body: feedbackData };
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await feedbackController.submitFeedback(
        mockRequest as FastifyRequest<{ Body: FeedbackRequestBody }>,
        mockReply as FastifyReply
      );

      expect(mockRepository.save).toHaveBeenCalledWith('Test question', true, undefined);
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockSend).toHaveBeenCalledWith({
        ok: false
      });
    });

    it('should log feedback processing', async () => {
      const feedbackData: FeedbackRequest = {
        question: 'Test question',
        helpful: false,
        sourceId: 'test-id'
      };

      mockRequest = { body: feedbackData };
      mockRepository.save.mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'log');

      await feedbackController.submitFeedback(
        mockRequest as FastifyRequest<{ Body: FeedbackRequestBody }>,
        mockReply as FastifyReply
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📝 Feedback processed successfully:',
        expect.objectContaining({
          question: 'Test question',
          helpful: false,
          sourceId: 'test-id',
          timestamp: expect.any(String)
        })
      );
    });
  });
});
