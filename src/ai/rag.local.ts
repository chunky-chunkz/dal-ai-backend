/**
 * Task: Include persistent user memory context in RAG prompt.
 * - retrieveForPrompt(userId, question) -> build user memory context
 * - Enhanced Memory System handles conversation history via semantic search
 * - Add memory contexts before the question
 * - After generating, evaluate for new memories
 */

import { localLLM } from './localLLM.js';
import { vectorStore } from './vectorStore.js';
import { chooseModel } from './modelRouter.js';
import { retrieveForPrompt } from '../memory/retriever.js';
import { evaluateAndMaybeStore } from '../memory/manager.js';
import { hybridSearch, type HybridSearchResult } from './hybridSearch.js';
import { smartFallback } from './smartFallback.js';
import { searchDocuments, type DocumentSearchResult } from '../services/document.service.js';

// Vector store search result interface (using the actual vectorStore interface)
interface VectorSearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

// RAG response interface
interface RagResponse {
  answer: string;
  confidence: number;
  sourceIds: string[];
  source?: 'local' | 'cloud';
  modelUsed?: string;
}

// RAG streaming interface - updated to match requirements
interface RagStreamResult {
  onToken: (callback: (chunk: string) => void) => void;
  done(): Promise<RagResponse>;
}

/**
 * Normalize cosine score to confidence [0..1]
 * Formula: (score - 0.5) / 0.5, clipped to [0..1]
 */
