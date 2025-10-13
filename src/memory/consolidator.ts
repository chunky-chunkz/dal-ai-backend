/**
 * Memory Consolidator
 * 
 * Intelligently merges, updates, and organizes memories over time.
 * Handles contradictions, updates outdated information, and maintains consistency.
 */

import type { EnhancedCandidate } from './enhanced-categorizer.js';
import { calculateSimilarity, normalizeGermanText } from './text-utils.js';

export interface ConsolidationResult {
  action: 'merge' | 'update' | 'conflict' | 'add_new';
  primary: EnhancedCandidate;
  related?: EnhancedCandidate[];
  conflictReason?: string;
  confidenceChange?: number;
}

export class MemoryConsolidator {
  
  /**
   * Consolidate new candidate with existing memories
   */
  static consolidate(
    newCandidate: EnhancedCandidate,
    existingMemories: EnhancedCandidate[]
  ): ConsolidationResult {
    
    const similar = this.findSimilarMemories(newCandidate, existingMemories);
    
    if (similar.length === 0) {
      return {
        action: 'add_new',
        primary: newCandidate
      };
    }
    
    // Find exact duplicates first
    const exactMatch = similar.find(mem => 
      mem.key === newCandidate.key && 
      mem.person === newCandidate.person
    );
    
    if (exactMatch) {
      return this.handleExactMatch(newCandidate, exactMatch);
    }
    
    // Handle semantic similarities
    const semanticMatches = similar.filter(mem => 
      this.areSemanticallySame(newCandidate, mem)
    );
    
    if (semanticMatches.length > 0) {
      return this.handleSemanticMatch(newCandidate, semanticMatches);
    }
    
    // Check for contradictions
    const contradictions = similar.filter(mem =>
      this.areContradictory(newCandidate, mem)
    );
    
    if (contradictions.length > 0) {
      return this.handleContradiction(newCandidate, contradictions);
    }
    
    return {
      action: 'add_new',
      primary: newCandidate,
      related: similar
    };
  }

  /**
   * Find memories similar to the new candidate
   */
  private static findSimilarMemories(
    candidate: EnhancedCandidate,
    existing: EnhancedCandidate[]
  ): EnhancedCandidate[] {
    const similar: EnhancedCandidate[] = [];
    
    for (const memory of existing) {
      const similarity = this.calculateMemorySimilarity(candidate, memory);
      
      if (similarity > 0.7) {
        similar.push(memory);
      }
    }
    
    return similar.sort((a, b) => 
      this.calculateMemorySimilarity(candidate, b) - 
      this.calculateMemorySimilarity(candidate, a)
    );
  }

  /**
   * Calculate similarity between two memories
   */
  private static calculateMemorySimilarity(
    mem1: EnhancedCandidate,
    mem2: EnhancedCandidate
  ): number {
    let similarity = 0;
    
    // Same person bonus
    if (mem1.person === mem2.person) {
      similarity += 0.3;
    }
    
    // Same type bonus
    if (mem1.type === mem2.type) {
      similarity += 0.2;
    }
    
    // Key similarity
    const keySimilarity = calculateSimilarity(
      normalizeGermanText(mem1.key),
      normalizeGermanText(mem2.key)
    );
    similarity += keySimilarity * 0.3;
    
    // Value similarity
    const valueSimilarity = calculateSimilarity(
      normalizeGermanText(mem1.value),
      normalizeGermanText(mem2.value)
    );
    similarity += valueSimilarity * 0.2;
    
    return Math.min(1.0, similarity);
  }

  /**
   * Handle exact key/person matches
   */
  private static handleExactMatch(
    newCandidate: EnhancedCandidate,
    existing: EnhancedCandidate
  ): ConsolidationResult {
    
    // Same value - reinforce confidence
    if (normalizeGermanText(newCandidate.value) === normalizeGermanText(existing.value)) {
      const confidenceBoost = Math.min(0.1, (1.0 - existing.confidence) * 0.5);
      
      return {
        action: 'merge',
        primary: {
          ...existing,
          confidence: Math.min(1.0, existing.confidence + confidenceBoost),
          importance: Math.max(existing.importance, newCandidate.importance)
        },
        confidenceChange: confidenceBoost
      };
    }
    
    // Different value - potential update or conflict
    if (existing.volatility === 'dynamic' || existing.volatility === 'semi-stable') {
      // Update if new info is more confident or recent
      if (newCandidate.confidence > existing.confidence + 0.1) {
        return {
          action: 'update',
          primary: {
            ...newCandidate,
            confidence: Math.max(newCandidate.confidence, existing.confidence * 0.9)
          }
        };
      }
    }
    
    // Static info that changed - flag as conflict
    return {
      action: 'conflict',
      primary: existing,
      related: [newCandidate],
      conflictReason: `Static information conflict: "${existing.value}" vs "${newCandidate.value}"`
    };
  }

  /**
   * Handle semantic matches (different keys, same meaning)
   */
  private static handleSemanticMatch(
    newCandidate: EnhancedCandidate,
    matches: EnhancedCandidate[]
  ): ConsolidationResult {
    
    const bestMatch = matches[0];
    
    // Merge with most similar
    const merged: EnhancedCandidate = {
      ...bestMatch,
      confidence: Math.max(bestMatch.confidence, newCandidate.confidence),
      importance: Math.max(bestMatch.importance, newCandidate.importance),
      relationships: [...new Set([
        ...(bestMatch.relationships || []),
        ...(newCandidate.relationships || [])
      ])],
      tags: [...new Set([
        ...(bestMatch.tags || []),
        ...(newCandidate.tags || [])
      ])]
    };
    
    return {
      action: 'merge',
      primary: merged,
      related: matches.slice(1)
    };
  }

