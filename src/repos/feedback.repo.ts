import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  type Feedback,
  validateFeedback,
  createFeedback
} from '../models/feedback.model.js';

/**
 * Feedback Repository for append-only JSON Lines storage
 * 
 * This repository implements an append-only pattern using NDJSON (Newline Delimited JSON)
 * format for storing user feedback. Each feedback entry is written as a single line,
 * making it efficient for logging and analysis.
 */
export class FeedbackRepository {
  private readonly feedbackFilePath: string;

  constructor() {
    // Path to the feedback NDJSON file
    this.feedbackFilePath = join(process.cwd(), 'data', 'feedback.ndjson');
  }

  /**
   * Save feedback to the append-only JSON Lines file
   * 
   * @param question - The question that was asked
   * @param helpful - Whether the answer was helpful
   * @param sourceId - Optional ID of the source FAQ
   * @returns Promise<void>
   */
  async save(question: string, helpful: boolean, sourceId?: string): Promise<void> {
    try {
      // Create feedback object with timestamp
      const feedback: Feedback = createFeedback(question, helpful, sourceId);

      // Validate the feedback data
      const validatedFeedback = validateFeedback(feedback);

      // Convert to JSON line (single line with newline at the end)
      const jsonLine = JSON.stringify(validatedFeedback) + '\n';

      // Ensure the data directory exists
      await this.ensureDataDirectory();

      // Append the JSON line to the file (creates file if it doesn't exist)
      await fs.appendFile(this.feedbackFilePath, jsonLine, 'utf8');

      console.log('💾 Feedback saved:', {
        question: validatedFeedback.question,
        helpful: validatedFeedback.helpful,
        sourceId: validatedFeedback.sourceId,
        timestamp: validatedFeedback.ts
      });

    } catch (error) {
      console.error('❌ Error saving feedback:', error);
      throw new Error(`Failed to save feedback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save a complete feedback object
   * 
   * @param feedback - The feedback object to save
   * @returns Promise<void>
   */
  async saveFeedback(feedback: Feedback): Promise<void> {
    try {
      // Validate the feedback data
      const validatedFeedback = validateFeedback(feedback);

      // Convert to JSON line
      const jsonLine = JSON.stringify(validatedFeedback) + '\n';

      // Ensure the data directory exists
      await this.ensureDataDirectory();

      // Append to file
      await fs.appendFile(this.feedbackFilePath, jsonLine, 'utf8');

      console.log('💾 Feedback object saved:', {
        question: validatedFeedback.question,
        helpful: validatedFeedback.helpful,
        sourceId: validatedFeedback.sourceId,
        timestamp: validatedFeedback.ts
      });

    } catch (error) {
      console.error('❌ Error saving feedback object:', error);
      throw new Error(`Failed to save feedback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read all feedback entries from the NDJSON file
   * 
   * @returns Promise<Feedback[]> - Array of all feedback entries
   */
  async loadAll(): Promise<Feedback[]> {
    try {
      // Check if file exists
      try {
        await fs.access(this.feedbackFilePath);
      } catch {
        // File doesn't exist, return empty array
        console.log('📝 No feedback file found, returning empty array');
        return [];
      }

      // Read the entire file
      const fileContent = await fs.readFile(this.feedbackFilePath, 'utf8');

      // Split by lines and filter out empty lines
      const lines = fileContent.split('\n').filter(line => line.trim() !== '');

      // Parse each JSON line
      const feedbackEntries: Feedback[] = [];
      for (const line of lines) {
        try {
          const feedback = JSON.parse(line);
          const validatedFeedback = validateFeedback(feedback);
          feedbackEntries.push(validatedFeedback);
        } catch (parseError) {
          console.warn('⚠️ Skipping invalid feedback line:', line, parseError);
          // Continue with other lines instead of failing completely
        }
      }

      console.log(`📚 Loaded ${feedbackEntries.length} feedback entries from ${this.feedbackFilePath}`);
      return feedbackEntries;

    } catch (error) {
      console.error('❌ Error loading feedback:', error);
      throw new Error(`Failed to load feedback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get feedback statistics
   * 
   * @returns Promise<{total: number, helpful: number, unhelpful: number, helpfulRate: number}>
   */
  async getStats(): Promise<{
    total: number;
    helpful: number;
    unhelpful: number;
    helpfulRate: number;
  }> {
    try {
      const allFeedback = await this.loadAll();
      const total = allFeedback.length;
      const helpful = allFeedback.filter(f => f.helpful).length;
      const unhelpful = total - helpful;
      const helpfulRate = total > 0 ? (helpful / total) * 100 : 0;

      return {
        total,
        helpful,
        unhelpful,
        helpfulRate: Math.round(helpfulRate * 100) / 100 // Round to 2 decimal places
      };

    } catch (error) {
      console.error('❌ Error getting feedback stats:', error);
      throw new Error(`Failed to get feedback stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the path to the feedback file
   * 
   * @returns string - The absolute path to the feedback NDJSON file
   */
  getFilePath(): string {
    return this.feedbackFilePath;
  }

  /**
   * Clear all feedback (for testing purposes)
   * WARNING: This will delete all feedback data!
   * 
   * @returns Promise<void>
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.feedbackFilePath);
      console.log('🗑️ Feedback file cleared');
    } catch (error) {
      // File might not exist, which is fine
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Ensure the data directory exists
   * 
   * @private
   * @returns Promise<void>
   */
  private async ensureDataDirectory(): Promise<void> {
    const dataDir = join(process.cwd(), 'data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

// Create and export singleton instance
export const feedbackRepository = new FeedbackRepository();
