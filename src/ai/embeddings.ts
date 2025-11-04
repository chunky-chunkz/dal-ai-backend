/**
 * Task: Embedding helper with @xenova/transformers.
 * Requirements:
 * - export async function embedTexts(texts:string[]): Promise<number[][]>
 * - Model via EMBEDDING_MODEL env; default 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'.
 * - Cache vectors in src/data/embeddings.json keyed by exact text (string).
 * - Batch inference; pooling='mean', normalize=true.
 * - Safe JSON read/write; recreate cache if model changed/corrupted.
 */

import { pipeline, env } from '@xenova/transformers';
import fs from 'fs/promises';
import path from 'path';

// Configure transformers environment
env.allowRemoteModels = true;
env.allowLocalModels = true;

// Set cache directory to avoid repeated downloads
env.cacheDir = path.resolve('src/data/.cache');

// Increase timeout for slow connections (30 seconds)
if (typeof env.remoteModelFetchTimeout === 'number') {
  env.remoteModelFetchTimeout = 30000;
}

interface EmbeddingCache {
  model: string;
  version: string;
  created: string;
  embeddings: Record<string, number[]>;
}

interface FeatureExtractionPipeline {
  (texts: string | string[], options?: any): Promise<any>;
}

class EmbeddingService {
  private cachePath: string;
  private dataDir: string;
  private model: string;
  private pipeline: FeatureExtractionPipeline | null = null;
  private cache: EmbeddingCache | null = null;

  constructor() {
    // Use Xenova's distilbert model which is smaller and more reliable
    this.model = process.env.EMBEDDING_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
    this.cachePath = path.resolve('src/data/embeddings.json');
    this.dataDir = path.dirname(this.cachePath);
  }

  /**
   * Initialize the embedding pipeline
   */
  private async initializePipeline(): Promise<void> {
    if (this.pipeline) return;

    try {
      console.log(`🔧 Loading embedding model: ${this.model}`);
      
      // Try with quantized model first (smaller, faster download)
      this.pipeline = await pipeline('feature-extraction', this.model, {
        quantized: true,
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && progress.file) {
            console.log(`📥 Downloading ${progress.file}: ${progress.progress?.toFixed(0) || 0}%`);
          }
        }
      }) as FeatureExtractionPipeline;
      
      console.log('✅ Embedding model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load embedding model:', error);
      console.log('💡 Trying alternative model: Xenova/all-MiniLM-L6-v2');
      
