# RAG Local Implementation

This module implements Retrieval-Augmented Generation (RAG) using local Phi-3 Mini via Ollama for the German telecommunications support chatbot.

## Overview

The RAG system combines:
1. **Document Retrieval**: Searches FAQ database for relevant context
2. **Local LLM Generation**: Uses Phi-3 Mini to generate contextual answers
3. **German Language Support**: Optimized for German customer service responses

## Architecture

```
User Question → Vector Search → Context Retrieval → Prompt Building → Phi-3 → German Answer
```

## Features

- ✅ **Local LLM Integration**: Uses Phi-3 Mini via Ollama (no external API calls)
- ✅ **German Language Optimization**: System prompts and responses in German
- ✅ **Confidence Scoring**: Normalized cosine similarity scores [0..1]
- ✅ **Source Tracking**: Returns FAQ IDs for traceability
- ✅ **Streaming Support**: Real-time token generation
- ✅ **Fallback Handling**: Graceful responses when no context found
- ✅ **Error Resilience**: Handles connection and model errors

## API Reference

### `ragLocalAnswer(question, k?)`

**Parameters:**
- `question: string` - User's question in German
- `k?: number` - Number of documents to retrieve (default: 3)

**Returns:** `Promise<RagResponse>`
```typescript
interface RagResponse {
  answer: string;      // Generated German answer
  confidence: number;  // Normalized score [0..1] 
  sourceIds: string[]; // FAQ IDs used as context
}
```

**Example:**
```typescript
const response = await ragLocalAnswer('Warum ist mein Internet so langsam?');
console.log(response.answer);     // German answer
console.log(response.confidence); // 0.85
console.log(response.sourceIds);  // ['dsl-geschwindigkeit', 'router-reset']
```

### `ragLocalAnswerStream(question, k?, onToken)`

**Parameters:**
- `question: string` - User's question
- `k?: number` - Documents to retrieve (default: 3)  
- `onToken: (chunk: string) => void` - Token callback for streaming

**Returns:** `Promise<RagResponse>` - Final complete response

**Example:**
```typescript
const response = await ragLocalAnswerStream(
  'Wie bezahle ich meine Rechnung?',
  3,
  (chunk) => process.stdout.write(chunk) // Real-time output
);
```

### `ragLocalAnswerStreamAsync(question, k?)`

**Returns:** `RagStreamResult`
```typescript
interface RagStreamResult {
  onToken: (chunk: string) => void;
  donePromise: Promise<RagResponse>;
}
```

**Example:**
```typescript
const { onToken, donePromise } = ragLocalAnswerStreamAsync('Router Probleme');
const response = await donePromise;
```

## Configuration

### Environment Variables

```env
# Required
OLLAMA_URL=http://127.0.0.1:11434
LLM_MODEL=phi3:mini

# Optional
RAG_MAX_TOKENS=300
RAG_TEMPERATURE=0.2
RAG_DEFAULT_K=3
```

### System Prompt

The RAG system uses this German system prompt:
```
"Du bist Sunrise-Support. Antworte kurz, präzise und nur basierend auf dem gegebenen Kontext. Keine Halluzinationen."
```

## Integration Examples

### Basic Usage

```typescript
import { ragLocalAnswer } from './ai/rag.local.js';

// Simple question answering
const response = await ragLocalAnswer('Internet Störung melden');
console.log(`Antwort: ${response.answer}`);
console.log(`Vertrauen: ${(response.confidence * 100).toFixed(1)}%`);
```

### Fastify API Integration

```typescript
import { registerRagRoutes } from './services/rag.api.js';

// Register RAG endpoints
registerRagRoutes(fastify);

// Available endpoints:
// POST /api/rag/answer      - Standard RAG response
// POST /api/rag/stream      - Streaming RAG (SSE)
// GET  /api/rag/health      - Health check
```

### Streaming with React

