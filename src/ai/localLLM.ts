/**
 * Task: Create Ollama client wrapper for local LLM (Phi-3 Mini).
 * Requirements:
 * - Use direct fetch to Ollama API for ngrok compatibility.
 * - Read OLLAMA_BASE_URL from process.env (default http://127.0.0.1:11434).
 * - Export localLLM.generate({ model, prompt, system?, temperature?, maxTokens? }):
 *    - Call Ollama chat API (messages: optional system + user).
 *    - Defaults: temperature=0.2, maxTokens=220.
 *    - Return trimmed string content.
 * - Export localLLM.stream(...) variant:
 *    - Streaming via chat API, invoke onToken callback(textChunk) for incremental UI.
 *    - Return full concatenated text at the end.
 * - Handle errors with meaningful messages; never throw raw stack to caller.
 */

interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface StreamOptions extends GenerateOptions {
  onToken: (chunk: string) => void;
  signal?: AbortSignal;
}

class LocalLLM {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  }

  /**
   * Get fetch options with ngrok headers for compatibility
   */
  private getFetchOptions(method: string = 'GET', body?: any): RequestInit {
    return {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: body ? JSON.stringify(body) : undefined,
    };
  }

  /**
   * Generate response using Ollama chat API
   * @param options Generation options with prompt, model, and optional parameters
   * @returns Promise<string> Trimmed response content
   */
  async generate(options: GenerateOptions): Promise<string> {
    try {
      const {
        model,
        prompt,
        system,
        temperature = 0.2,
        maxTokens = 220,
        signal
      } = options;

      // Check for abort signal before starting
      if (signal?.aborted) {
        throw new Error('Request was aborted');
      }

      // Prepare messages array
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      
      if (system) {
        messages.push({ role: 'system', content: system });
      }
      messages.push({ role: 'user', content: prompt });

      // Make the API call
      const response = await fetch(
        `${this.baseUrl}/api/chat?ngrok-skip-browser-warning=1`,
        {
          ...this.getFetchOptions('POST', {
            model,
            messages,
            stream: false,
            options: {
              temperature,
              num_predict: maxTokens,
            },
          }),
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      // Check for abort signal after response
      if (signal?.aborted) {
        throw new Error('Request was aborted');
      }

      const data = await response.json();

      // Extract and return the content
      const content = data.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Invalid response format from Ollama');
      }

      return content.trim();

    } catch (error) {
      // Handle abort errors specifically
      if (error instanceof Error && error.message.includes('aborted')) {
        throw error;
      }

      // Handle errors with meaningful messages
      if (error instanceof Error) {
        if (error.message.includes('connect') || error.message.includes('fetch')) {
          throw new Error('Unable to connect to Ollama service. Please ensure Ollama is running.');
        }
        if (error.message.includes('model')) {
          throw new Error(`Model "${options.model}" not found. Please ensure the model is installed.`);
        }
        throw new Error(`LLM generation failed: ${error.message}`);
      }
      throw new Error('Unknown error occurred during LLM generation');
    }
  }

  /**
   * Generate response using Ollama chat API with streaming
   * @param options Streaming options with onToken callback
   * @returns Promise<string> Full concatenated response
   */
  async stream(options: StreamOptions): Promise<string> {
    try {
      const {
        model,
        prompt,
        system,
        temperature = 0.2,
        maxTokens = 220,
        onToken,
        signal
      } = options;

      // Check for abort signal before starting
      if (signal?.aborted) {
        throw new Error('Request was aborted');
      }

      // Prepare messages array
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      
      if (system) {
        messages.push({ role: 'system', content: system });
      }
      messages.push({ role: 'user', content: prompt });

      let fullResponse = '';

      // Make the streaming API call
      const response = await fetch(
        `${this.baseUrl}/api/chat?ngrok-skip-browser-warning=1`,
        {
          ...this.getFetchOptions('POST', {
            model,
            messages,
            stream: true,
            options: {
              temperature,
              num_predict: maxTokens,
            },
          }),
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Process the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        // Check for abort signal during streaming
        if (signal?.aborted) {
          reader.cancel();
          throw new Error('Request was aborted');
        }

        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const content = data.message?.content || '';
            
            if (content) {
              fullResponse += content;
              onToken(content);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      return fullResponse.trim();

    } catch (error) {
      // Handle abort errors specifically
      if (error instanceof Error && error.message.includes('aborted')) {
        throw error;
      }

      // Handle errors with meaningful messages
      if (error instanceof Error) {
        if (error.message.includes('connect') || error.message.includes('fetch')) {
          throw new Error('Unable to connect to Ollama service. Please ensure Ollama is running.');
        }
        if (error.message.includes('model')) {
          throw new Error(`Model "${options.model}" not found. Please ensure the model is installed.`);
        }
        throw new Error(`LLM streaming failed: ${error.message}`);
      }
      throw new Error('Unknown error occurred during LLM streaming');
    }
  }

  /**
   * Check if Ollama service is available and model exists
   * @param model Model name to check
   * @returns Promise<boolean>
   */
  async isModelAvailable(model: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/tags?ngrok-skip-browser-warning=1`,
        this.getFetchOptions('GET')
      );
      
      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.models?.some((m: any) => m.name === model) || false;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   * @returns Promise<string[]> Array of available model names
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/tags?ngrok-skip-browser-warning=1`,
        this.getFetchOptions('GET')
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list models: ${error.message}`);
      }
      throw new Error('Failed to list models');
    }
  }
}

// Export singleton instance
export const localLLM = new LocalLLM();

/**
 * Standalone streaming function for Ollama
 * @param options Streaming options
 * @returns Promise<string> Full concatenated response
 */
export async function stream(options: {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  onToken: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  return localLLM.stream(options);
}

// Export types for convenience
export type { GenerateOptions, StreamOptions };