  /**
   * Handle contradictory information
   */
  private static handleContradiction(
    newCandidate: EnhancedCandidate,
    contradictions: EnhancedCandidate[]
  ): ConsolidationResult {
    
    const strongest = contradictions.reduce((prev, current) => 
      current.confidence > prev.confidence ? current : prev
    );
    
    // If new candidate is significantly more confident, update
    if (newCandidate.confidence > strongest.confidence + 0.2) {
      return {
        action: 'update',
        primary: newCandidate
      };
    }
    
    // Otherwise flag as conflict for human review
    return {
      action: 'conflict',
      primary: strongest,
      related: [newCandidate, ...contradictions.filter(c => c !== strongest)],
      conflictReason: `Contradictory information detected`
    };
  }

  /**
   * Check if two memories are semantically the same
   */
  private static areSemanticallySame(
    mem1: EnhancedCandidate,
    mem2: EnhancedCandidate
  ): boolean {
    
    // Same person and type
    if (mem1.person !== mem2.person || mem1.type !== mem2.type) {
      return false;
    }
    
    // Check semantic equivalence groups
    const semanticGroups = [
      ['name', 'vorname', 'heißt', 'genannt'],
      ['wohnort', 'stadt', 'lebt_in', 'zuhause'],
      ['beruf', 'job', 'arbeitet_als', 'ist'],
      ['mag', 'gefällt', 'liebt', 'bevorzugt'],
      ['kann', 'beherrscht', 'kennt', 'versteht']
    ];
    
    for (const group of semanticGroups) {
      const mem1InGroup = group.some(word => mem1.key.includes(word));
      const mem2InGroup = group.some(word => mem2.key.includes(word));
      
      if (mem1InGroup && mem2InGroup) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if two memories contradict each other
   */
  private static areContradictory(
    mem1: EnhancedCandidate,
    mem2: EnhancedCandidate
  ): boolean {
    
    if (!this.areSemanticallySame(mem1, mem2)) {
      return false;
    }
    
    // Normalize and compare values
    const val1 = normalizeGermanText(mem1.value);
    const val2 = normalizeGermanText(mem2.value);
    
    // Different values for same semantic concept = potential contradiction
    if (val1 !== val2) {
      // Check for negation patterns
      const negationPatterns = [
        'nicht', 'kein', 'keine', 'nie', 'niemals', 'nein'
      ];
      
      const val1HasNegation = negationPatterns.some(neg => val1.includes(neg));
      const val2HasNegation = negationPatterns.some(neg => val2.includes(neg));
      
      // If one has negation and other doesn't, likely contradictory
      if (val1HasNegation !== val2HasNegation) {
        return true;
      }
      
      // Check for obvious contradictions (colors, yes/no, etc.)
      return this.areValuesContradictory(val1, val2);
    }
    
    return false;
  }

  /**
   * Check if two values are contradictory
   */
  private static areValuesContradictory(val1: string, val2: string): boolean {
    
    // Color contradictions
    const colors = ['rot', 'blau', 'grün', 'gelb', 'schwarz', 'weiß', 'grau', 'braun'];
    const val1Color = colors.find(c => val1.includes(c));
    const val2Color = colors.find(c => val2.includes(c));
    
    if (val1Color && val2Color && val1Color !== val2Color) {
      return true;
    }
    
    // Boolean contradictions
    const booleanPairs = [
      ['ja', 'nein'],
      ['richtig', 'falsch'],
      ['wahr', 'unwahr'],
      ['mag', 'mag nicht'],
      ['kann', 'kann nicht']
    ];
    
    for (const [positive, negative] of booleanPairs) {
      if ((val1.includes(positive) && val2.includes(negative)) ||
          (val1.includes(negative) && val2.includes(positive))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Periodic cleanup of old, low-quality, or contradictory memories
   */
  static cleanupMemories(memories: EnhancedCandidate[]): EnhancedCandidate[] {
    const cleaned: EnhancedCandidate[] = [];
    const groups = this.groupSimilarMemories(memories);
    
    for (const group of groups) {
      if (group.length === 1) {
        // Single memory - keep if quality is decent
        if (group[0].confidence >= 0.3 && group[0].importance >= 0.2) {
          cleaned.push(group[0]);
        }
      } else {
        // Multiple similar memories - consolidate
        const consolidated = this.consolidateGroup(group);
        cleaned.push(consolidated);
      }
    }
    
    return cleaned;
  }

  /**
   * Group similar memories together
   */
  private static groupSimilarMemories(memories: EnhancedCandidate[]): EnhancedCandidate[][] {
    const groups: EnhancedCandidate[][] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < memories.length; i++) {
      if (processed.has(i)) continue;
      
      const group = [memories[i]];
      processed.add(i);
      
      for (let j = i + 1; j < memories.length; j++) {
        if (processed.has(j)) continue;
        
        if (this.calculateMemorySimilarity(memories[i], memories[j]) > 0.8) {
          group.push(memories[j]);
          processed.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * Consolidate a group of similar memories into one
   */
  private static consolidateGroup(group: EnhancedCandidate[]): EnhancedCandidate {
    // Choose the highest confidence memory as base
    const base = group.reduce((prev, current) => 
      current.confidence > prev.confidence ? current : prev
    );
    
    // Merge information from all memories
    const consolidated: EnhancedCandidate = {
      ...base,
      confidence: Math.min(1.0, base.confidence + (group.length - 1) * 0.05),
      importance: Math.max(...group.map(m => m.importance)),
      relationships: [...new Set(group.flatMap(m => m.relationships || []))],
      tags: [...new Set(group.flatMap(m => m.tags || []))]
    };
    
    return consolidated;
  }
}
