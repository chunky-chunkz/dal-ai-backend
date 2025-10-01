/**
 * Task: Wire RAG into service.
 * Requirements:
 * - Export async function answerQuestion(q: string):
 *    - Call ragLocalAnswer(q).
 *    - If !answer or confidence < 0.55 -> return fallback:
 *      { answer: "Ich bin unsicher – soll ich ein Ticket erstellen?", confidence: conf||0.3 }.
 *    - Else return { answer, confidence, sourceId: first source id }.
 * - Export async function answerQuestionStream(q: string, onToken: (s:string)=>void):
 *    - Use ragLocalAnswerStream + onToken for SSE/websocket in controller.
 * - Never expose stack traces; catch and return safe error responses upstream.
 * 
 * Enhancement: Use cache before calling rag.
 * - const key = normalize(q); if (cache.get(key)) return cached.
 * - After computing, cache.put(key, result, 60*60*1000).
 */

import { FaqRepository } from '../repos/faq.repository.js';
import { ragLocalAnswerStream } from '../ai/rag.local.js';
import * as answerCache from '../utils/answerCache.js';
import { applyGuardrails, getSensitiveTopicResponse } from '../ai/guardrails.js';
import { setProfile, findFact } from '../memory/profileStore.js';
import { localLLM } from '../ai/localLLM.js';
import { getContext } from '../memory/sessionMemory.js';
import { evaluateAndMaybeStore, type EvaluationResult } from '../memory/manager.js';
import { listByUser } from '../memory/store.js';

/**
 * Standard response interface for answer queries
 */
export interface AnswerResponse {
  answer: string;
  confidence: number;
  sourceId?: string;
  timestamp: string;
}

// Global FAQ repository instance (kept for fallback)
const faqRepository = new FaqRepository();

/**
 * Generate direct chat response using local LLM without RAG/FAQ
 */
async function generateDirectChatResponse(question: string, sessionId?: string, memoryContext?: string): Promise<AnswerResponse> {
  try {
    // Build conversational prompt
    let prompt = '';
    
    // Add user memory context if available
    if (memoryContext && memoryContext.trim()) {
      prompt += `${memoryContext}\n`;
    }
    
    // Add conversation history if sessionId provided
    if (sessionId) {
      const conversationHistory = getContext(sessionId, 6); // Last 6 turns
      if (conversationHistory.length > 0) {
        prompt += `Verlauf:\n`;
        for (const turn of conversationHistory) {
          const roleText = turn.role === "user" ? "Benutzer" : "Assistent";
          prompt += `${roleText}: ${turn.text}\n`;
        }
        prompt += `\n`;
      }
    }
    
    prompt += `Frage: ${question}`;

    // System prompt for normal conversation
    const systemPrompt = `Du bist ein hilfsbreiter, freundlicher deutschsprachiger AI-Assistent. Antworte natürlich und persönlich auf Fragen. Nutze die bereitgestellten Informationen über den Benutzer, um deine Antworten zu personalisieren. Antworte in 1-3 Sätzen, sei präzise und freundlich.`;

    // Try different models until one works
    const modelsToTry = ['llama3.2', 'llama3.1', 'llama3', 'phi3', 'phi3:mini', 'qwen2', 'mistral'];
    
    for (const model of modelsToTry) {
      try {
        // Call local LLM
        const response = await localLLM.generate({
          model,
          prompt,
          system: systemPrompt,
          temperature: 0.7,
          maxTokens: 300
        });

        return {
          answer: response || 'Entschuldigung, ich konnte keine Antwort generieren.',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
        };
      } catch (modelError) {
        console.log(`Model ${model} failed, trying next...`);
        continue; // Try next model
      }
    }

    // If all models fail, return a simple response based on the question
    return generateSimpleResponse(question, memoryContext);

  } catch (error) {
    console.error('Error in generateDirectChatResponse:', error);
    return generateSimpleResponse(question, memoryContext);
  }
}

