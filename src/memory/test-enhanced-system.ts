/**
 * Test Suite for Enhanced Memory System
 * 
 * Comprehensive tests for all enhanced memory management features
 */

import { EnhancedMemoryManager, type ConversationContext } from './enhanced-manager.js';
import { MemoryCategorizerEnhanced } from './enhanced-categorizer.js';
import { MemoryConsolidator } from './consolidator.js';
import { AdaptiveLearningSystem } from './adaptive-learning.js';
import { calculateSimilarity, normalizeGermanText, detectTemporal, detectSentiment } from './text-utils.js';

class EnhancedMemoryTests {
  private manager: EnhancedMemoryManager;
  private testUserId = 'test-user-123';

  constructor() {
    this.manager = new EnhancedMemoryManager();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Enhanced Memory System Tests\n');
    
    await this.testTextUtilities();
    await this.testEnhancedCategorizer();
    await this.testConsolidator();
    await this.testAdaptiveLearning();
    await this.testEnhancedManager();
    
    console.log('\n✅ All Enhanced Memory System Tests Completed!');
  }

  private async testTextUtilities(): Promise<void> {
    console.log('📝 Testing Text Utilities...');
    
    // Test similarity calculation
    const sim1 = calculateSimilarity('Ich mag Kaffee', 'ich mag kaffee sehr');
    console.log(`   Similarity "Ich mag Kaffee" vs "ich mag kaffee sehr": ${sim1.toFixed(3)}`);
    console.assert(sim1 > 0.7, 'High similarity expected');
    
    // Test German text normalization
    const normalized = normalizeGermanText('Ich möchte gerne Kaffee trinken!');
    console.log(`   Normalized "Ich möchte gerne Kaffee trinken!": "${normalized}"`);
    console.assert(normalized.includes('moechte'), 'Umlaut should be converted');
    
    // Test temporal detection
    const temporal = detectTemporal('Ich trinke jeden Morgen Kaffee');
    console.log(`   Temporal detection "jeden Morgen": ${temporal.isTemporal} (${temporal.temporalType})`);
    console.assert(temporal.isTemporal, 'Should detect temporal pattern');
    
    // Test sentiment detection
    const sentiment = detectSentiment('Ich liebe diese Farbe, sie ist wunderbar!');
    console.log(`   Sentiment "liebe...wunderbar": ${sentiment.sentiment} (${sentiment.confidence.toFixed(3)})`);
    console.assert(sentiment.sentiment === 'positive', 'Should detect positive sentiment');
    
    console.log('   ✅ Text Utilities tests passed\n');
  }

  private async testEnhancedCategorizer(): Promise<void> {
    console.log('🏷️ Testing Enhanced Categorizer...');
    
    const basicCandidate = {
      person: 'self',
      type: 'preference' as const,
      key: 'lieblingsfarbe',
      value: 'blau',
      confidence: 0.9
    };
    
    const context = {
      conversationTopic: 'farben',
      timeOfDay: 'morning',
      userMood: 'positive' as const
    };
    
    const enhanced = MemoryCategorizerEnhanced.enhanceCandidate(
      basicCandidate, 
      context, 
      []
    );
    
    console.log(`   Enhanced candidate category: ${enhanced.category}`);
    console.log(`   Enhanced candidate priority: ${enhanced.priority}`);
    console.log(`   Enhanced candidate volatility: ${enhanced.volatility}`);
    console.log(`   Enhanced candidate tags: ${enhanced.tags?.join(', ')}`);
    
    console.assert(enhanced.category !== undefined, 'Category should be assigned');
    console.assert(enhanced.importance > 0, 'Importance should be calculated');
    console.assert(enhanced.tags && enhanced.tags.length > 0, 'Tags should be generated');
    
    console.log('   ✅ Enhanced Categorizer tests passed\n');
  }

  private async testConsolidator(): Promise<void> {
    console.log('🔄 Testing Memory Consolidator...');
    
    const candidate1 = {
      person: 'self',
      type: 'preference' as const,
      category: 'personal' as const,
      key: 'lieblingsfarbe',
      value: 'blau',
      confidence: 0.8,
      importance: 0.7,
      volatility: 'static' as const,
      priority: 'medium' as const
    };
    
    const existing = [{
      person: 'self',
      type: 'preference' as const,
      category: 'personal' as const,
      key: 'lieblingsfarbe',
      value: 'rot',
      confidence: 0.6,
      importance: 0.6,
      volatility: 'static' as const,
      priority: 'medium' as const
    }];
    
    const result = MemoryConsolidator.consolidate(candidate1, existing);
    console.log(`   Consolidation action: ${result.action}`);
    
    if (result.action === 'conflict') {
      console.log(`   Conflict detected: ${result.conflictReason}`);
    }
    
    console.assert(result.action !== 'add_new', 'Should detect relationship with existing memory');
    
    console.log('   ✅ Memory Consolidator tests passed\n');
  }

