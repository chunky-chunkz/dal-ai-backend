/**
 * Task: Model router based on difficulty/confidence.
 * - export chooseModel(confidenceHint?: number, questionLength?: number): string
 * - default: phi3:mini
 * - if questionLength > 160 or confidenceHint < 0.45 -> use "llama3.1:8b-instruct" (or qwen2.5:7b)
 * - allow override via env: LLM_MODEL_DEFAULT, LLM_MODEL_STRONG
 */

/**
 * Choose the appropriate model based on difficulty/confidence
 * @param confidenceHint - Confidence score from vector search (0-1)
 * @param questionLength - Length of the question
 * @returns Model name to use
 */
export function chooseModel(confidenceHint?: number, questionLength?: number): string {
  // Default models with environment overrides
  const DEFAULT_MODEL = process.env.LLM_MODEL_DEFAULT || "phi3:mini";
  const STRONG_MODEL = process.env.LLM_MODEL_STRONG || "llama3.1:8b-instruct";
  
  // Use strong model if:
  // - Low confidence (< 0.45) - ambiguous/difficult question
  // - Long question (> 160 chars) - requires more understanding
  const useStrongModel = (
    (confidenceHint !== undefined && confidenceHint < 0.45) ||
    (questionLength !== undefined && questionLength > 160)
  );
  
  const selectedModel = useStrongModel ? STRONG_MODEL : DEFAULT_MODEL;
  
  console.log(`🤖 Model selection:`, {
    confidenceHint,
    questionLength,
    selectedModel,
    reason: useStrongModel ? 'low confidence or long question' : 'standard'
  });
  
  return selectedModel;
}

/**
 * Get available models configuration
 */
export function getModelConfig() {
  return {
    default: process.env.LLM_MODEL_DEFAULT || "phi3:mini",
    strong: process.env.LLM_MODEL_STRONG || "llama3.1:8b-instruct",
  };
}

/**
 * Validate if a model name is configured
 */
export function isModelConfigured(modelName: string): boolean {
  const config = getModelConfig();
  return modelName === config.default || modelName === config.strong;
}
