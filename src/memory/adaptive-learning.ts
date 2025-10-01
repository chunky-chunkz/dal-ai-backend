/**
 * Adaptive Learning System for Memory Management
 * 
 * Learns from user feedback, conversation patterns, and usage statistics
 * to improve memory extraction, scoring, and storage decisions over time.
 */

import type { EnhancedCandidate } from './enhanced-categorizer.js';
import { semanticSimilarity } from './text-utils.js';

export interface LearningData {
  userId: string;
  action: 'accepted' | 'rejected' | 'ignored' | 'modified';
  originalCandidate: EnhancedCandidate;
  modifiedCandidate?: EnhancedCandidate;
  context?: {
    conversationTopic?: string;
    timeOfDay?: string;
    userMood?: string;
  };
  timestamp: Date;
}

export interface UserPreferences {
  userId: string;
  preferredTypes: Record<string, number>; // type -> preference score
  rejectedPatterns: string[]; // patterns user typically rejects
  acceptedPatterns: string[]; // patterns user typically accepts
  confidenceThreshold: number; // user's confidence threshold for auto-save
  categoryPreferences: Record<string, number>; // category -> preference score
  lastUpdated: Date;
}

export class AdaptiveLearningSystem {
  private learningHistory: Map<string, LearningData[]> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();
  
  /**
   * Record user feedback for learning
   */
  recordFeedback(feedback: LearningData): void {
    const userId = feedback.userId;
    
    if (!this.learningHistory.has(userId)) {
      this.learningHistory.set(userId, []);
    }
    
    this.learningHistory.get(userId)!.push(feedback);
    this.updateUserPreferences(feedback);
  }

  /**
   * Get adaptive scoring for a candidate based on learned preferences
   */
  getAdaptiveScore(candidate: EnhancedCandidate, userId: string): number {
    const baseScore = candidate.confidence * candidate.importance;
    const preferences = this.userPreferences.get(userId);
    
    if (!preferences) {
      return baseScore; // No learning data yet
    }
    
    let adaptiveMultiplier = 1.0;
    
    // Type preference adjustment
    const typePreference = preferences.preferredTypes[candidate.type] || 0.5;
    adaptiveMultiplier *= (0.5 + typePreference * 0.5);
    
    // Category preference adjustment
    const categoryPreference = preferences.categoryPreferences[candidate.category] || 0.5;
    adaptiveMultiplier *= (0.5 + categoryPreference * 0.5);
    
    // Pattern matching adjustments
    const candidateText = `${candidate.key} ${candidate.value}`.toLowerCase();
    
    // Check against rejected patterns
    for (const rejectedPattern of preferences.rejectedPatterns) {
      if (semanticSimilarity(candidateText, rejectedPattern) > 0.7) {
        adaptiveMultiplier *= 0.3; // Strong penalty for rejected patterns
        break;
      }
    }
    
    // Check against accepted patterns
    for (const acceptedPattern of preferences.acceptedPatterns) {
      if (semanticSimilarity(candidateText, acceptedPattern) > 0.7) {
        adaptiveMultiplier *= 1.5; // Bonus for accepted patterns
        break;
      }
    }
    
    return Math.min(1.0, baseScore * adaptiveMultiplier);
  }

  /**
   * Get personalized confidence threshold for auto-save decisions
   */
  getAdaptiveThreshold(userId: string): number {
    const preferences = this.userPreferences.get(userId);
    return preferences?.confidenceThreshold || 0.75; // Default threshold
  }

  /**
   * Predict user action based on learned patterns
   */
  predictUserAction(candidate: EnhancedCandidate, userId: string): {
    predictedAction: 'accept' | 'reject' | 'uncertain';
    confidence: number;
  } {
    const preferences = this.userPreferences.get(userId);
    const history = this.learningHistory.get(userId);
    
    if (!preferences || !history || history.length < 5) {
      return { predictedAction: 'uncertain', confidence: 0.5 };
    }
    
    // Find similar past candidates
    const candidateText = `${candidate.key} ${candidate.value}`;
    const similarFeedback = history.filter(feedback => {
      const feedbackText = `${feedback.originalCandidate.key} ${feedback.originalCandidate.value}`;
      return semanticSimilarity(candidateText, feedbackText) > 0.6;
    });
    
    if (similarFeedback.length === 0) {
      return { predictedAction: 'uncertain', confidence: 0.5 };
    }
    
    // Analyze patterns in similar feedback
    const acceptanceRate = similarFeedback.filter(f => f.action === 'accepted').length / similarFeedback.length;
    const rejectionRate = similarFeedback.filter(f => f.action === 'rejected').length / similarFeedback.length;
    
    if (acceptanceRate > 0.7) {
      return { predictedAction: 'accept', confidence: acceptanceRate };
    } else if (rejectionRate > 0.7) {
      return { predictedAction: 'reject', confidence: rejectionRate };
    } else {
      return { predictedAction: 'uncertain', confidence: 0.5 };
    }
  }