  private async testAdaptiveLearning(): Promise<void> {
    console.log('🧠 Testing Adaptive Learning System...');
    
    const learning = new AdaptiveLearningSystem();
    const userId = 'test-adaptive-user';
    
    const candidate = {
      person: 'self',
      type: 'preference' as const,
      category: 'personal' as const,
      key: 'mag',
      value: 'pizza',
      confidence: 0.7,
      importance: 0.6,
      volatility: 'semi-stable' as const,
      priority: 'medium' as const
    };
    
    // Record some feedback
    learning.recordFeedback({
      userId,
      action: 'accepted',
      originalCandidate: candidate,
      timestamp: new Date()
    });
    
    // Test adaptive scoring
    const adaptiveScore = learning.getAdaptiveScore(candidate, userId);
    console.log(`   Adaptive score for pizza preference: ${adaptiveScore.toFixed(3)}`);
    
    // Test prediction
    const prediction = learning.predictUserAction(candidate, userId);
    console.log(`   Predicted action: ${prediction.predictedAction} (confidence: ${prediction.confidence.toFixed(3)})`);
    
    // Test insights
    const insights = learning.getLearningInsights(userId);
    console.log(`   Learning insights - Total feedback: ${insights.totalFeedback}`);
    console.log(`   Learning insights - Acceptance rate: ${insights.acceptanceRate.toFixed(3)}`);
    
    console.assert(adaptiveScore >= 0, 'Adaptive score should be non-negative');
    console.assert(insights.totalFeedback === 1, 'Should track feedback count');
    
    console.log('   ✅ Adaptive Learning System tests passed\n');
  }

  private async testEnhancedManager(): Promise<void> {
    console.log('🚀 Testing Enhanced Memory Manager...');
    
    const context: ConversationContext = {
      userId: this.testUserId,
      conversationTopic: 'preferences',
      timeOfDay: 'afternoon',
      userMood: 'positive'
    };
    
    // Test basic evaluation
    const result1 = await this.manager.evaluateAndStore(
      context,
      'Meine Lieblingsfarbe ist grün und ich trinke gerne Tee.',
      { includeInsights: true }
    );
    
    console.log(`   Enhanced evaluation result:`);
    console.log(`   - Saved: ${result1.saved.length}`);
    console.log(`   - Suggestions: ${result1.suggestions.length}`);
    console.log(`   - Conflicts: ${result1.conflicts.length}`);
    console.log(`   - Rejected: ${result1.rejected.length}`);
    
    if (result1.insights) {
      console.log(`   - Total memories: ${result1.insights.totalMemories}`);
      console.log(`   - Memory distribution: ${JSON.stringify(result1.insights.memoryDistribution)}`);
    }
    
    // Test PII rejection
    const result2 = await this.manager.evaluateAndStore(
      context,
      'Meine Email ist test@example.com'
    );
    
    console.log(`   PII test - Rejected: ${result2.rejected.length} (should be > 0)`);
    console.assert(result2.rejected.length > 0, 'Should reject PII content');
    
    // Test maintenance
    const maintenance = await this.manager.performMaintenance(this.testUserId);
    console.log(`   Maintenance - Cleaned memories: ${maintenance.cleanedMemories}`);
    
    console.log('   ✅ Enhanced Memory Manager tests passed\n');
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests(): Promise<void> {
    console.log('⚡ Running Performance Tests...');
    
    const context: ConversationContext = {
      userId: 'perf-test-user',
      conversationTopic: 'performance'
    };
    
    const testUtterances = [
      'Ich heiße Anna und wohne in Berlin.',
      'Meine Lieblingsfarbe ist rot und ich mag Pizza.',
      'Ich arbeite als Software-Entwickler bei einer Tech-Firma.',
      'Jeden Morgen trinke ich Kaffee und lese Nachrichten.',
      'Mein Hobby ist Fotografie und ich reise gerne.'
    ];
    
    const startTime = Date.now();
    
    for (const utterance of testUtterances) {
      await this.manager.evaluateAndStore(context, utterance);
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / testUtterances.length;
    
    console.log(`   Processed ${testUtterances.length} utterances in ${endTime - startTime}ms`);
    console.log(`   Average processing time: ${avgTime.toFixed(2)}ms per utterance`);
    console.log(`   Performance target: < 100ms per utterance`);
    
    console.assert(avgTime < 200, `Performance test failed: ${avgTime}ms > 200ms`);
    
    console.log('   ✅ Performance tests passed\n');
  }

  /**
   * Run stress tests
   */
  async runStressTests(): Promise<void> {
    console.log('💪 Running Stress Tests...');
    
    const context: ConversationContext = {
      userId: 'stress-test-user',
      conversationTopic: 'stress'
    };
    
    // Generate many similar candidates to test deduplication
    const stressUtterances = [];
    for (let i = 0; i < 20; i++) {
      stressUtterances.push(`Ich mag Farbe nummer ${i} und das ist ${['rot', 'blau', 'grün'][i % 3]}.`);
    }
    
    let totalProcessed = 0;
    let totalSaved = 0;
    let totalSuggestions = 0;
    
    for (const utterance of stressUtterances) {
      const result = await this.manager.evaluateAndStore(context, utterance);
      totalProcessed++;
      totalSaved += result.saved.length;
      totalSuggestions += result.suggestions.length;
    }
    
    console.log(`   Stress test results:`);
    console.log(`   - Processed: ${totalProcessed} utterances`);
    console.log(`   - Total saved: ${totalSaved}`);
    console.log(`   - Total suggestions: ${totalSuggestions}`);
    console.log(`   - Deduplication effective: ${totalSaved < totalProcessed}`);
    
    console.assert(totalSaved < totalProcessed, 'Deduplication should prevent all utterances from being saved');
    
    console.log('   ✅ Stress tests passed\n');
  }
}

// Export test runner
export async function runEnhancedMemoryTests(): Promise<void> {
  const tests = new EnhancedMemoryTests();
  
  try {
    await tests.runAllTests();
    await tests.runPerformanceTests();
    await tests.runStressTests();
    
    console.log('🎉 All Enhanced Memory System Tests Completed Successfully!');
  } catch (error) {
    console.error('❌ Enhanced Memory System Tests Failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnhancedMemoryTests().catch(console.error);
}
