/**
 * Enhanced Memory Manager with Advanced Features
 * 
 * Integrates enhanced categorization, consolidation, adaptive learning,
 * and intelligent memory management capabilities.
 */

import { detectPII } from './pii.js';
import { extractCandidates } from './extractor.js';
import { defaultTTL } from './policy.js';
import { listByUser, upsert, type MemoryItem } from './store.js';
import { MemoryCategorizerEnhanced, type EnhancedCandidate, type MemoryContext } from './enhanced-categorizer.js';
import { MemoryConsolidator, type ConsolidationResult } from './consolidator.js';
import { AdaptiveLearningSystem, type LearningData } from './adaptive-learning.js';
import { detectSentiment } from './text-utils.js';

export interface EnhancedEvaluationResult {
  saved: EnhancedCandidate[];
  suggestions: EnhancedCandidate[];
  conflicts: ConsolidationResult[];
  rejected: string[];
  consolidations: ConsolidationResult[];
  insights?: {
    totalMemories: number;
    memoryDistribution: Record<string, number>;
    recentTrends: string[];
    learningStats?: any;
  };
}

export interface ConversationContext {
  userId: string;
  conversationTopic?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  season?: string;
  userMood?: 'positive' | 'neutral' | 'negative';
  previousMessages?: string[];
  sessionId?: string;
}

export class EnhancedMemoryManager {
  private adaptiveLearning: AdaptiveLearningSystem;
  
  constructor() {
    this.adaptiveLearning = new AdaptiveLearningSystem();
  }

  /**
   * Enhanced memory evaluation with advanced features
   */
  async evaluateAndStore(
    context: ConversationContext,
    utterance: string,
    options?: {
      skipConsolidation?: boolean;
      skipLearning?: boolean;
      includeInsights?: boolean;
    }
  ): Promise<EnhancedEvaluationResult> {
    const result: EnhancedEvaluationResult = {
      saved: [],
      suggestions: [],
      conflicts: [],
      rejected: [],
      consolidations: []
    };

    try {
      // Step 1: Enhanced PII detection with context
      const piiDetection = detectPII(utterance);
      if (piiDetection.hasPII) {
        console.log(`🚫 Rejecting utterance due to PII:`, piiDetection.matches);
        result.rejected.push('pii_detected');
        return result;
      }

      // Step 2: Extract conversation context
      const memoryContext = this.buildMemoryContext(context, utterance);

      // Step 3: Extract basic candidates
      const basicCandidates = await extractCandidates(utterance, context.userId);
      
      if (basicCandidates.length === 0) {
        console.log('📝 No memory candidates found');
        return result;
      }

      // Step 4: Enhance candidates with advanced metadata
      const existingMemories = await this.getEnhancedMemories(context.userId);
      const enhancedCandidates = basicCandidates.map(candidate =>
        MemoryCategorizerEnhanced.enhanceCandidate(candidate, memoryContext, existingMemories)
      );

      console.log(`🔍 Found ${enhancedCandidates.length} enhanced candidates`);

      // Step 5: Process each candidate
      for (const candidate of enhancedCandidates) {
        await this.processEnhancedCandidate(candidate, context, result, options);
      }

      // Step 6: Consolidate memories if enabled
      if (!options?.skipConsolidation) {
        await this.performConsolidation(context.userId, result);
      }

      // Step 7: Generate insights if requested
      if (options?.includeInsights) {
        result.insights = await this.generateInsights(context.userId);
      }

      console.log(`📈 Enhanced evaluation complete: ${result.saved.length} saved, ${result.suggestions.length} suggested, ${result.conflicts.length} conflicts`);
      return result;

    } catch (error) {
      console.error('❌ Error in enhanced memory evaluation:', error);
      result.rejected.push('evaluation_error');
      return result;
    }
  }