/**
 * Generate a simple response without LLM as fallback
 */
function generateSimpleResponse(question: string, memoryContext?: string): AnswerResponse {
  const lowerQuestion = question.toLowerCase();
  
  let response = 'Hallo! Wie kann ich Ihnen helfen?';
  
  // Simple pattern matching for common questions
  if (lowerQuestion.includes('hallo') || lowerQuestion.includes('hi')) {
    response = 'Hallo! Schön, Sie zu sprechen. Wie kann ich Ihnen heute helfen?';
  } else if (lowerQuestion.includes('wie geht') || lowerQuestion.includes('wie gehts')) {
    response = 'Mir geht es gut, danke der Nachfrage! Wie geht es Ihnen denn?';
  } else if (lowerQuestion.includes('lieblings') && lowerQuestion.includes('farbe')) {
    // Check if we have stored their favorite color
    if (memoryContext && memoryContext.includes('lieblings_farbe:')) {
      const colorMatch = memoryContext.match(/lieblings_farbe:\s*([^\n]+)/);
      if (colorMatch) {
        response = `Ihre Lieblingsfarbe ist ${colorMatch[1]}.`;
      }
    } else {
      response = 'Ich weiß nicht, was Ihre Lieblingsfarbe ist. Können Sie es mir sagen?';
    }
  } else if (lowerQuestion.includes('was ist meine lieblingsfarbe')) {
    // Direct question about favorite color
    if (memoryContext && memoryContext.includes('lieblings_farbe:')) {
      const colorMatch = memoryContext.match(/lieblings_farbe:\s*([^\n]+)/);
      if (colorMatch) {
        response = `Ihre Lieblingsfarbe ist ${colorMatch[1]}.`;
      } else {
        response = 'Ich kann mich nicht an Ihre Lieblingsfarbe erinnern. Können Sie es mir nochmal sagen?';
      }
    } else {
      response = 'Ich weiß nicht, was Ihre Lieblingsfarbe ist. Haben Sie es mir schon einmal gesagt?';
    }
  } else if (lowerQuestion.includes('name')) {
    response = 'Ich bin Ihr AI-Assistent. Wie ist denn Ihr Name?';
  } else if (lowerQuestion.includes('danke')) {
    response = 'Gern geschehen! Ist da noch etwas, womit ich helfen kann?';
  } else {
    response = 'Das ist interessant! Können Sie mir mehr dazu erzählen?';
  }
  
  return {
    answer: response,
    confidence: 0.8,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format memory suggestions for inclusion in the response
 */
function formatMemorySuggestions(suggestions: Array<{ key: string; value: string; type: string }>): string {
  if (suggestions.length === 0) return '';
  
  // Take only the most relevant suggestions (max 2 to keep response concise)
  const topSuggestions = suggestions.slice(0, 2);
  
  const formatted = topSuggestions.map(s => {
    // Make the suggestion more user-friendly
    if (s.type === 'preference') {
      return `dass Sie ${s.value}`;
    } else if (s.type === 'profile_fact') {
      return `dass ${s.key}: ${s.value}`;
    } else {
      return `${s.key}: ${s.value}`;
    }
  }).join(', ');
  
  return `\n\n(Ich kann mir merken: ${formatted}. Möchten Sie das speichern? ✅/❌)`;
}

/**
 * Get stored memories for a user to include in context
 */
async function getMemoryContext(userId: string): Promise<string> {
  try {
    const memories = await listByUser(userId);
    if (memories.length === 0) return '';
    
    // Format memories as context
    const memoryLines = memories
      .filter(m => m.type === 'preference' || m.type === 'profile_fact')
      .slice(-5) // Last 5 memories to avoid too much context
      .map(m => `${m.key}: ${m.value}`)
      .join('\n');
    
    return memoryLines ? `Benutzer-Kontext:\n${memoryLines}\n` : '';
  } catch (error) {
    console.warn('Failed to load memory context:', error);
    return '';
  }
}

/**
 * Main function to get answers for questions using RAG
 * @param question The user's question
 * @param sessionId Session identifier for conversation memory
 * @param memoryContext User-specific memory context to personalize responses
 * @returns Promise with answer, confidence, and optional sourceId
 */
export async function answerQuestion(question: string, sessionId?: string, memoryContext?: string, userId?: string): Promise<AnswerResponse> {
  try {
    // Validate input
    if (!question || question.trim().length < 3) {
      return getUncertainAnswer();
    }

    const normalizedQuestion = question.trim();

    // Apply guardrails - check for sensitive content and PII
    const guardrailResult = applyGuardrails(normalizedQuestion);
    
    // If sensitive content detected, return escalation response immediately
    if (guardrailResult.shouldEscalate) {
      const sensitiveResponse = getSensitiveTopicResponse(guardrailResult.sensitiveKeywords);
      
      // Log the detection (using masked question for privacy)
      console.log('🛡️ Sensitive content detected:', {
        masked: guardrailResult.maskedQuestion,
        keywords: guardrailResult.sensitiveKeywords,
        hasPII: guardrailResult.containsPII
      });

      return {
        answer: sensitiveResponse.answer,
        confidence: sensitiveResponse.confidence,
        timestamp: new Date().toISOString(),
        // No sourceId for escalated responses
      };
    }

    // Use masked question for cache key and RAG processing
    const processedQuestion = guardrailResult.maskedQuestion;

    // Check for profile queries first (before cache and RAG)
    const profileResult = await checkProfileQuery(processedQuestion);
    if (profileResult) {
      return profileResult;
    }

    // Memory evaluation hook - evaluate user utterance for memory candidates
    let memoryEvaluation: EvaluationResult | null = null;
    if (userId) {
      try {
        memoryEvaluation = await evaluateAndMaybeStore(userId, normalizedQuestion);
        console.log('💭 Memory evaluation:', {
          suggestions: memoryEvaluation.suggestions.length,
          saved: memoryEvaluation.saved.length,
          rejected: memoryEvaluation.rejected.length
        });
      } catch (error) {
        console.warn('Memory evaluation failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Enhanced memory context - combine passed context with stored memories
    let enhancedMemoryContext = memoryContext || '';
    if (userId && !enhancedMemoryContext) {
      enhancedMemoryContext = await getMemoryContext(userId);
    }

    // Check cache first (using masked question)
    const cachedAnswer = answerCache.get(processedQuestion);
    if (cachedAnswer) {
      // Add memory suggestions to cached answer if any
      let finalAnswer = cachedAnswer.answer;
      if (memoryEvaluation?.suggestions && memoryEvaluation.suggestions.length > 0) {
        finalAnswer += formatMemorySuggestions(memoryEvaluation.suggestions.map(item => ({
          key: item.key,
          value: item.value,
          type: item.type
        })));
      }
      
      return {
        ...cachedAnswer,
        answer: finalAnswer,
        timestamp: new Date().toISOString(),
      };
    }

    // Use direct LLM response instead of RAG for normal chat (with enhanced memory context)
    const result = await generateDirectChatResponse(processedQuestion, sessionId, enhancedMemoryContext);

    // Add memory suggestions to the response if any
    if (memoryEvaluation?.suggestions && memoryEvaluation.suggestions.length > 0) {
      result.answer += formatMemorySuggestions(memoryEvaluation.suggestions.map(item => ({
        key: item.key,
        value: item.value,
        type: item.type
      })));
    }

    // Check if user is providing profile information and extract it (legacy method)
    await extractAndStoreProfileInfo(normalizedQuestion, result.answer);

    // Cache the result for future requests (1 hour TTL) - cache without memory suggestions
    answerCache.put(processedQuestion, {
      answer: result.answer.split('\n\n(Ich kann mir merken:')[0], // Cache base answer without suggestions
      confidence: result.confidence,
      sourceId: result.sourceId
    }, 60 * 60 * 1000); // 1 hour in milliseconds

    return result;

  } catch (error) {
    console.error('Error in answerQuestion (RAG):', error instanceof Error ? error.message : 'Unknown error');
    return getErrorAnswer();
  }
}

/**
 * Streaming answer function using RAG - Updated for new ragLocalAnswerStream interface
 * @param question The user's question
 * @param onToken Callback function for each token/chunk
 * @param signal Optional AbortSignal for cancellation
 * @param userId Optional user identifier for memory integration
 * @returns Promise with final answer response
 */
export async function answerQuestionStream(
  question: string, 
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
  userId?: string
): Promise<AnswerResponse> {
  try {
    // Validate input
    if (!question || question.trim().length < 3) {
      const fallback = getUncertainAnswer();
      
      // Stream the fallback answer character by character for consistency
      for (const char of fallback.answer) {
        if (signal?.aborted) {
          throw new Error('Request was aborted');
        }
        onToken(char);
        await new Promise(resolve => setTimeout(resolve, 20)); // Small delay for realism
      }
      
      return fallback;
    }

    const normalizedQuestion = question.trim();

    // Apply guardrails - check for sensitive content and PII
    const guardrailResult = applyGuardrails(normalizedQuestion);
    
    // If sensitive content detected, stream escalation response
    if (guardrailResult.shouldEscalate) {
      const sensitiveResponse = getSensitiveTopicResponse(guardrailResult.sensitiveKeywords);
      
      // Log the detection (using masked question for privacy)
      console.log('🛡️ Sensitive content detected in stream:', {
        masked: guardrailResult.maskedQuestion,
        keywords: guardrailResult.sensitiveKeywords,
        hasPII: guardrailResult.containsPII
      });

      // Stream the escalation message
      for (const char of sensitiveResponse.answer) {
        if (signal?.aborted) {
          throw new Error('Request was aborted');
        }
        onToken(char);
        await new Promise(resolve => setTimeout(resolve, 25)); // Slightly slower for important messages
      }

      return {
        answer: sensitiveResponse.answer,
        confidence: sensitiveResponse.confidence,
        timestamp: new Date().toISOString(),
        // No sourceId for escalated responses
      };
    }

    // Use masked question for processing
    const processedQuestion = guardrailResult.maskedQuestion;

    // Check for profile queries first (before cache and RAG)
    const profileResult = await checkProfileQuery(processedQuestion);
    if (profileResult) {
      // Stream the profile answer for consistent behavior
      for (const char of profileResult.answer) {
        if (signal?.aborted) {
          throw new Error('Request was aborted');
        }
        onToken(char);
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      return profileResult;
    }

    // Check cache first
    const cachedAnswer = answerCache.get(processedQuestion);
    if (cachedAnswer) {
      // Stream the cached answer for consistent behavior
      for (const char of cachedAnswer.answer) {
        if (signal?.aborted) {
          throw new Error('Request was aborted');
        }
        onToken(char);
        await new Promise(resolve => setTimeout(resolve, 15)); // Slightly faster for cached responses
      }
      
      return {
        ...cachedAnswer,
        timestamp: new Date().toISOString(),
      };
    }

    // Use RAG streaming with new interface (with masked question and abort signal)
    const stream = ragLocalAnswerStream(processedQuestion, signal, 3);
    
    // Set up token passthrough
    stream.onToken(onToken);
    
    // Wait for completion
    const ragResponse = await stream.done();

    // Check if user is providing profile information and extract it
    await extractAndStoreProfileInfo(normalizedQuestion, ragResponse.answer);

    let result: AnswerResponse;

    // Check if answer is good enough
    if (ragResponse.answer && ragResponse.confidence >= 0.55) {
      result = {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sourceId: ragResponse.sourceIds.length > 0 ? ragResponse.sourceIds[0] : undefined,
        timestamp: new Date().toISOString(),
      };
    } else {
      // If RAG wasn't confident enough, we already streamed the content
      // Just return the response with appropriate metadata
      result = {
        answer: ragResponse.answer || "Ich bin unsicher – soll ich ein Ticket erstellen?",
        confidence: ragResponse.confidence || 0.3,
        timestamp: new Date().toISOString(),
        // No sourceId for uncertain answers
      };
    }

    // Cache the result for future requests (using masked question, 1 hour TTL)
    answerCache.put(processedQuestion, {
      answer: result.answer,
      confidence: result.confidence,
      sourceId: result.sourceId
    }, 60 * 60 * 1000); // 1 hour in milliseconds

    return result;

  } catch (error) {
    // Handle abort errors specifically
    if (error instanceof Error && error.message.includes('aborted')) {
      throw error; // Re-throw abort errors to be handled by caller
    }
    
    console.error('Error in answerQuestionStream (RAG):', error instanceof Error ? error.message : 'Unknown error');
    
    // Stream error message
    const errorResponse = getErrorAnswer();
    for (const char of errorResponse.answer) {
      if (signal?.aborted) {
        throw new Error('Request was aborted');
      }
      onToken(char);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    return errorResponse;
  }
}

/**
 * Legacy function for backwards compatibility - uses old keyword search
 * @deprecated Use answerQuestion instead which uses RAG
 */
export async function answerQuestionLegacy(question: string): Promise<AnswerResponse> {
  try {
    // Validate input
    if (!question || question.trim().length < 3) {
      return getUncertainAnswer();
    }

    // Search using repository's findByQuery method
    const searchResults = await faqRepository.findByQuery(question.trim());

    // If we have matches, return the best one
    if (searchResults.length > 0) {
      const bestMatch = searchResults[0]; // First result is highest confidence
      return {
        answer: bestMatch.faq.answer,
        confidence: Math.min(bestMatch.confidence, 0.95), // Cap confidence at 95%
        sourceId: bestMatch.faq.id,
        timestamp: new Date().toISOString(),
      };
    }

    // No matches found - return uncertain answer
    return getUncertainAnswer();

  } catch (error) {
    console.error('Error in answerQuestionLegacy:', error instanceof Error ? error.message : 'Unknown error');
    return getErrorAnswer();
  }
}

/**
 * Return answer when we're uncertain about the query
 */
function getUncertainAnswer(): AnswerResponse {
  return {
    answer: "Ich bin unsicher – können Sie Ihre Frage anders formulieren oder soll ich ein Ticket erstellen?",
    confidence: 0.3,
    timestamp: new Date().toISOString(),
    // No sourceId for uncertain answers
  };
}

/**
 * Return answer when there's a system error
 */
function getErrorAnswer(): AnswerResponse {
  return {
    answer: "Es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
    confidence: 0.1,
    timestamp: new Date().toISOString(),
    // No sourceId for error answers
  };
}

/**
 * Check if the question is asking for profile information
 * Patterns: "Lieblingsfarbe von X", "Hobby von X", "X's Lieblingsfarbe", etc.
 */
async function checkProfileQuery(question: string): Promise<AnswerResponse | null> {
  const lowerQuestion = question.toLowerCase().trim();
  
  // Pattern matching for profile queries
  const patterns = [
    // "X von Y" pattern (e.g., "Lieblingsfarbe von Roman")
    /(.+?)\s+von\s+(\w+)/i,
    // "Y's X" pattern (e.g., "Romans Lieblingsfarbe") 
    /(\w+)s?\s+(.+)/i,
    // "was ist X von Y" pattern
    /was\s+ist\s+(.+?)\s+von\s+(\w+)/i,
    // "wie ist X von Y" pattern
    /wie\s+ist\s+(.+?)\s+von\s+(\w+)/i
  ];

  for (const pattern of patterns) {
    const match = lowerQuestion.match(pattern);
    if (match) {
      let personName: string;
      let attribute: string;
      
      if (pattern.source.includes('von')) {
        // "X von Y" or "was ist X von Y" pattern
        attribute = match[1].trim();
        personName = match[2].trim();
      } else {
        // "Y's X" pattern
        personName = match[1].trim();
        attribute = match[2].trim();
      }

      // Look up the attribute in the profile store
      const fact = await findFact(personName, attribute);
      if (fact) {
        return {
          answer: `${personName}s ${attribute} ist ${fact}.`,
          confidence: 0.95,
          timestamp: new Date().toISOString(),
          sourceId: `profile:${personName}:${attribute}`
        };
      }
    }
  }

  return null; // No profile query detected
}

/**
 * Extract and store profile information from user input
 * Patterns: "Romans Lieblingsfarbe ist blau", "Maria mag Pizza", etc.
 */
async function extractAndStoreProfileInfo(question: string, _ragAnswer: string): Promise<void> {
  const lowerQuestion = question.toLowerCase().trim();
  
  // Patterns for profile information statements
  const patterns = [
    // "X's Y ist Z" pattern (e.g., "Romans Lieblingsfarbe ist blau")
    /(\w+)s?\s+(.+?)\s+ist\s+(.+)/i,
    // "X mag Y" pattern (e.g., "Maria mag Pizza")
    /(\w+)\s+mag\s+(.+)/i,
    // "X liebt Y" pattern (e.g., "Peter liebt Kaffee")
    /(\w+)\s+liebt\s+(.+)/i,
    // "X hasst Y" pattern (e.g., "Anna hasst Spinat")
    /(\w+)\s+hasst\s+(.+)/i,
    // "X hat Y" pattern (e.g., "Tom hat einen Hund")
    /(\w+)\s+hat\s+(.+)/i,
    // "X wohnt in Y" pattern (e.g., "Lisa wohnt in Berlin")
    /(\w+)\s+wohnt\s+in\s+(.+)/i,
    // "X arbeitet als Y" pattern (e.g., "Max arbeitet als Ingenieur")
    /(\w+)\s+arbeitet\s+als\s+(.+)/i,
    // "X ist Y Jahre alt" pattern (e.g., "Sarah ist 25 Jahre alt")
    /(\w+)\s+ist\s+(.+?)\s+jahre?\s+alt/i
  ];

  for (const pattern of patterns) {
    const match = lowerQuestion.match(pattern);
    if (match) {
      const personName = match[1].trim();
      let attribute: string;
      let value: string;
      
      // Handle different pattern types
      if (pattern.source.includes('ist.*jahre.*alt')) {
        // Age pattern
        attribute = 'alter';
        value = match[2].trim();
      } else if (pattern.source.includes('mag|liebt|hasst')) {
        // Preference patterns
        const verb = lowerQuestion.includes('mag') ? 'mag' : 
                     lowerQuestion.includes('liebt') ? 'liebt' : 'hasst';
        attribute = verb;
        value = match[2].trim();
      } else if (pattern.source.includes('wohnt in')) {
        // Location pattern
        attribute = 'wohnort';
        value = match[2].trim();
      } else if (pattern.source.includes('arbeitet als')) {
        // Profession pattern
        attribute = 'beruf';
        value = match[2].trim();
      } else if (pattern.source.includes('hat')) {
        // Possession pattern
        attribute = 'hat';
        value = match[2].trim();
      } else {
        // "X's Y ist Z" pattern
        attribute = match[2].trim();
        value = match[3].trim();
      }

      try {
        await setProfile(personName, attribute, value);
        console.log(`📝 Stored profile info: ${personName} -> ${attribute}: ${value}`);
      } catch (error) {
        console.error(`Error storing profile info for ${personName}:`, error);
      }
      
      break; // Only process first match
    }
  }
}
