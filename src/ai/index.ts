/**
 * AI module exports
 */

export { localLLM } from './localLLM.js';
export type { GenerateOptions, StreamOptions } from './localLLM.js';

export { 
  ragLocalAnswer, 
  ragLocalAnswerStream
} from './rag.local.js';
export type { 
  VectorSearchResult, 
  RagResponse, 
  RagStreamResult 
} from './rag.local.js';

export { chooseModel, getModelConfig, isModelConfigured } from './modelRouter.js';