  /**
   * Process a single enhanced candidate
   */
  private async processEnhancedCandidate(
    candidate: EnhancedCandidate,
    context: ConversationContext,
    result: EnhancedEvaluationResult,
    options?: any
  ): Promise<void> {
    // Apply adaptive learning adjustments
    const adaptiveScore = this.adaptiveLearning.getAdaptiveScore(candidate, context.userId);
    const adaptiveThreshold = this.adaptiveLearning.getAdaptiveThreshold(context.userId);
    
    // Update candidate with adaptive score
    const adaptedCandidate: EnhancedCandidate = {
      ...candidate,
      confidence: Math.min(1.0, candidate.confidence * adaptiveScore)
    };

    console.log(`📊 Processing: ${candidate.key}="${candidate.value}" | Score: ${adaptiveScore.toFixed(3)} | Priority: ${candidate.priority}`);

    // Check risk level
    if (candidate.volatility === 'dynamic' && this.isTooVolatile(candidate, context)) {
      result.rejected.push(`volatile:${candidate.key}`);
      return;
    }

    // Predict user action
    const prediction = this.adaptiveLearning.predictUserAction(adaptedCandidate, context.userId);
    
    // Decision logic with adaptive thresholds
    if (adaptedCandidate.confidence >= adaptiveThreshold && 
        adaptedCandidate.priority === 'high' &&
        prediction.predictedAction !== 'reject') {
      
      // Auto-save high-confidence, high-priority memories
      try {
        await this.saveEnhancedMemory(context.userId, adaptedCandidate);
        result.saved.push(adaptedCandidate);
        
        // Record successful save for learning
        if (!options?.skipLearning) {
          this.recordLearningFeedback(context.userId, 'accepted', adaptedCandidate, context);
        }
      } catch (error) {
        console.error(`❌ Failed to save memory:`, error);
        result.rejected.push(`save_error:${candidate.key}`);
      }
      
    } else if (adaptedCandidate.confidence >= 0.4 && 
               prediction.predictedAction !== 'reject') {
      
      // Suggest for user approval
      result.suggestions.push(adaptedCandidate);
      
    } else {
      // Reject low-scoring candidates
      result.rejected.push(`low_score:${candidate.key}`);
      
      // Record rejection for learning
      if (!options?.skipLearning && prediction.confidence > 0.6) {
        this.recordLearningFeedback(context.userId, 'rejected', adaptedCandidate, context);
      }
    }
  }

  /**
   * Build memory context from conversation context
   */
  private buildMemoryContext(context: ConversationContext, utterance: string): MemoryContext {
    const sentiment = detectSentiment(utterance);
    // temporal data is detected but not used in this context yet
    
    return {
      conversationTopic: context.conversationTopic,
      timeOfDay: context.timeOfDay || this.getCurrentTimeOfDay(),
      dayOfWeek: context.dayOfWeek || this.getCurrentDayOfWeek(),
      season: context.season || this.getCurrentSeason(),
      previousInteractions: context.previousMessages?.slice(-3), // Last 3 messages for context
      userMood: sentiment.sentiment !== 'neutral' ? sentiment.sentiment : context.userMood
    };
  }

  /**
   * Get enhanced memory representations
   */
  private async getEnhancedMemories(userId: string): Promise<EnhancedCandidate[]> {
    const basicMemories = await listByUser(userId);
    
    return basicMemories.map(memory => ({
      person: memory.person,
      type: memory.type as any,
      category: 'personal' as const, // Could be enhanced based on stored metadata
      key: memory.key,
      value: memory.value,
      confidence: memory.confidence,
      importance: 0.7, // Default importance, could be stored
      volatility: 'semi-stable' as const, // Default volatility
      priority: 'medium' as const, // Default priority
      tags: []
    }));
  }

  /**
   * Perform memory consolidation
   */
  private async performConsolidation(
    userId: string,
    result: EnhancedEvaluationResult
  ): Promise<void> {
    const existingMemories = await this.getEnhancedMemories(userId);
    
    for (const newMemory of [...result.saved, ...result.suggestions]) {
      const consolidationResult = MemoryConsolidator.consolidate(newMemory, existingMemories);
      
      if (consolidationResult.action === 'conflict') {
        result.conflicts.push(consolidationResult);
      } else if (consolidationResult.action === 'merge' || consolidationResult.action === 'update') {
        result.consolidations.push(consolidationResult);
      }
    }
  }

