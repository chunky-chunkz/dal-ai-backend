# Local LLM Integration with Ollama

This module provides a wrapper for integrating Ollama's local LLM capabilities into the chatbot backend.

## Setup

1. **Install Ollama**: Make sure Ollama is installed and running on your system
2. **Install Model**: `ollama pull phi3:mini`
3. **Environment Variables**: Configure in `.env`:
   ```
   OLLAMA_URL=http://127.0.0.1:11434
   LLM_MODEL=phi3:mini
   ```

## Usage

### Basic Text Generation

```typescript
import { localLLM } from './ai/localLLM.js';

const response = await localLLM.generate({
  model: 'phi3:mini',
  prompt: 'What is the capital of Germany?',
  system: 'You are a helpful assistant.',
  temperature: 0.2,
  maxTokens: 100
});

console.log(response); // "Berlin"
```

### Streaming Generation

```typescript
import { localLLM } from './ai/localLLM.js';

const response = await localLLM.stream({
  model: 'phi3:mini',
  prompt: 'Explain AI in simple terms',
  temperature: 0.3,
  maxTokens: 200,
  onToken: (chunk) => {
    // Handle each chunk as it arrives
    console.log(chunk);
  }
});

console.log('Full response:', response);
```

### Model Management

```typescript
// Check if a model is available
const isAvailable = await localLLM.isModelAvailable('phi3:mini');

// List all available models
const models = await localLLM.listModels();
```

## API Reference

### `localLLM.generate(options)`

Generates text using the specified model.

**Parameters:**
- `model: string` - The model name (e.g., 'phi3:mini')
- `prompt: string` - The user prompt
- `system?: string` - Optional system prompt
- `temperature?: number` - Temperature (0-1, default: 0.2)
- `maxTokens?: number` - Maximum tokens to generate (default: 220)

**Returns:** `Promise<string>` - The generated text response

### `localLLM.stream(options)`

Streams text generation with real-time token callbacks.

**Parameters:**
- All parameters from `generate()`, plus:
- `onToken: (chunk: string) => void` - Callback for each token/chunk

**Returns:** `Promise<string>` - The complete generated text

### `localLLM.isModelAvailable(model)`

Checks if a specific model is available locally.

**Returns:** `Promise<boolean>`

### `localLLM.listModels()`

Lists all available models.

**Returns:** `Promise<string[]>`

## Error Handling

The module provides meaningful error messages for common issues:

- **Connection errors**: When Ollama service is not running
- **Model errors**: When specified model is not installed
- **Generation errors**: When text generation fails

All errors are wrapped in user-friendly messages without exposing internal stack traces.

## Integration Examples

### FAQ Enhancement

```typescript
// Enhance FAQ responses with AI
const enhancedAnswer = await localLLM.generate({
  model: process.env.LLM_MODEL!,
  prompt: `Customer question: "${userQuestion}"
  
  FAQ Answer: ${faqAnswer}
  
  Please provide a personalized, friendly response.`,
  system: 'You are a helpful customer service assistant.',
  temperature: 0.3,
  maxTokens: 300
});
```

### Real-time Chat

```typescript
// Streaming chat response
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked'
  });

  await localLLM.stream({
    model: process.env.LLM_MODEL!,
    prompt: message,
    onToken: (chunk) => {
      res.write(chunk);
    }
  });

  res.end();
});
```

## Performance Notes

- **First request**: May take longer as the model loads
- **Subsequent requests**: Much faster due to model caching
- **Streaming**: Provides better user experience for longer responses
- **Temperature**: Lower values (0.1-0.3) for factual responses, higher (0.7-0.9) for creative content

## Testing

Run the test suite:
```bash
npm test -- src/tests/localLLM.test.ts
```

Test basic functionality:
```bash
npx tsx src/test-llm.ts
```

Test FAQ integration:
```bash
npx tsx src/test-faq-integration.ts
```
