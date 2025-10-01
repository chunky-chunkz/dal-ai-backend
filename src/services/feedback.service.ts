import { FeedbackRequest, FeedbackResponse } from '../models/faq.model.js';
import fs from 'fs/promises';
import path from 'path';

interface FeedbackEntry {
  timestamp: string;
  question: string;
  helpful: boolean;
  sourceId?: string;
}

export class FeedbackService {
  private readonly feedbackPath: string;

  constructor() {
    this.feedbackPath = path.join(__dirname, '../data/feedback.json');
  }

  /**
   * Save user feedback
   */
  async saveFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
    try {
      const feedbackEntry: FeedbackEntry = {
        timestamp: new Date().toISOString(),
        question: request.question,
        helpful: request.helpful,
        sourceId: request.sourceId
      };

      // Load existing feedback
      let existingFeedback: FeedbackEntry[] = [];
      try {
        const data = await fs.readFile(this.feedbackPath, 'utf-8');
        existingFeedback = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet, start with empty array
        existingFeedback = [];
      }

      // Add new feedback
      existingFeedback.push(feedbackEntry);

      // Save back to file
      await fs.writeFile(
        this.feedbackPath, 
        JSON.stringify(existingFeedback, null, 2),
        'utf-8'
      );

      return { ok: true };

    } catch (error) {
      console.error('Error saving feedback:', error);
      throw new Error('Failed to save feedback');
    }
  }

  /**
   * Get feedback statistics (for future use)
   */
  async getFeedbackStats(): Promise<{ total: number; helpful: number; notHelpful: number }> {
    try {
      const data = await fs.readFile(this.feedbackPath, 'utf-8');
      const feedback: FeedbackEntry[] = JSON.parse(data);
      
      const helpful = feedback.filter(f => f.helpful).length;
      const notHelpful = feedback.filter(f => !f.helpful).length;
      
      return {
        total: feedback.length,
        helpful,
        notHelpful
      };
    } catch (error) {
      return { total: 0, helpful: 0, notHelpful: 0 };
    }
  }
}