  /**
   * Update user preferences based on feedback
   */
  private updateUserPreferences(feedback: LearningData): void {
    const userId = feedback.userId;
    
    if (!this.userPreferences.has(userId)) {
      this.userPreferences.set(userId, {
        userId,
        preferredTypes: {},
        rejectedPatterns: [],
        acceptedPatterns: [],
        confidenceThreshold: 0.75,
        categoryPreferences: {},
        lastUpdated: new Date()
      });
    }
    
    const preferences = this.userPreferences.get(userId)!;
    const candidate = feedback.originalCandidate;
    
    // Update type preferences
    const currentTypePreference = preferences.preferredTypes[candidate.type] || 0.5;
    if (feedback.action === 'accepted') {
      preferences.preferredTypes[candidate.type] = Math.min(1.0, currentTypePreference + 0.1);
    } else if (feedback.action === 'rejected') {
      preferences.preferredTypes[candidate.type] = Math.max(0.0, currentTypePreference - 0.1);
    }
    
    // Update category preferences
    const currentCategoryPreference = preferences.categoryPreferences[candidate.category] || 0.5;
    if (feedback.action === 'accepted') {
      preferences.categoryPreferences[candidate.category] = Math.min(1.0, currentCategoryPreference + 0.1);
    } else if (feedback.action === 'rejected') {
      preferences.categoryPreferences[candidate.category] = Math.max(0.0, currentCategoryPreference - 0.1);
    }
    
    // Update pattern lists
    const candidatePattern = `${candidate.key} ${candidate.value}`.toLowerCase();
    
    if (feedback.action === 'accepted') {
      if (!preferences.acceptedPatterns.includes(candidatePattern)) {
        preferences.acceptedPatterns.push(candidatePattern);
        // Keep only recent patterns (max 50)
        if (preferences.acceptedPatterns.length > 50) {
          preferences.acceptedPatterns = preferences.acceptedPatterns.slice(-50);
        }
      }
    } else if (feedback.action === 'rejected') {
      if (!preferences.rejectedPatterns.includes(candidatePattern)) {
        preferences.rejectedPatterns.push(candidatePattern);
        // Keep only recent patterns (max 50)
        if (preferences.rejectedPatterns.length > 50) {
          preferences.rejectedPatterns = preferences.rejectedPatterns.slice(-50);
        }
      }
    }
    
    // Adaptive confidence threshold adjustment
    if (feedback.action === 'accepted' && candidate.confidence < preferences.confidenceThreshold) {
      // User accepted low-confidence item, lower threshold slightly
      preferences.confidenceThreshold = Math.max(0.4, preferences.confidenceThreshold - 0.02);
    } else if (feedback.action === 'rejected' && candidate.confidence > preferences.confidenceThreshold) {
      // User rejected high-confidence item, raise threshold slightly
      preferences.confidenceThreshold = Math.min(0.95, preferences.confidenceThreshold + 0.02);
    }
    
    preferences.lastUpdated = new Date();
  }

  /**
   * Get learning insights for a user
   */
  getLearningInsights(userId: string): {
    totalFeedback: number;
    acceptanceRate: number;
    mostPreferredType: string;
    leastPreferredType: string;
    adaptiveThreshold: number;
    recentTrends: string[];
  } {
    const history = this.learningHistory.get(userId) || [];
    const preferences = this.userPreferences.get(userId);
    
    if (history.length === 0) {
      return {
        totalFeedback: 0,
        acceptanceRate: 0,
        mostPreferredType: 'unknown',
        leastPreferredType: 'unknown',
        adaptiveThreshold: 0.75,
        recentTrends: []
      };
    }
    
    const acceptedCount = history.filter(h => h.action === 'accepted').length;
    const acceptanceRate = acceptedCount / history.length;
    
    // Find most and least preferred types
    const typePreferences = preferences?.preferredTypes || {};
    const mostPreferredType = Object.entries(typePreferences)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
    const leastPreferredType = Object.entries(typePreferences)
      .sort(([,a], [,b]) => a - b)[0]?.[0] || 'unknown';
    
    // Recent trends analysis (last 10 feedback items)
    const recentHistory = history.slice(-10);
    const recentTrends: string[] = [];
    
    const recentAcceptanceRate = recentHistory.filter(h => h.action === 'accepted').length / recentHistory.length;
    if (recentAcceptanceRate > acceptanceRate + 0.2) {
      recentTrends.push('Increasing acceptance rate');
    } else if (recentAcceptanceRate < acceptanceRate - 0.2) {
      recentTrends.push('Decreasing acceptance rate');
    }
    
    // Check for type trends
    const recentTypes = recentHistory.map(h => h.originalCandidate.type);
    const mostRecentType = recentTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantRecentType = Object.entries(mostRecentType)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    if (dominantRecentType && (mostRecentType[dominantRecentType] / recentHistory.length) > 0.4) {
      recentTrends.push(`Focus on ${dominantRecentType} memories`);
    }
    
    return {
      totalFeedback: history.length,
      acceptanceRate,
      mostPreferredType,
      leastPreferredType,
      adaptiveThreshold: preferences?.confidenceThreshold || 0.75,
      recentTrends
    };
  }

  /**
   * Export learning data for backup/analysis
   */
  exportLearningData(userId: string): {
    preferences: UserPreferences | null;
    history: LearningData[];
  } {
    return {
      preferences: this.userPreferences.get(userId) || null,
      history: this.learningHistory.get(userId) || []
    };
  }

  /**
   * Import learning data from backup
   */
  importLearningData(userId: string, data: {
    preferences?: UserPreferences;
    history?: LearningData[];
  }): void {
    if (data.preferences) {
      this.userPreferences.set(userId, data.preferences);
    }
    
    if (data.history) {
      this.learningHistory.set(userId, data.history);
    }
  }

  /**
   * Cleanup old learning data (privacy compliance)
   */
  cleanupOldData(maxAgeMonths: number = 12): void {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - maxAgeMonths);
    
    for (const [userId, history] of this.learningHistory.entries()) {
      const filteredHistory = history.filter(h => h.timestamp > cutoffDate);
      if (filteredHistory.length > 0) {
        this.learningHistory.set(userId, filteredHistory);
      } else {
        this.learningHistory.delete(userId);
      }
    }
    
    // Also cleanup user preferences if no recent history
    for (const [userId, preferences] of this.userPreferences.entries()) {
      if (preferences.lastUpdated < cutoffDate && !this.learningHistory.has(userId)) {
        this.userPreferences.delete(userId);
      }
    }
  }
}
