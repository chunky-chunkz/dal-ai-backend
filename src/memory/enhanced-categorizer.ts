/**
 * Enhanced Memory Categorizer
 * 
 * Advanced categorization system with context awareness,
 * relationship mapping, and importance weighting
 */

export interface MemoryContext {
  conversationTopic?: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  season?: string;
  previousInteractions?: string[];
  userMood?: 'positive' | 'neutral' | 'negative';
}

export interface EnhancedCandidate {
  person?: string;
  type: "preference" | "profile_fact" | "contact" | "task_hint" | "relationship" | "expertise" | "availability" | "habit";
  category: "personal" | "professional" | "social" | "behavioral" | "contextual";
  key: string;
  value: string;
  confidence: number;
  importance: number; // 0-1 scale
  context?: MemoryContext;
  relationships?: string[]; // Related memory keys
  volatility: "static" | "semi-stable" | "dynamic"; // How often this might change
  priority: "high" | "medium" | "low";
  tags?: string[];
}

export class MemoryCategorizerEnhanced {
  
  /**
   * Categorize and enrich a basic candidate with advanced metadata
   */
  static enhanceCandidate(
    basicCandidate: any,
    context?: MemoryContext,
    existingMemories: any[] = []
  ): EnhancedCandidate {
    
    const enhanced: EnhancedCandidate = {
      ...basicCandidate,
      category: this.determineCategory(basicCandidate),
      importance: this.calculateImportance(basicCandidate, context),
      volatility: this.determineVolatility(basicCandidate),
      priority: this.determinePriority(basicCandidate, context),
      context,
      relationships: this.findRelationships(basicCandidate, existingMemories),
      tags: this.generateTags(basicCandidate, context)
    };

    return enhanced;
  }

  /**
   * Determine the high-level category for the memory
   */
  private static determineCategory(candidate: any): EnhancedCandidate['category'] {
    const { type, key, value } = candidate;
    
    // Professional indicators
    const professionalKeywords = ['beruf', 'job', 'arbeit', 'firma', 'team', 'rolle', 'projekt', 'meeting'];
    if (professionalKeywords.some(kw => key.includes(kw) || value.includes(kw))) {
      return 'professional';
    }
    
    // Social indicators
    const socialKeywords = ['freund', 'familie', 'kollege', 'partner', 'kontakt', 'beziehung'];
    if (socialKeywords.some(kw => key.includes(kw) || value.includes(kw))) {
      return 'social';
    }
    
    // Behavioral patterns
    const behavioralKeywords = ['gewohnheit', 'routine', 'zeit', 'immer', 'nie', 'täglich', 'wöchentlich'];
    if (behavioralKeywords.some(kw => key.includes(kw) || value.includes(kw))) {
      return 'behavioral';
    }
    
    // Context-dependent
    if (type === 'task_hint' || key.includes('termin') || key.includes('erinnerung')) {
      return 'contextual';
    }
    
    return 'personal';
  }

  /**
   * Calculate importance score based on various factors
   */
  private static calculateImportance(candidate: any, context?: MemoryContext): number {
    let importance = 0.5; // Base importance
    
    // Type-based importance
    const typeWeights = {
      'profile_fact': 0.8,
      'preference': 0.7,
      'expertise': 0.9,
      'availability': 0.6,
      'relationship': 0.85,
      'contact': 0.9,
      'task_hint': 0.7,
      'habit': 0.6
    };
    
    importance += (typeWeights[candidate.type as keyof typeof typeWeights] || 0.5) * 0.3;
    
    // Confidence boost
    importance += candidate.confidence * 0.2;
    
    // Context boost
    if (context?.conversationTopic) {
      if (candidate.value.toLowerCase().includes(context.conversationTopic.toLowerCase())) {
        importance += 0.1;
      }
    }
    
    // Professional context boost
    if (candidate.category === 'professional') {
      importance += 0.1;
    }
    
    return Math.min(1.0, importance);
  }

