/**
 * Aufgabe: Repo für FAQs mit Validierung.
 * - loadAll(): faqs.json laden und gegen FaqArraySchema validieren.
 * - list(): gecachte Liste zurückgeben.
 * - getById(id): einzelnes FAQ holen.
 * - findByQuery(q): improved keyword search in title/question_variants.
 * - saveAll(faqs): komplett zurückschreiben (für spätere Admin-Tools).
 */
import fs from 'fs/promises';
import path from 'path';
import { Faq, FaqArraySchema } from '../models/faq.model.js';

export class FaqRepository {
  private faqs: Faq[] = [];
  private readonly dataPath: string;
  private isLoaded: boolean = false;

  constructor() {
    // Use path relative to backend directory when running from backend/
    this.dataPath = path.resolve('data/faqs.json');
  }

  /**
   * Load FAQs from JSON file and validate against FaqArraySchema
   */
  async loadAll(): Promise<Faq[]> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Validate against FaqArraySchema
      this.faqs = FaqArraySchema.parse(parsed);
      this.isLoaded = true;
      
      return this.faqs;
    } catch (error) {
      console.error('Error loading FAQs:', error);
      throw new Error(`Failed to load FAQ data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cached FAQ list (loads if not already loaded)
   */
  async list(): Promise<Faq[]> {
    if (!this.isLoaded) {
      await this.loadAll();
    }
    return [...this.faqs]; // Return copy to prevent external mutations
  }

  /**
   * Get single FAQ by ID
   */
  async getById(id: string): Promise<Faq | undefined> {
    const faqs = await this.list();
    return faqs.find(faq => faq.id === id);
  }

  /**
   * Simple keyword match in title and question_variants
   */
  async findByQuery(query: string): Promise<{ faq: Faq; confidence: number }[]> {
    if (!query.trim()) {
      return [];
    }

    const faqs = await this.list();
    // Clean and split query, remove punctuation and filter short words
    const searchKeywords = query.toLowerCase()
      .replace(/[?!.,;:]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    if (searchKeywords.length === 0) {
      return [];
    }

    const results: { faq: Faq; confidence: number }[] = [];

    faqs.forEach(faq => {
      let matchScore = 0;
      let totalPossibleMatches = searchKeywords.length;
      let hasMatch = false;

      // Check title matches
      const titleLower = faq.title.toLowerCase();
      const titleWords = titleLower.split(/\s+/);
      
      searchKeywords.forEach(keyword => {
        // Exact word match in title gets high score
        if (titleWords.includes(keyword)) {
          matchScore += 1.0;
          hasMatch = true;
        }
        // Title contains keyword as substring gets medium score
        else if (titleLower.includes(keyword)) {
          matchScore += 0.8;
          hasMatch = true;
        }
      });

      // Check question_variants matches  
      faq.question_variants.forEach(questionVariant => {
        const questionLower = questionVariant.toLowerCase().replace(/[?!.,;:]/g, '');
        const questionWords = questionLower.split(/\s+/);
        
        searchKeywords.forEach(keyword => {
          // Exact word match in question variant gets high score
          if (questionWords.includes(keyword)) {
            matchScore += 0.9;
            hasMatch = true;
          }
          // Question variant contains keyword as substring gets medium score
          else if (questionLower.includes(keyword)) {
            matchScore += 0.7;
            hasMatch = true;
          }
        });
        
        // Check for phrase similarity (if multiple keywords match in sequence)
        const queryNormalized = query.toLowerCase().replace(/[?!.,;:]/g, '');
        if (questionLower.includes(queryNormalized) || queryNormalized.includes(questionLower)) {
          matchScore += 1.5; // High bonus for phrase matches
          hasMatch = true;
        }
      });

      // Calculate confidence and only include if we have matches
      if (hasMatch && matchScore > 0) {
        const confidence = Math.min(matchScore / totalPossibleMatches, 1.0);
        if (confidence >= 0.3) { // Minimum threshold for relevance
          results.push({ faq, confidence });
        }
      }
    });

    // Sort by confidence (highest first)
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Save all FAQs back to file (for future admin tools)
   */
  async saveAll(faqs: Faq[]): Promise<void> {
    try {
      // Validate the entire array before saving
      const validatedFaqs = FaqArraySchema.parse(faqs);
      
      // Write to file with proper formatting
      const jsonData = JSON.stringify(validatedFaqs, null, 2);
      await fs.writeFile(this.dataPath, jsonData, 'utf-8');
      
      // Update cached data
      this.faqs = validatedFaqs;
      this.isLoaded = true;
    } catch (error) {
      console.error('Error saving FAQs:', error);
      throw new Error(`Failed to save FAQ data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear cache (force reload on next access)
   */
  clearCache(): void {
    this.faqs = [];
    this.isLoaded = false;
  }
}