```typescript
const streamAnswer = async (question: string) => {
  let fullAnswer = '';
  
  await ragLocalAnswerStream(question, 3, (chunk) => {
    fullAnswer += chunk;
    setStreamingText(fullAnswer); // Update React state
  });
};
```

## Confidence Scoring

### Formula
```typescript
confidence = Math.max(0, Math.min(1, (score - 0.5) / 0.5))
```

### Interpretation
- **0.0 - 0.3**: Low confidence, likely fallback response
- **0.3 - 0.7**: Medium confidence, partial match
- **0.7 - 1.0**: High confidence, strong match

### Examples
- `score = 0.9` → `confidence = 0.8`
- `score = 0.75` → `confidence = 0.5` 
- `score = 0.5` → `confidence = 0.0`

## German Language Features

### Response Patterns
- **Formal address**: "Sie" instead of "Du"
- **Service language**: Professional telecommunications terminology
- **Helpful tone**: Constructive problem-solving approach

### Common Phrases
- "Führen Sie zunächst..." (First, perform...)
- "Bei weiteren Fragen..." (For further questions...)
- "Wenden Sie sich an..." (Please contact...)

## Vector Store Interface

Currently uses a mock implementation that wraps the existing FAQ repository:

```typescript
interface VectorSearchResult {
  id: string;     // FAQ ID
  text: string;   // Combined title + answer
  score: number;  // Similarity score
}

// Mock implementation
class MockVectorStore {
  async search(question: string, k: number): Promise<VectorSearchResult[]>
}
```

### Future Implementation
For production, replace with:
- **Sentence Transformers**: German-optimized embeddings
- **Vector Database**: Pinecone, Weaviate, or local FAISS
- **Embedding Models**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`

## Testing

### Unit Tests
```bash
npm test -- src/tests/rag.local.test.ts
```

### Manual Testing
```bash
npm run test:rag
```

### Test Coverage
- ✅ Basic RAG functionality
- ✅ Streaming responses  
- ✅ Confidence scoring
- ✅ German language support
- ✅ Error handling
- ✅ Source ID tracking

## Performance Metrics

### Response Times
- **First request**: ~3-5 seconds (model loading)
- **Subsequent requests**: ~1-2 seconds
- **Streaming**: Immediate first token, ~50ms per token

### Memory Usage
- **Phi-3 Mini**: ~1.5GB VRAM/RAM
- **FAQ Database**: ~50KB in memory
- **Peak usage**: ~2GB during generation

## Error Handling

### Connection Errors
```typescript
// Ollama service not available
{
  answer: "Es tut mir leid, es ist ein technisches Problem aufgetreten...",
  confidence: 0.0,
  sourceIds: []
}
```

### Model Errors
```typescript
// Model not loaded or failed
{
  answer: "Bitte versuchen Sie es später erneut...", 
  confidence: 0.0,
  sourceIds: []
}
```

### Graceful Degradation
- Falls back to existing FAQ search if RAG fails
- Provides helpful error messages in German
- Maintains service availability

## Monitoring & Observability

### Key Metrics
- Response time percentiles
- Confidence score distribution
- Source ID hit rates
- Error rates by type

### Logging
```typescript
console.log('RAG Query:', { question, confidence, sourceIds, responseTime });
```

## Roadmap

### Phase 1: Current ✅
- Basic RAG with mock vector store
- Local Phi-3 integration
- German language optimization

### Phase 2: Enhanced Vector Store
- Real embedding-based search
- Multilingual support improvements
- Performance optimizations

### Phase 3: Advanced Features
- Question intent classification
- Multi-step reasoning
- Personalized responses

## Troubleshooting

### Common Issues

**"Model not found"**
```bash
ollama pull phi3:mini
```

**"Connection refused"**
```bash
ollama serve  # Or ensure Ollama service is running
```

**"Low confidence scores"**
- Check FAQ database relevance
- Adjust confidence normalization formula
- Improve vector search algorithm

**"German responses mixed with English"**
- Verify system prompt language
- Check model language capabilities
- Review FAQ source content
