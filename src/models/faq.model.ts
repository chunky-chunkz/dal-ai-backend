/**
 * Aufgabe: Zod-Schema und Typ für normalisierte FAQs.
 * Felder: id (string, slug), title (string), question_variants (string[] min 1),
 * answer (string), product_tags (string[] min 1), last_reviewed (YYYY-MM-DD).
 * Export: FaqSchema, type Faq.
 * Erzeuge zusätzlich FaqArraySchema für vollständige Datei-Validierung.
 */
import { z } from 'zod';

// Normalisierte FAQ model schema
export const FaqSchema = z.object({
  id: z.string().min(1, 'ID cannot be empty'), // slug format
  title: z.string().min(1, 'Title cannot be empty'),
  question_variants: z.array(z.string().min(1, 'Question variant cannot be empty')).min(1, 'At least one question variant is required'),
  answer: z.string().min(1, 'Answer cannot be empty'),
  product_tags: z.array(z.string().min(1, 'Product tag cannot be empty')).min(1, 'At least one product tag is required'),
  last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Last reviewed must be in YYYY-MM-DD format'),
});

export type Faq = z.infer<typeof FaqSchema>;

// FAQ Array schema for complete file validation
export const FaqArraySchema = z.array(FaqSchema);

export type FaqArray = z.infer<typeof FaqArraySchema>;

// API request/response schemas
export const AnswerRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
});

export const AnswerResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  sourceId: z.string().optional(),
});

export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>;

// Feedback schemas
export const FeedbackRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  helpful: z.boolean(),
  sourceId: z.string().optional(),
});

export const FeedbackResponseSchema = z.object({
  ok: z.literal(true),
});

export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;

// Health check response schema
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
