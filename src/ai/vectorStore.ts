/**
 * Task: Lightweight persistent vector store.
 * Requirements:
 * - buildIndex(faqs, {useTitle?:boolean}) -> compute embeddings (title+answer or answer) and save to src/data/vector_index.json.
 * - search(query, k=3) -> embed query, cosine similarity vs rows, return top-k [{id,text,score}].
 * - Use existing embeddings.ts; normalize vectors; file I/O robust (create dirs).
 * - Rebuild index when missing or model changed.
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  generateEmbedding, 
  generateEmbeddings, 
  cosineSimilarity, 
  getEmbeddingModelInfo,
  isEmbeddingModelAvailable 
} from './embeddings.js';
import type { Faq } from '../models/faq.model.js';

export interface VectorIndexEntry {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface VectorIndex {
  version: string;
  model: string;
  created: string;
  entries: VectorIndexEntry[];
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface BuildIndexOptions {
  useTitle?: boolean;
  model?: string;
  forceRebuild?: boolean;
}

/**
 * Lightweight persistent vector store
 */
export class VectorStore {
  private indexPath: string;
  private dataDir: string;
  private currentIndex: VectorIndex | null = null;

  constructor(indexPath: string = 'src/data/vector_index.json') {
    this.indexPath = path.resolve(indexPath);
    this.dataDir = path.dirname(this.indexPath);
  }

  /**
   * Build index from FAQs and save to disk
   * @param faqs Array of FAQ objects
   * @param options Build options
   */
  async buildIndex(faqs: Faq[], options: BuildIndexOptions = {}): Promise<void> {
    const embeddingModelInfo = getEmbeddingModelInfo();
    const { useTitle = false, model = embeddingModelInfo.model, forceRebuild = false } = options;

    console.log(`🔧 Building vector index for ${faqs.length} FAQs...`);
    console.log(`   Use title: ${useTitle}`);
    console.log(`   Model: ${model}`);
    console.log(`   Force rebuild: ${forceRebuild}`);

    // Check if rebuild is needed
    if (!forceRebuild && await this.shouldSkipRebuild(model)) {
      console.log('📦 Vector index is up to date, skipping rebuild');
      return;
    }

    // Ensure data directory exists
    await this.ensureDataDir();

    // Check if embedding model is available
    if (!(await isEmbeddingModelAvailable(model))) {
      throw new Error(`Embedding model '${model}' is not available. Please ensure Ollama is running and the model is installed.`);
    }

    // Prepare texts for embedding
    const entries: Omit<VectorIndexEntry, 'embedding'>[] = faqs.map(faq => {
      const text = useTitle 
        ? `${faq.title}\n${faq.answer}`
        : faq.answer;
      
      return {
        id: faq.id,
        text: text.trim(),
        metadata: {
          title: faq.title,
          question_variants: faq.question_variants,
          product_tags: faq.product_tags,
          last_reviewed: faq.last_reviewed
        }
      };
    });

    const texts = entries.map(entry => entry.text);

    try {
      // Generate embeddings in batch
      console.log('🧮 Generating embeddings...');
      const embeddings = await generateEmbeddings(texts, model);

      if (embeddings.length !== entries.length) {
        throw new Error(`Embedding count mismatch: expected ${entries.length}, got ${embeddings.length}`);
      }

      // Create vector index
      const vectorIndex: VectorIndex = {
        version: '1.0.0',
        model,
        created: new Date().toISOString(),
        entries: entries.map((entry, index) => ({
          ...entry,
          embedding: embeddings[index]
        }))
      };

      // Save to disk
      await this.saveIndex(vectorIndex);
      this.currentIndex = vectorIndex;

      console.log(`✅ Vector index built successfully with ${vectorIndex.entries.length} entries`);
      console.log(`💾 Saved to: ${this.indexPath}`);

    } catch (error) {
      console.error('❌ Failed to build vector index:', error);
      throw new Error(`Failed to build vector index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for similar entries using cosine similarity
   * @param query Search query text
   * @param k Number of results to return (default: 3)
   * @param model Embedding model to use for query
   * @returns Array of search results sorted by similarity score
   */
  async search(query: string, k: number = 3, model?: string): Promise<SearchResult[]> {
    // Load index if not already loaded
    if (!this.currentIndex) {
      await this.loadIndex();
    }

    if (!this.currentIndex || this.currentIndex.entries.length === 0) {
      throw new Error('Vector index is empty or not available. Please build the index first.');
    }

    // Use same model as index if not specified
    const searchModel = model || this.currentIndex.model;

    try {
      // Generate embedding for query
      const queryEmbedding = await generateEmbedding(query.trim(), searchModel);

      // Calculate similarities
      const similarities = this.currentIndex.entries.map(entry => {
        const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
        
        return {
          id: entry.id,
          text: entry.text,
          score: similarity,
          metadata: entry.metadata
        };
      });

      // Sort by similarity score (descending) and return top-k
      return similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

    } catch (error) {
      console.error('❌ Vector search failed:', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load index from disk
   */
  async loadIndex(): Promise<VectorIndex | null> {
    try {
      if (!(await this.indexExists())) {
        console.log('📁 Vector index file does not exist');
        return null;
      }

      const content = await fs.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(content) as VectorIndex;

      // Validate index structure
      if (!index.version || !index.model || !index.entries) {
        throw new Error('Invalid vector index format');
      }

      this.currentIndex = index;
      console.log(`📦 Loaded vector index with ${index.entries.length} entries (model: ${index.model})`);
      
      return index;

    } catch (error) {
      console.error('❌ Failed to load vector index:', error);
      throw new Error(`Failed to load vector index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(index: VectorIndex): Promise<void> {
    try {
      await this.ensureDataDir();
      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save vector index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if index file exists
   */
  private async indexExists(): Promise<boolean> {
    try {
      await fs.access(this.indexPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create data directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if rebuild should be skipped (index exists and model hasn't changed)
   */
  private async shouldSkipRebuild(model: string): Promise<boolean> {
    try {
      const existingIndex = await this.loadIndex();
      return existingIndex?.model === model;
    } catch {
      return false;
    }
  }

  /**
   * Get index information
   */
  async getIndexInfo(): Promise<{
    exists: boolean;
    entries?: number;
    model?: string;
    created?: string;
    version?: string;
  }> {
    try {
      if (!(await this.indexExists())) {
        return { exists: false };
      }

      if (!this.currentIndex) {
        await this.loadIndex();
      }

      if (!this.currentIndex) {
        return { exists: false };
      }

      return {
        exists: true,
        entries: this.currentIndex.entries.length,
        model: this.currentIndex.model,
        created: this.currentIndex.created,
        version: this.currentIndex.version
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Clear the index (delete file and reset memory)
   */
  async clearIndex(): Promise<void> {
    try {
      if (await this.indexExists()) {
        await fs.unlink(this.indexPath);
      }
      this.currentIndex = null;
      console.log('🗑️  Vector index cleared');
    } catch (error) {
      throw new Error(`Failed to clear vector index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const vectorStore = new VectorStore();