  /**
   * Save enhanced memory with metadata
   */
  private async saveEnhancedMemory(userId: string, candidate: EnhancedCandidate): Promise<MemoryItem> {
    const memoryItem = await upsert(userId, {
      userId,
      person: candidate.person,
      type: candidate.type,
      key: candidate.key,
      value: candidate.value,
      confidence: candidate.confidence,
      ttl: defaultTTL(candidate.type) ?? undefined
    });

    console.log(`✅ Saved enhanced memory: ${candidate.key}="${candidate.value}" [${candidate.category}/${candidate.priority}]`);
    return memoryItem;
  }

  /**
   * Record learning feedback
   */
  private recordLearningFeedback(
    userId: string,
    action: 'accepted' | 'rejected',
    candidate: EnhancedCandidate,
    context: ConversationContext
  ): void {
    const feedback: LearningData = {
      userId,
      action,
      originalCandidate: candidate,
      context: {
        conversationTopic: context.conversationTopic,
        timeOfDay: context.timeOfDay,
        userMood: context.userMood
      },
      timestamp: new Date()
    };

    this.adaptiveLearning.recordFeedback(feedback);
  }

  /**
   * Generate insights about user's memory patterns
   */
  private async generateInsights(userId: string): Promise<any> {
    const existingMemories = await listByUser(userId);
    const learningInsights = this.adaptiveLearning.getLearningInsights(userId);

    // Memory distribution by type
    const memoryDistribution = existingMemories.reduce((acc, memory) => {
      acc[memory.type] = (acc[memory.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent trends analysis
    const recentMemories = existingMemories.slice(-10);
    const recentTrends: string[] = [];

    if (recentMemories.length > 5) {
      const recentTypes = recentMemories.map(m => m.type);
      const mostCommonType = recentTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dominantType = Object.entries(mostCommonType)
        .sort(([,a], [,b]) => b - a)[0]?.[0];

      if (dominantType) {
        recentTrends.push(`Recent focus on ${dominantType} memories`);
      }
    }

    return {
      totalMemories: existingMemories.length,
      memoryDistribution,
      recentTrends,
      learningStats: learningInsights
    };
  }

  /**
   * Check if candidate is too volatile for current context
   */
  private isTooVolatile(candidate: EnhancedCandidate, context: ConversationContext): boolean {
    if (candidate.volatility !== 'dynamic') return false;

    // Simplified volatility check without temporal detection
    // (temporal detection function is not available)
    
    // Context-based volatility check
    if (context.userMood === 'negative' && candidate.category === 'personal') {
      // Avoid storing personal info when user seems upset
      return true;
    }

    return false;
  }

  /**
   * Manual feedback processing for learning
   */
  async processFeedback(
    _userId: string,
    candidateId: string,
    action: 'accepted' | 'rejected' | 'modified',
    _modifiedCandidate?: EnhancedCandidate
  ): Promise<void> {
    // Find the original candidate (would need to store pending suggestions)
    // For now, this is a placeholder for the feedback mechanism
    console.log(`📝 Processing feedback: ${action} for candidate ${candidateId}`);
  }

  /**
   * Cleanup and maintenance
   */
  async performMaintenance(userId: string): Promise<{
    cleanedMemories: number;
    consolidatedMemories: number;
  }> {
    const memories = await this.getEnhancedMemories(userId);
    
    // Cleanup low-quality memories
    const cleaned = MemoryConsolidator.cleanupMemories(memories);
    const cleanedCount = memories.length - cleaned.length;

    // Perform learning data cleanup
    this.adaptiveLearning.cleanupOldData(12); // 12 months

    console.log(`🧹 Maintenance complete: cleaned ${cleanedCount} memories`);
    
    return {
      cleanedMemories: cleanedCount,
      consolidatedMemories: 0 // Would track actual consolidations
    };
  }

  // Utility methods
  private getCurrentTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  private getCurrentDayOfWeek(): string {
    const days = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
    return days[new Date().getDay()];
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }
}
