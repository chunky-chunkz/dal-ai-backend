# LLM Health Check Script

## Overview
The `check-llm.ts` script provides comprehensive health checking for the local LLM pipeline using Ollama.

## Location
`src/scripts/check-llm.ts`

## Purpose
Validates the entire LLM pipeline to ensure it's ready for production use.

## Health Checks Performed

### 1. **Ollama Connection Check**
- Tests HTTP connectivity to `OLLAMA_URL` (default: `http://127.0.0.1:11434`)
- Calls `/api/tags` endpoint to verify service is running
- Reports number of installed models

### 2. **Model Availability Check**  
- Verifies that `LLM_MODEL` (from env) exists in Ollama
- Lists available models if target model is missing
- Provides installation commands for missing models
- Special handling for custom `sunrise-phi3` model

### 3. **LLM Generation Test**
- Performs actual text generation with the configured model
- Uses test prompt: `"Antworte 'OK' auf Deutsch."`
- Expects response containing "OK"
- Uses low temperature (0.1) for deterministic results

## Usage

### Command Line
```bash
# From backend directory
npm run check:llm

# Or directly with tsx
tsx src/scripts/check-llm.ts
```

### Exit Codes
- **0**: All checks passed - LLM pipeline is ready
- **1**: One or more checks failed - issues need resolution

### Example Output (Success)
```
🚀 Starting Local LLM Health Check...

📋 Configuration:
   OLLAMA_URL: http://127.0.0.1:11434
   LLM_MODEL: sunrise-phi3

🔍 Checking Ollama connection at http://127.0.0.1:11434...
✅ Ollama is running and reachable
📋 Found 2 models installed

🔍 Checking if model 'sunrise-phi3' is available...
✅ Model 'sunrise-phi3' is installed

🔍 Testing LLM generation with model 'sunrise-phi3'...
✅ LLM generation test passed
   Response: "OK"

🎉 All LLM health checks passed!
✅ Local LLM pipeline is ready for use
```

### Example Output (Failure)
```
🚀 Starting Local LLM Health Check...

📋 Configuration:
   OLLAMA_URL: http://127.0.0.1:11434
   LLM_MODEL: non-existent-model

🔍 Checking Ollama connection at http://127.0.0.1:11434...
❌ Failed to connect to Ollama at http://127.0.0.1:11434
   Error: fetch failed
   💡 Make sure Ollama is installed and running:
      - Install: https://ollama.ai/download
      - Start: ollama serve

💥 LLM health check failed
❌ Please fix the issues above before using the LLM pipeline
```

## Integration

### CI/CD Pipeline
Add to your build/deployment scripts:
```bash
npm run check:llm || exit 1
```

### Docker Health Check
Can be used as a health check in Docker containers:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD npm run check:llm
```

### Startup Validation  
Run during application startup to ensure dependencies are ready:
```typescript
import { checkLLMHealth } from './scripts/check-llm.js';

async function startServer() {
  const healthCode = await checkLLMHealth();
  if (healthCode !== 0) {
    process.exit(1);
  }
  // Continue with server startup...
}
```

## Exported Functions
The script exports functions for programmatic use:
- `checkLLMHealth(): Promise<number>` - Main health check
- `checkOllamaConnection(): Promise<boolean>` - Connection test
- `checkModelExists(): Promise<boolean>` - Model availability
- `testLLMGeneration(): Promise<boolean>` - Generation test

## Error Scenarios

### Common Issues and Solutions

1. **Ollama not running**
   ```
   ❌ Failed to connect to Ollama
   💡 Make sure Ollama is installed and running
   ```
   **Solution**: Start Ollama service with `ollama serve`

2. **Model not installed**
   ```
   ❌ Model 'sunrise-phi3' not found
   💡 To install the missing model, run: ollama pull sunrise-phi3
   ```
   **Solution**: Install missing model or create custom model

3. **Generation failure**
   ```
   ❌ LLM generation test failed
   💡 The model may not be responding correctly
   ```
   **Solution**: Check model compatibility, restart Ollama, or reinstall model

## Configuration
Uses environment variables from `.env`:
- `OLLAMA_URL`: Ollama service endpoint
- `LLM_MODEL`: Model name to test

Default values:
- `OLLAMA_URL`: `http://127.0.0.1:11434`
- `LLM_MODEL`: `phi3:mini`