  /**
   * Determine how volatile/stable this memory is
   */
  private static determineVolatility(candidate: any): EnhancedCandidate['volatility'] {
    const { key, value, type } = candidate;
    
    // Static facts (rarely change)
    const staticIndicators = ['name', 'geboren', 'nationalität', 'geschlecht'];
    if (staticIndicators.some(indicator => key.includes(indicator))) {
      return 'static';
    }
    
    // Dynamic facts (change frequently)
    const dynamicIndicators = ['stimmung', 'heute', 'gerade', 'momentan', 'aktuell'];
    if (dynamicIndicators.some(indicator => key.includes(indicator) || value.includes(indicator))) {
      return 'dynamic';
    }
    
    // Task hints are usually dynamic
    if (type === 'task_hint') {
      return 'dynamic';
    }
    
    return 'semi-stable';
  }

  /**
   * Determine priority level
   */
  private static determinePriority(candidate: any, context?: MemoryContext): EnhancedCandidate['priority'] {
    const importance = this.calculateImportance(candidate, context);
    
    if (importance >= 0.8) return 'high';
    if (importance >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Find relationships to existing memories
   */
  private static findRelationships(candidate: any, existingMemories: any[]): string[] {
    const relationships: string[] = [];
    
    for (const existing of existingMemories) {
      // Same person relationship
      if (candidate.person === existing.person && candidate.person !== 'self') {
        relationships.push(existing.key);
      }
      
      // Semantic similarity (simplified)
      if (this.areSemanticallyRelated(candidate.key, existing.key)) {
        relationships.push(existing.key);
      }
      
      // Type clustering
      if (candidate.type === existing.type && candidate.key !== existing.key) {
        relationships.push(existing.key);
      }
    }
    
    return relationships;
  }

  /**
   * Generate contextual tags
   */
  private static generateTags(candidate: any, context?: MemoryContext): string[] {
    const tags: string[] = [];
    
    // Add type as tag
    tags.push(candidate.type);
    
    // Add category as tag
    const category = this.determineCategory(candidate);
    tags.push(category);
    
    // Context-based tags
    if (context?.timeOfDay) tags.push(`time:${context.timeOfDay}`);
    if (context?.dayOfWeek) tags.push(`day:${context.dayOfWeek}`);
    if (context?.season) tags.push(`season:${context.season}`);
    if (context?.userMood) tags.push(`mood:${context.userMood}`);
    
    // Content-based tags
    const contentTags = this.extractContentTags(candidate.value);
    tags.push(...contentTags);
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Extract content-based tags from value
   */
  private static extractContentTags(value: string): string[] {
    const tags: string[] = [];
    const lower = value.toLowerCase();
    
    // Color detection
    const colors = ['rot', 'blau', 'grün', 'gelb', 'schwarz', 'weiß', 'grau', 'braun', 'orange', 'lila', 'rosa'];
    colors.forEach(color => {
      if (lower.includes(color)) tags.push(`farbe:${color}`);
    });
    
    // Technology detection
    const tech = ['javascript', 'python', 'java', 'react', 'node', 'angular', 'vue', 'typescript'];
    tech.forEach(t => {
      if (lower.includes(t)) tags.push(`tech:${t}`);
    });
    
    // Time patterns
    const timePatterns = ['morgens', 'mittags', 'abends', 'nachts', 'früh', 'spät'];
    timePatterns.forEach(time => {
      if (lower.includes(time)) tags.push(`zeitpunkt:${time}`);
    });
    
    return tags;
  }

  /**
   * Check if two keys are semantically related (simplified)
   */
  private static areSemanticallyRelated(key1: string, key2: string): boolean {
    const semanticGroups = [
      ['name', 'vorname', 'nachname', 'spitzname'],
      ['beruf', 'job', 'arbeit', 'rolle', 'position'],
      ['wohnort', 'stadt', 'adresse', 'zuhause'],
      ['hobby', 'interesse', 'leidenschaft', 'aktivität'],
      ['essen', 'trinken', 'lieblingsgericht', 'getränk'],
      ['sprache', 'sprechen', 'können', 'verstehen']
    ];
    
    for (const group of semanticGroups) {
      if (group.some(word => key1.includes(word)) && group.some(word => key2.includes(word))) {
        return true;
      }
    }
    
    return false;
  }
}
