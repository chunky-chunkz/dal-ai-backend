/**
 * Task: Hybrid retrieval.
 * - bm25.search(query, 10) + vectorStore.search(query, 10)
 * - normalize to [0..1], fuse by weighted sum (w_vec=0.6, w_kw=0.4)
 * - dedupe by id, return top 5 with fusedScore
 */

import { vectorStore } from './vectorStore.js';

// BM25 search result interface
interface BM25Result {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

// Vector search result interface (reusing from rag.local.ts)
interface VectorSearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

// Hybrid search result with fused score
export interface HybridSearchResult {
  id: string;
  text: string;
  fusedScore: number;
  vectorScore: number;
  bm25Score: number;
  metadata?: Record<string, any>;
}

// Mock BM25 implementation (placeholder until real BM25 is available)
class MockBM25 {
  /**
   * Simple keyword-based search (placeholder for real BM25)
   */
  async search(query: string, _limit: number = 10): Promise<BM25Result[]> {
    // This is a simplified keyword search
    // In production, you'd use a proper BM25 implementation like:
    // - Elasticsearch
    // - Lucene
    // - js-bm25 library
    
    // For now, return empty results to indicate BM25 not implemented
    // The hybrid search will fall back to vector-only results
    console.log(`🔍 BM25 search (mock) for: "${query}" - returning empty results`);
    return [];
  }
}

// Initialize mock BM25
const bm25 = new MockBM25();

/**
 * Normalize scores to [0..1] range
 */
function normalizeScores(results: Array<{ score: number }>): number[] {
  if (results.length === 0) return [];
  
  const scores = results.map(r => r.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  
  // Avoid division by zero
  if (maxScore === minScore) {
    return scores.map(() => 1.0);
  }
  
  return scores.map(score => (score - minScore) / (maxScore - minScore));
}

/**
 * Hybrid search combining BM25 and vector search
 * @param query Search query
 * @param limit Maximum number of results to return (default: 5)
 * @param vectorWeight Weight for vector scores (default: 0.6)
 * @param bm25Weight Weight for BM25 scores (default: 0.4)
 * @returns Promise<HybridSearchResult[]>
 */
export async function hybridSearch(
  query: string,
  limit: number = 5,
  vectorWeight: number = 0.6,
  bm25Weight: number = 0.4
): Promise<HybridSearchResult[]> {
  try {
    console.log(`🔬 Hybrid search: "${query}" (w_vec=${vectorWeight}, w_bm25=${bm25Weight})`);
    
    // Parallel search execution
    const [vectorResults, bm25Results] = await Promise.all([
      vectorStore.search(query, 10),
      bm25.search(query, 10)
    ]);

    console.log(`   Vector results: ${vectorResults.length}, BM25 results: ${bm25Results.length}`);

    // Normalize scores to [0..1]
    const normalizedVectorScores = normalizeScores(vectorResults);
    const normalizedBM25Scores = normalizeScores(bm25Results);

    // Create score maps for fusion
    const vectorScoreMap = new Map<string, { score: number, result: VectorSearchResult }>();
    vectorResults.forEach((result, index) => {
      vectorScoreMap.set(result.id, {
        score: normalizedVectorScores[index],
        result
      });
    });

    const bm25ScoreMap = new Map<string, { score: number, result: BM25Result }>();
    bm25Results.forEach((result, index) => {
      bm25ScoreMap.set(result.id, {
        score: normalizedBM25Scores[index],
        result
      });
    });

    // Collect all unique document IDs
    const allIds = new Set([
      ...vectorResults.map(r => r.id),
      ...bm25Results.map(r => r.id)
    ]);

    // Fuse scores using weighted sum
    const fusedResults: HybridSearchResult[] = [];
    
    for (const id of allIds) {
      const vectorData = vectorScoreMap.get(id);
      const bm25Data = bm25ScoreMap.get(id);
      
      const vectorScore = vectorData?.score || 0;
      const bm25Score = bm25Data?.score || 0;
      
      // Weighted fusion
      const fusedScore = (vectorScore * vectorWeight) + (bm25Score * bm25Weight);
      
      // Use the result data from whichever source has it
      const resultData = vectorData?.result || bm25Data?.result;
      
      if (resultData) {
        fusedResults.push({
          id,
          text: resultData.text,
          fusedScore,
          vectorScore: vectorData?.score || 0,
          bm25Score: bm25Data?.score || 0,
          metadata: resultData.metadata
        });
      }
    }

    // Sort by fused score (descending) and return top results
    const topResults = fusedResults
      .sort((a, b) => b.fusedScore - a.fusedScore)
      .slice(0, limit);

    console.log(`   Final results: ${topResults.length}, top score: ${topResults[0]?.fusedScore.toFixed(3)}`);
    
    return topResults;

  } catch (error) {
    console.error('Error in hybrid search:', error);
    
    // Fallback to vector-only search
    console.log('   Falling back to vector-only search');
    const vectorResults = await vectorStore.search(query, limit);
    
    return vectorResults.map(result => ({
      id: result.id,
      text: result.text,
      fusedScore: result.score,
      vectorScore: result.score,
      bm25Score: 0,
      metadata: result.metadata
    }));
  }
}

/**
 * Get hybrid search statistics
 */
export function getHybridSearchConfig() {
  return {
    defaultVectorWeight: 0.6,
    defaultBM25Weight: 0.4,
    defaultLimit: 5,
    bm25Available: false // Will be true when real BM25 is implemented
  };
}