function normalizeConfidence(topScore: number): number {
  const normalized = (topScore - 0.5) / 0.5;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Convert hybrid search results to vector search format
 */
function convertHybridToVectorResults(hybridResults: HybridSearchResult[]): VectorSearchResult[] {
  return hybridResults.map(result => ({
    id: result.id,
    text: result.text,
    score: result.fusedScore,
    metadata: result.metadata
  }));
}

/**
 * Build a compact German context from search results (top-3, ≤1200 chars each, remove fluff)
 */
function buildCompactGermanContext(searchResults: VectorSearchResult[]): string {
  // Take only top 3 results for better focus
  const topResults = searchResults.slice(0, 3);
  
  return topResults
    .map((result, index) => {
      let text = result.text;
      
      // Remove common fluff phrases and filler words
      text = text
        .replace(/\b(wie Sie wissen|bekanntlich|selbstverständlich|natürlich|offensichtlich)\b/gi, '')
        .replace(/\b(um ehrlich zu sein|ehrlich gesagt|wie gesagt|wie bereits erwähnt)\b/gi, '')
        .replace(/\b(meiner Meinung nach|ich denke|ich glaube|vermutlich)\b/gi, '')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Limit to 1200 characters per snippet
      if (text.length > 1200) {
        // Try to cut at sentence boundary
        const truncated = text.substring(0, 1200);
        const lastSentence = truncated.lastIndexOf('.');
        if (lastSentence > 800) { // Only if we have a meaningful sentence
          text = truncated.substring(0, lastSentence + 1);
        } else {
          text = truncated + '...';
        }
      }
      
      return `${index + 1}. ${text}`;
    })
    .join('\n\n');
}

/**
 * Build system and user prompts for Sunrise support including persistent memory and conversation history
 */
async function buildSunrisePromptsWithMemory(
  question: string, 
  searchResults: VectorSearchResult[], 
  userId?: string,
  sessionId?: string, 
  userContext?: string
): Promise<{ system: string; prompt: string }> {
  const context = buildCompactGermanContext(searchResults);
  
  // Improved system prompt: concise, strict
  const system = 'Du bist ein deutschsprachiger Support-Assistent von Sunrise. Antworte nur mit Fakten aus dem Kontext oder dem Verlauf. Wenn Info fehlt: "Ich bin unsicher – soll ich ein Ticket erstellen?" Antworte in 1–5 Sätzen, präzise, ohne PII.';
  
  let prompt = '';
  
  // Add persistent user memory context if userId provided
  if (userId) {
    try {
      const { context: memoryContext } = await retrieveForPrompt(userId, question, 5);
      if (memoryContext.trim()) {
        prompt += `${memoryContext}\n`;
      }
    } catch (error) {
      console.error('❌ Error retrieving user memory:', error);
    }
  }
  
  // Add user-specific context if provided
  if (userContext && userContext.trim()) {
    prompt += `${userContext}\n`;
  }
  
  // Enhanced Memory System now handles conversation history via semantic search
  // Recent conversations are retrieved based on relevance to current question
  // Additional conversation context can be retrieved via retrieveForPrompt() if needed
  if (sessionId) {
    try {
      const { context: conversationMemory } = await retrieveForPrompt(sessionId, question, 3);
      if (conversationMemory.trim()) {
        prompt += `Letzte Gespräche:\n${conversationMemory}\n`;
      }
    } catch (error) {
      console.error('❌ Error retrieving conversation memory:', error);
    }
  }
  
  prompt += `Kontext:\n${context}\n\nFrage: ${question}`;

  return { system, prompt };
}

/**
 * Build system and user prompts for Sunrise support (legacy without memory)
 */
function buildSunrisePrompts(question: string, searchResults: VectorSearchResult[]): { system: string; prompt: string } {
  const context = buildCompactGermanContext(searchResults);
  
  // Improved system prompt: concise, strict
  const system = 'Du bist ein deutschsprachiger Support-Assistent von Sunrise. Antworte nur mit Fakten aus dem Kontext oder dem Verlauf. Wenn Info fehlt: "Ich bin unsicher – soll ich ein Ticket erstellen?" Antworte in 1–5 Sätzen, präzise, ohne PII.';
  
  const prompt = `Kontext:\n${context}\n\nFrage: ${question}`;

  return { system, prompt };
}

/**
 * Main RAG function using local LLM - updated to use real vector store
 * @param question User's question
 * @param k Number of documents to retrieve (default: 3)
 * @param sessionId Optional session ID for conversation memory
 * @param useHybridSearch Whether to use hybrid search (default: false for now)
 * @param userContext Optional user-specific context/memories for personalization
 * @returns Promise<RagResponse>
 */
export async function ragLocalAnswer(question: string, k: number = 3, sessionId?: string, useHybridSearch: boolean = false, userContext?: string): Promise<RagResponse> {
  try {
    // Enhanced Memory System handles conversation storage automatically
    // Memories are extracted via evaluateAndMaybeStore() after response generation

    // Step 1: Retrieve relevant documents using hybrid or vector search + document chunks
    let searchResults: VectorSearchResult[] = [];
    
    if (useHybridSearch) {
      console.log('🔬 Using hybrid search');
      const hybridResults = await hybridSearch(question, k);
      searchResults = convertHybridToVectorResults(hybridResults);
    } else {
      console.log('🔍 Using vector search');
      searchResults = await vectorStore.search(question, k);
    }
    
    // Also search uploaded documents
    console.log('📚 Searching uploaded documents...');
    const docResults = await searchDocuments(question, k);
    
    // Convert document results to VectorSearchResult format
    const docVectorResults: VectorSearchResult[] = docResults.map(doc => ({
      id: `doc:${doc.documentId}:chunk:${doc.chunkIndex}`,
      text: doc.text,
      score: doc.score,
      metadata: {
        type: 'document',
        documentId: doc.documentId,
        filename: doc.filename,
        chunkIndex: doc.chunkIndex
      }
    }));
    
    // Merge FAQ and document results, sort by score
    searchResults = [...searchResults, ...docVectorResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, k * 2); // Keep more results since we have two sources
    
    console.log(`📊 Combined search: ${searchResults.length} results (${docResults.length} from documents)`);
    
    if (searchResults.length === 0) {
      return {
        answer: 'Ich bin unsicher – soll ich ein Ticket erstellen?',
        confidence: 0.1,
        sourceIds: []
      };
    }

    // Step 2: Choose appropriate model based on context
    const topVecScore = searchResults.length > 0 ? searchResults[0].score : undefined;
    const selectedModel = chooseModel(topVecScore, question.length);

    // Step 3: Build system and user prompts with memory context
    const { system, prompt } = await buildSunrisePromptsWithMemory(question, searchResults, sessionId, sessionId, userContext);

    // Step 4: Generate answer using smart fallback (local first, cloud if needed)
    const smartResult = await smartFallback(
      system,
      prompt,
      selectedModel,
      question.length,
      searchResults.map(result => result.id)
    );

    // Step 5: Evaluate answer for new memories (async, don't block response)
    if (sessionId) {
      // Extract and store new memories from user utterance
      evaluateAndMaybeStore(sessionId, question).catch(error => {
        console.error('❌ Error evaluating memory:', error);
      });
    }

    // Enhanced Memory System now handles conversation storage automatically
    // No need for manual putTurn() calls

    return {
      answer: smartResult.answer,
      confidence: smartResult.confidence,
      sourceIds: smartResult.sourceIds,
      source: smartResult.source,
      modelUsed: smartResult.modelUsed
    };

  } catch (error) {
    console.error('RAG Local Answer Error:', error);
    return {
      answer: 'Es tut mir leid, es ist ein technisches Problem aufgetreten. Bitte versuchen Sie es später erneut oder kontaktieren Sie unseren Support.',
      confidence: 0.0,
      sourceIds: []
    };
  }
}

/**
 * Main RAG Streaming Orchestrator - implements the requirements
 * @param question User's question
 * @param signal Optional AbortSignal for cancellation
 * @param k Number of documents to retrieve (default: 3)
 * @param useHybridSearch Whether to use hybrid search (default: false for now)
 * @param sessionId Optional session ID for conversation memory
 * @returns RagStreamResult with onToken passthrough and done() promise
 */
export function ragLocalAnswerStream(
  question: string, 
  signal?: AbortSignal,
  k: number = 3,
  useHybridSearch: boolean = false,
  sessionId?: string
): RagStreamResult {
  const tokenCallbacks: Array<(chunk: string) => void> = [];

  // The actual streaming process
  const streamingProcess = async (): Promise<RagResponse> => {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new Error('Request was aborted');
      }

      // Step 1: Retrieve relevant documents using hybrid or vector search
      let searchResults: VectorSearchResult[];
      
      if (useHybridSearch) {
        console.log('🔬 Using hybrid search (streaming)');
        const hybridResults = await hybridSearch(question, k);
        searchResults = convertHybridToVectorResults(hybridResults);
      } else {
        console.log('🔍 Using vector search (streaming)');
        searchResults = await vectorStore.search(question, k);
      }
      
      if (searchResults.length === 0) {
        const fallbackAnswer = 'Ich bin unsicher – soll ich ein Ticket erstellen?';
        
        // Stream fallback character by character
        for (const char of fallbackAnswer) {
          if (signal?.aborted) {
            throw new Error('Request was aborted');
          }
          tokenCallbacks.forEach(callback => callback(char));
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        const result = {
          answer: fallbackAnswer,
          confidence: 0.1,
          sourceIds: []
        };
        return result;
      }

      // Step 2: Choose appropriate model based on context
      const topVecScore = searchResults.length > 0 ? searchResults[0].score : undefined;
      const selectedModel = chooseModel(topVecScore, question.length);

      // Step 3: Build compact German context (numbered, trimmed) + system/user prompts
      const { system, prompt } = sessionId 
        ? await buildSunrisePromptsWithMemory(question, searchResults, sessionId, sessionId)
        : buildSunrisePrompts(question, searchResults);

      // Step 4: Call localLLM.stream with selected model
      const answer = await localLLM.stream({
        model: selectedModel,
        prompt,
        system,
        temperature: 0.2,
        maxTokens: 220,
        signal,
        onToken: (chunk: string) => {
          // onToken passthrough to all registered callbacks
          tokenCallbacks.forEach(callback => callback(chunk));
        }
      });

      // Step 4: Compute confidence from top vector score (normalize cosine: (s-0.5)/0.5 clipped to [0..1])
      const topScore = searchResults.length > 0 ? searchResults[0].score : 0;
      const confidence = normalizeConfidence(topScore);
      const sourceIds = searchResults.map(result => result.id);

      const result = {
        answer: answer.trim(),
        confidence,
        sourceIds
      };
      
      return result;

    } catch (error) {
      console.error('RAG Local Answer Stream Error:', error);
      
      // Handle abort errors specifically
      if (error instanceof Error && error.message.includes('aborted')) {
        throw error;
      }
      
      const errorMessage = 'Es tut mir leid, es ist ein technisches Problem aufgetreten. Bitte versuchen Sie es später erneut oder kontaktieren Sie unseren Support.';
      
      // Stream error message
      for (const char of errorMessage) {
        if (signal?.aborted) {
          throw new Error('Request was aborted');
        }
        tokenCallbacks.forEach(callback => callback(char));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const result = {
        answer: errorMessage,
        confidence: 0.0,
        sourceIds: []
      };
      
      return result;
    }
  };

  // Start the streaming process
  const streamPromise = streamingProcess();

  // Return the required interface
  return {
    onToken: (callback: (chunk: string) => void) => {
      tokenCallbacks.push(callback);
    },
    done: (): Promise<RagResponse> => {
      return streamPromise;
    }
  };
}

// Export types for convenience
export type { VectorSearchResult, RagResponse, RagStreamResult };