      // Fallback to a smaller, more reliable model
      try {
        this.model = 'Xenova/all-MiniLM-L6-v2';
        this.pipeline = await pipeline('feature-extraction', this.model, {
          quantized: true
        }) as FeatureExtractionPipeline;
        console.log('✅ Fallback embedding model loaded successfully');
      } catch (fallbackError) {
        console.error('❌ Fallback model also failed:', fallbackError);
        throw new Error(`Failed to load any embedding model. Please check your internet connection and try again. Original error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Load embedding cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      await this.ensureDataDir();

      if (!(await this.cacheExists())) {
        console.log('📁 Creating new embedding cache');
        this.cache = this.createEmptyCache();
        return;
      }

      const content = await fs.readFile(this.cachePath, 'utf-8');
      const cache = JSON.parse(content) as EmbeddingCache;

      // Validate cache structure and model consistency
      if (!cache.model || !cache.embeddings || cache.model !== this.model) {
        console.log(`🔄 Cache model mismatch or corruption, recreating (cache: ${cache.model}, current: ${this.model})`);
        this.cache = this.createEmptyCache();
        return;
      }

  this.cache = cache;
  const cacheSize = Object.keys(cache.embeddings).length;
  console.log(`📦 Loaded embedding cache with ${cacheSize} entries`);

    } catch (error) {
      console.warn('⚠️  Failed to load embedding cache, creating new:', error);
      this.cache = this.createEmptyCache();
    }
  }

  /**
   * Save embedding cache to disk
   */
  private async saveCache(): Promise<void> {
    if (!this.cache) return;

    try {
      await this.ensureDataDir();
      // NO pretty-printing (null, 2) to avoid stack overflow with large caches
      await fs.writeFile(this.cachePath, JSON.stringify(this.cache), 'utf-8');
      const cacheSize = Object.keys(this.cache.embeddings).length;
      console.log(`💾 Saved embedding cache with ${cacheSize} entries`);
    } catch (error) {
      console.error('❌ Failed to save embedding cache:', error);
      // Fallback: try to save without cache entries if it's too large
      try {
        console.log('   🔁 Fallback: clearing cache and saving empty structure');
        const emptyCacheStructure = this.createEmptyCache();
        await fs.writeFile(this.cachePath, JSON.stringify(emptyCacheStructure), 'utf-8');
        console.log('⚠️  Saved empty cache structure (fallback)');
      } catch (fallbackError) {
        console.error('❌ Failed to save even empty cache:', fallbackError);
      }
    }
  }

  /**
   * Create empty cache structure
   */
  private createEmptyCache(): EmbeddingCache {
    return {
      model: this.model,
      version: '1.0.0',
      created: new Date().toISOString(),
      embeddings: {}
    };
  }

  /**
   * Check if cache file exists
   */
  private async cacheExists(): Promise<boolean> {
    try {
      await fs.access(this.cachePath);
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
   * Generate embeddings for texts with caching
   * @param texts Array of texts to embed
   * @returns Promise<number[][]> Array of embedding vectors
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Initialize pipeline and cache
    await this.initializePipeline();
    if (!this.cache) await this.loadCache();

    if (!this.pipeline || !this.cache) {
      throw new Error('Failed to initialize embedding service');
    }

    const results: number[][] = [];
    const textsToProcess: string[] = [];
    const textIndices: number[] = [];

    // Check cache for existing embeddings
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i].trim();
      if (this.cache.embeddings[text]) {
        results[i] = this.cache.embeddings[text];
      } else {
        textsToProcess.push(text);
        textIndices.push(i);
      }
    }

    // Process uncached texts in batches
    if (textsToProcess.length > 0) {
      console.log(`🧮 Processing ${textsToProcess.length} new embeddings (${Object.keys(this.cache.embeddings).length} cached)`);
      
      try {
        // Batch process all uncached texts at once
        const embeddings = await this.pipeline(textsToProcess, {
          pooling: 'mean',
          normalize: true
        });
        console.log('   📐 pipeline output dims:', embeddings?.dims);

        // Handle both single and batch results
        let embeddingArray: number[][];
        if (textsToProcess.length === 1) {
          // Single text result - wrap in array
          embeddingArray = [Array.from(embeddings.data)];
        } else {
          // Multiple texts - convert tensor to array
          const dims = embeddings.dims;
          const data = embeddings.data;
          embeddingArray = [];
          
          for (let i = 0; i < textsToProcess.length; i++) {
            const start = i * dims[1];
            const end = start + dims[1];
            embeddingArray.push(Array.from(data.slice(start, end)));
          }
        }
        console.log(`   ✅ got ${embeddingArray.length} vectors len=${embeddingArray[0]?.length}`);

        // Store results and update cache
        for (let i = 0; i < textsToProcess.length; i++) {
          const text = textsToProcess[i];
          const embedding = embeddingArray[i];
          const originalIndex = textIndices[i];
          
          results[originalIndex] = embedding;
          this.cache.embeddings[text] = embedding;
        }

        // Save updated cache
  await this.saveCache();
  const cacheSize = Object.keys(this.cache.embeddings).length;
  console.log(`   💾 cache saved. entries=${cacheSize}`);

      } catch (error) {
        console.error('❌ Failed to generate embeddings:', error);
        throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Get single text embedding (convenience method)
   */
  async embedText(text: string): Promise<number[]> {
    const results = await this.embedTexts([text]);
    return results[0];
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    model: string;
    entries: number;
    created: string;
    version: string;
  }> {
    if (!this.cache) await this.loadCache();
    
    return {
      model: this.cache?.model || this.model,
      entries: Object.keys(this.cache?.embeddings || {}).length,
      created: this.cache?.created || 'Unknown',
      version: this.cache?.version || 'Unknown'
    };
  }

  /**
   * Clear embedding cache
   */
  async clearCache(): Promise<void> {
    try {
      if (await this.cacheExists()) {
        await fs.unlink(this.cachePath);
      }
      this.cache = this.createEmptyCache();
      console.log('🗑️  Embedding cache cleared');
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current model info
   */
  getModelInfo(): {
    model: string;
    provider: string;
    description: string;
  } {
    return {
      model: this.model,
      provider: '@xenova/transformers',
      description: 'Local transformer model for multilingual embeddings'
    };
  }
}

// Lazy-loaded singleton instance
let embeddingService: EmbeddingService | null = null;

/**
 * Get or create the singleton embedding service instance
 */
function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}

/**
 * Generate embeddings for multiple texts with caching
 * @param texts Array of texts to embed
 * @returns Promise<number[][]> Array of embedding vectors
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  return getEmbeddingService().embedTexts(texts);
}

/**
 * Generate embedding for single text (convenience function)
 * @param text Text to embed
 * @returns Promise<number[]> Embedding vector
 */
export async function embedText(text: string): Promise<number[]> {
  return getEmbeddingService().embedText(text);
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  return getEmbeddingService().getCacheStats();
}

/**
 * Clear embedding cache
 */
export async function clearCache() {
  return getEmbeddingService().clearCache();
}

/**
 * Get model information
 */
export function getModelInfo() {
  return getEmbeddingService().getModelInfo();
}

// Legacy compatibility functions for existing code
export async function generateEmbedding(text: string, model?: string): Promise<number[]> {
  if (model) {
    // For now, we ignore the model parameter and use the default
    // TODO: Implement model-specific embedding services
    console.warn(`Custom model ${model} requested but not supported, using default`);
  }
  return embedText(text);
}

export async function generateEmbeddings(texts: string[], model?: string): Promise<number[][]> {
  if (model) {
    // For now, we ignore the model parameter and use the default
    // TODO: Implement model-specific embedding services
    console.warn(`Custom model ${model} requested but not supported, using default`);
  }
  return embedTexts(texts);
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return new Array(vector.length).fill(0);
  return vector.map(val => val / magnitude);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Check if embedding model is available (always true for transformers)
 */
export async function isEmbeddingModelAvailable(model?: string): Promise<boolean> {
  try {
    if (model) {
      // For now, we ignore the model parameter and use the default
      console.warn(`Custom model ${model} requested but not supported, using default`);
    }
    // Test with default model
    await getEmbeddingService().embedText('test');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get embedding model info (legacy compatibility)
 */
export function getEmbeddingModelInfo() {
  return {
    ...getModelInfo(),
    dimensions: 384, // all-MiniLM-L6-v2 dimensions
  };
}
