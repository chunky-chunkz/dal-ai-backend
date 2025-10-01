import { z } from 'zod';

/**
 * Zod-Schema für Feedback:
 * { question: string, helpful: boolean, sourceId?: string, ts?: string }
 */

/**
 * Base feedback schema for validation
 */
export const FeedbackSchema = z.object({
  question: z.string().min(1, 'Question is required and cannot be empty'),
  helpful: z.boolean(),
  sourceId: z.string().optional(),
  ts: z.string().optional()
});

/**
 * Request schema for submitting feedback
 */
export const FeedbackRequestSchema = z.object({
  question: z.string().min(1, 'Question is required and cannot be empty'),
  helpful: z.boolean(),
  sourceId: z.string().optional()
  // Note: ts is typically set server-side, not from client request
});

/**
 * Response schema for feedback confirmation
 */
export const FeedbackResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string()
});

/**
 * TypeScript types inferred from Zod schemas
 */
export type Feedback = z.infer<typeof FeedbackSchema>;
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;

/**
 * Validation helper functions
 */
export const validateFeedback = (data: unknown): Feedback => {
  return FeedbackSchema.parse(data);
};

export const validateFeedbackRequest = (data: unknown): FeedbackRequest => {
  return FeedbackRequestSchema.parse(data);
};

export const validateFeedbackResponse = (data: unknown): FeedbackResponse => {
  return FeedbackResponseSchema.parse(data);
};

/**
 * Default values and utilities
 */
export const createFeedback = (
  question: string, 
  helpful: boolean, 
  sourceId?: string
): Feedback => {
  return {
    question,
    helpful,
    sourceId,
    ts: new Date().toISOString()
  };
};

export const createFeedbackResponse = (
  success: boolean, 
  message: string
): FeedbackResponse => {
  return {
    success,
    message,
    timestamp: new Date().toISOString()
  };
};
