/**
 * Task: Smart fallback.
 * - if local confidence < 0.4 -> call cloudLLM.generate(...) with same RAG context
 * - return cloud answer + tag {source:"cloud"}; else {source:"local"}
 * - flag events for analytics
 */

import { localLLM } from './localLLM.js';

// Cloud LLM configuration
interface CloudLLMConfig {
  provider: 'openai' | 'anthropic' | 'azure';
  model: string;
  apiKey: string;
  endpoint?: string;
}

// Enhanced answer response with source tracking
export interface SmartAnswerResponse {
  answer: string;
  confidence: number;
  source: 'local' | 'cloud';
  modelUsed: string;
  processingTime: number;
  sourceIds: string[];
}

// Analytics event for tracking fallback usage
interface FallbackEvent {
  timestamp: string;
  questionLength: number;
  localConfidence: number;
  usedFallback: boolean;
  localModel: string;
  cloudModel?: string;
  processingTimeLocal: number;
  processingTimeCloud?: number;
}

// In-memory analytics storage (in production, send to analytics service)
const fallbackEvents: FallbackEvent[] = [];

/**
 * Get cloud LLM configuration from environment variables
 */
function getCloudLLMConfig(): CloudLLMConfig | null {
  const provider = process.env.CLOUD_LLM_PROVIDER as 'openai' | 'anthropic' | 'azure' || 'openai';
  const apiKey = process.env.CLOUD_LLM_API_KEY;
  
  if (!apiKey) {
    return null;
  }

  const config: CloudLLMConfig = {
    provider,
    apiKey,
    model: process.env.CLOUD_LLM_MODEL || getDefaultModelForProvider(provider)
  };

  if (provider === 'azure') {
    config.endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  }

  return config;
}

/**
 * Get default model for cloud provider
 */
function getDefaultModelForProvider(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini'; // Cost-effective but capable
    case 'anthropic':
      return 'claude-3-haiku-20240307'; // Fast and economical
    case 'azure':
      return 'gpt-4o-mini'; // Azure OpenAI
    default:
      return 'gpt-4o-mini';
  }
}

/**
 * Call cloud LLM with the same context as local LLM
 */
