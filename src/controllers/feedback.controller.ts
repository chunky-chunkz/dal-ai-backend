import { FastifyReply, FastifyRequest } from 'fastify';
import { 
  type FeedbackRequest,
  validateFeedbackRequest
} from '../models/feedback.model.js';
import { feedbackRepository } from '../repos/feedback.repo.js';

export interface FeedbackRequestBody extends FeedbackRequest {}

export class FeedbackController {
  /**
   * Feedback controller for handling user feedback submissions
   * 
   * @param request - Fastify request object with validated feedback data
   * @param reply - Fastify reply object for sending response
   * @returns Promise<void>
   */
  public async submitFeedback(
    request: FastifyRequest<{ Body: FeedbackRequestBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const feedback = request.body;

      // Validate the feedback data using Zod schema
      const validatedFeedback = validateFeedbackRequest(feedback);
      
      // Save to repository
      await feedbackRepository.save(
        validatedFeedback.question,
        validatedFeedback.helpful,
        validatedFeedback.sourceId
      );
      
      // Log feedback for analytics (also logged by repository)
      console.log('📝 Feedback processed successfully:', {
        question: validatedFeedback.question,
        helpful: validatedFeedback.helpful,
        sourceId: validatedFeedback.sourceId,
        timestamp: new Date().toISOString()
      });

      // In a production environment, you would:
      // 1. ✅ Store feedback in a database (implemented with NDJSON file)
      // 2. Update question/answer quality metrics
      // 3. Trigger retraining of ML models if needed
      // 4. Send analytics to monitoring systems

      // Return simple success response
      reply.status(200).send({ ok: true });

    } catch (error) {
      console.error('❌ Error processing feedback:', error);
      
      // Return simple error response
      reply.status(500).send({ ok: false });
    }
  }
}

// Create singleton instance
export const feedbackController = new FeedbackController();
