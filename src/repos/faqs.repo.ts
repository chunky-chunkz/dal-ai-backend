/**
 * Aufgabe: FAQ-Repository auf Basis einer lokalen JSON-Datei (data/faqs.json).
 * - Methoden: list(), findByQuery(q:string), create(faq), update(id, patch), delete(id)
 * - JSON beim Start einlesen und validieren (FaqSchema)
 * - Änderungen persistieren (writeFileSync)
 */
import fs from 'fs';
import path from 'path';
import { Faq, FaqSchema } from '../models/faq.model.js';
import { z } from 'zod';

export class FaqsRepository {
  private faqs: Faq[] = [];
  private readonly dataPath: string;

  constructor() {
    // Path to data/faqs.json - use persistent disk on Render
    const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    this.dataPath = path.join(DATA_DIR, 'faqs.json');
    this.loadFaqs();
  }

  /**
   * JSON beim Start einlesen und validieren (FaqSchema)
   */
  private loadFaqs(): void {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dataPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create empty file if it doesn't exist
      if (!fs.existsSync(this.dataPath)) {
        this.saveFaqs();
        return;
      }

      const data = fs.readFileSync(this.dataPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Validate data structure with FaqSchema
      const faqsSchema = z.array(FaqSchema);
      this.faqs = faqsSchema.parse(parsed);
      
      console.log(`📚 Loaded ${this.faqs.length} FAQs from ${this.dataPath}`);
    } catch (error) {
      console.error('Error loading FAQs:', error);
      // Initialize with empty array if loading fails
      this.faqs = [];
      this.saveFaqs();
    }
  }

  /**
   * Änderungen persistieren (writeFileSync)
   */
  private saveFaqs(): void {
    try {
      const data = JSON.stringify(this.faqs, null, 2);
      fs.writeFileSync(this.dataPath, data, 'utf-8');
    } catch (error) {
      console.error('Error saving FAQs:', error);
      throw new Error('Failed to save FAQ data');
    }
  }

  /**
   * List all FAQs
   */
  list(): Faq[] {
    return [...this.faqs]; // Return a copy to prevent external mutations
  }

  /**
   * Find FAQs by query string (searches in question, keywords, and answer)
   * Returns results sorted by relevance score (best matches first)
   */
  findByQuery(query: string): Faq[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim().replace(/[?!.,;:]/g, '');
    const searchKeywords = searchTerm.split(/\s+/).filter(word => word.length > 1);

    // Score each FAQ for relevance
    const scored = this.faqs.map(faq => {
      let score = 0;

      // Check question_variants (highest score for exact matches)
      if (faq.question_variants) {
        for (const variant of faq.question_variants) {
          const normalizedVariant = variant.toLowerCase().replace(/[?!.,;:]/g, '');
          if (normalizedVariant === searchTerm) {
            score += 100;
            break;
          } else if (normalizedVariant.includes(searchTerm)) {
            score += 50;
          }
          
          // Check for phrase similarity
          const variantWords = normalizedVariant.split(/\s+/);
          const matchingWords = searchKeywords.filter(keyword => 
            variantWords.some(word => word.includes(keyword) || keyword.includes(word))
          );
          if (matchingWords.length > 0) {
            score += 30 * (matchingWords.length / searchKeywords.length);
          }
        }
      }

      // Product tags matches (medium score)
      if (faq.product_tags) {
        for (const tag of faq.product_tags) {
          if (tag.toLowerCase().includes(searchTerm)) {
            score += 40;
          }
          for (const keyword of searchKeywords) {
            if (tag.toLowerCase().includes(keyword)) {
              score += 10;
            }
          }
        }
      }

      // Answer matches (lower score)
      if (faq.answer.toLowerCase().includes(searchTerm)) {
        score += 20;
      }

      // Individual keyword matches in answer
      for (const searchKeyword of searchKeywords) {
        if (faq.answer.toLowerCase().includes(searchKeyword)) {
          score += 5;
        }
      }

      return { faq, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

    return scored.map(item => item.faq);
  }

  /**
   * Create a new FAQ
   */
  create(faq: Omit<Faq, 'id'>): Faq {
    // Generate new ID
    const maxId = this.faqs.length > 0 
      ? Math.max(...this.faqs.map(f => parseInt(f.id) || 0))
      : 0;
    const newId = (maxId + 1).toString();

    const newFaq: Faq = {
      id: newId,
      ...faq
    };

    // Validate the new FAQ
    const validatedFaq = FaqSchema.parse(newFaq);
    
    this.faqs.push(validatedFaq);
    this.saveFaqs();
    
    return validatedFaq;
  }

  /**
   * Update FAQ by ID with partial data
   */
  update(id: string, patch: Partial<Omit<Faq, 'id'>>): Faq | null {
    const index = this.faqs.findIndex(faq => faq.id === id);
    
    if (index === -1) {
      return null;
    }

    // Apply patch to existing FAQ
    const updatedFaq = {
      ...this.faqs[index],
      ...patch,
      id // Ensure ID cannot be changed
    };

    // Validate the updated FAQ
    const validatedFaq = FaqSchema.parse(updatedFaq);
    
    this.faqs[index] = validatedFaq;
    this.saveFaqs();
    
    return validatedFaq;
  }

  /**
   * Delete FAQ by ID
   */
  delete(id: string): boolean {
    const index = this.faqs.findIndex(faq => faq.id === id);
    
    if (index === -1) {
      return false;
    }

    this.faqs.splice(index, 1);
    this.saveFaqs();
    
    return true;
  }

  /**
   * Find FAQ by ID
   */
  findById(id: string): Faq | null {
    return this.faqs.find(faq => faq.id === id) || null;
  }

  /**
   * Get total count of FAQs
   */
  count(): number {
    return this.faqs.length;
  }
}

// Singleton instance
export const faqsRepository = new FaqsRepository();