async function callCloudLLM(
  system: string, 
  prompt: string, 
  config: CloudLLMConfig
): Promise<{ answer: string; processingTime: number }> {
  try {
    switch (config.provider) {
      case 'openai':
        return await callOpenAI(system, prompt, config);
      case 'anthropic':
        return await callAnthropic(system, prompt, config);
      case 'azure':
        return await callAzureOpenAI(system, prompt, config);
      default:
        throw new Error(`Unsupported cloud provider: ${config.provider}`);
    }
  } catch (error) {
    console.error('Cloud LLM call failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error(`Cloud LLM fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  system: string, 
  prompt: string, 
  config: CloudLLMConfig
): Promise<{ answer: string; processingTime: number }> {
  const startTime = Date.now();
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Parse error' } })) as any;
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json() as any;
  const answer = data.choices?.[0]?.message?.content?.trim() || '';
  const processingTime = Date.now() - startTime;

  return { answer, processingTime };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  system: string, 
  prompt: string, 
  config: CloudLLMConfig
): Promise<{ answer: string; processingTime: number }> {
  const startTime = Date.now();
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      system: system,
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Parse error' } })) as any;
    throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json() as any;
  const answer = data.content?.[0]?.text?.trim() || '';
  const processingTime = Date.now() - startTime;

  return { answer, processingTime };
}

/**
 * Call Azure OpenAI API
 */
async function callAzureOpenAI(
  system: string, 
  prompt: string, 
  config: CloudLLMConfig
): Promise<{ answer: string; processingTime: number }> {
  const startTime = Date.now();
  
  if (!config.endpoint) {
    throw new Error('Azure OpenAI endpoint not configured');
  }

  const url = `${config.endpoint}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-15-preview`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': config.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Parse error' } })) as any;
    throw new Error(`Azure OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json() as any;
  const answer = data.choices?.[0]?.message?.content?.trim() || '';
  const processingTime = Date.now() - startTime;

  return { answer, processingTime };
}

/**
 * Smart fallback function - tries local first, falls back to cloud if confidence is low
 * @param system System prompt
 * @param prompt User prompt  
 * @param localModel Local model to use
 * @param questionLength Length of original question for analytics
 * @param sourceIds Source IDs from RAG for result
 * @returns SmartAnswerResponse with source tracking
 */
export async function smartFallback(
  system: string,
  prompt: string,
  localModel: string,
  questionLength: number,
  sourceIds: string[] = []
): Promise<SmartAnswerResponse> {
  const startTime = Date.now();
  
  try {
    // Step 1: Try local LLM first
    console.log(`🤖 Trying local model: ${localModel}`);
    
    const localStartTime = Date.now();
    const localResult = await localLLM.generate({
      model: localModel,
      prompt,
      system,
      temperature: 0.2,
      maxTokens: 220
    });
    const localProcessingTime = Date.now() - localStartTime;

    // Step 2: Calculate confidence based on answer quality heuristics
    const localConfidence = calculateAnswerConfidence(localResult, prompt);
    
    console.log(`📊 Local confidence: ${localConfidence.toFixed(3)}`);

    // Step 3: Check if we need cloud fallback
    const needsFallback = localConfidence < 0.4;
    
    if (!needsFallback) {
      // Local answer is good enough
      const event: FallbackEvent = {
        timestamp: new Date().toISOString(),
        questionLength,
        localConfidence,
        usedFallback: false,
        localModel,
        processingTimeLocal: localProcessingTime
      };
      fallbackEvents.push(event);
      
      console.log(`✅ Using local answer (confidence: ${localConfidence.toFixed(3)})`);
      
      return {
        answer: localResult.trim(),
        confidence: localConfidence,
        source: 'local',
        modelUsed: localModel,
        processingTime: localProcessingTime,
        sourceIds
      };
    }

    // Step 4: Try cloud fallback
    const cloudConfig = getCloudLLMConfig();
    
    if (!cloudConfig) {
      console.warn('⚠️ Cloud fallback needed but not configured - using local answer');
      
      const event: FallbackEvent = {
        timestamp: new Date().toISOString(),
        questionLength,
        localConfidence,
        usedFallback: false,
        localModel,
        processingTimeLocal: localProcessingTime
      };
      fallbackEvents.push(event);
      
      return {
        answer: localResult.trim(),
        confidence: localConfidence,
        source: 'local',
        modelUsed: localModel,
        processingTime: localProcessingTime,
        sourceIds
      };
    }

    console.log(`☁️ Using cloud fallback: ${cloudConfig.provider}/${cloudConfig.model}`);
    
    const cloudResult = await callCloudLLM(system, prompt, cloudConfig);
    const totalProcessingTime = Date.now() - startTime;

    // Calculate confidence for cloud answer (typically higher)
    const cloudConfidence = Math.max(0.7, calculateAnswerConfidence(cloudResult.answer, prompt));

    const event: FallbackEvent = {
      timestamp: new Date().toISOString(),
      questionLength,
      localConfidence,
      usedFallback: true,
      localModel,
      cloudModel: `${cloudConfig.provider}/${cloudConfig.model}`,
      processingTimeLocal: localProcessingTime,
      processingTimeCloud: cloudResult.processingTime
    };
    fallbackEvents.push(event);

    console.log(`✅ Using cloud answer (confidence: ${cloudConfidence.toFixed(3)})`);

    return {
      answer: cloudResult.answer.trim(),
      confidence: cloudConfidence,
      source: 'cloud',
      modelUsed: `${cloudConfig.provider}/${cloudConfig.model}`,
      processingTime: totalProcessingTime,
      sourceIds
    };

  } catch (error) {
    console.error('Smart fallback error:', error instanceof Error ? error.message : 'Unknown error');
    
    // Return basic local result as ultimate fallback
    const fallbackResult = await localLLM.generate({
      model: localModel,
      prompt,
      system,
      temperature: 0.2,
      maxTokens: 220
    });

    return {
      answer: fallbackResult.trim(),
      confidence: 0.3,
      source: 'local',
      modelUsed: localModel,
      processingTime: Date.now() - startTime,
      sourceIds
    };
  }
}

/**
 * Calculate answer confidence based on heuristics
 * This is a simplified version - in production you might use more sophisticated methods
 */
function calculateAnswerConfidence(answer: string, _prompt: string): number {
  if (!answer || answer.length < 10) {
    return 0.1;
  }

  let confidence = 0.5; // Base confidence

  // Positive indicators
  if (answer.includes('Sunrise') || answer.includes('Telekom')) {
    confidence += 0.1;
  }
  
  if (answer.length > 50 && answer.length < 300) {
    confidence += 0.1; // Good length
  }
  
  if (answer.includes('€') || answer.includes('CHF') || answer.includes('Franken')) {
    confidence += 0.1; // Contains pricing info
  }

  // Negative indicators
  if (answer.includes('Ich weiß nicht') || answer.includes('kann ich nicht')) {
    confidence -= 0.2;
  }
  
  if (answer.includes('Entschuldigung') || answer.includes('tut mir leid')) {
    confidence -= 0.1;
  }
  
  if (answer.length < 20) {
    confidence -= 0.2; // Too short
  }
  
  if (answer.length > 500) {
    confidence -= 0.1; // Too verbose
  }

  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Get fallback usage statistics
 */
export function getFallbackStats(): {
  totalQueries: number;
  localQueries: number;
  cloudQueries: number;
  fallbackRate: number;
  averageLocalConfidence: number;
  averageProcessingTime: { local: number; cloud: number };
} {
  const total = fallbackEvents.length;
  const cloudQueries = fallbackEvents.filter(e => e.usedFallback).length;
  const localQueries = total - cloudQueries;
  
  const avgLocalConfidence = fallbackEvents.reduce((sum, e) => sum + e.localConfidence, 0) / total || 0;
  
  const localTimes = fallbackEvents.map(e => e.processingTimeLocal);
  const cloudTimes = fallbackEvents.filter(e => e.processingTimeCloud).map(e => e.processingTimeCloud!);
  
  const avgLocalTime = localTimes.reduce((sum, t) => sum + t, 0) / localTimes.length || 0;
  const avgCloudTime = cloudTimes.reduce((sum, t) => sum + t, 0) / cloudTimes.length || 0;

  return {
    totalQueries: total,
    localQueries,
    cloudQueries,
    fallbackRate: total > 0 ? cloudQueries / total : 0,
    averageLocalConfidence: avgLocalConfidence,
    averageProcessingTime: {
      local: avgLocalTime,
      cloud: avgCloudTime
    }
  };
}

/**
 * Clear analytics data (for testing or privacy)
 */
export function clearFallbackStats(): void {
  fallbackEvents.length = 0;
  console.log('📊 Fallback analytics cleared');
}
