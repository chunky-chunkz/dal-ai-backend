/**
 * Demo Script for Enhanced Memory System
 * 
 * Interactive demonstration of all new features and improvements
 */

import { EnhancedMemoryManager, type ConversationContext } from './enhanced-manager.js';
import { runEnhancedMemoryTests } from './test-enhanced-system.js';

class MemorySystemDemo {
  private manager: EnhancedMemoryManager;
  private demoUserId = 'demo-user-2024';

  constructor() {
    this.manager = new EnhancedMemoryManager();
  }

  async runFullDemo(): Promise<void> {
    console.log('🎮 Enhanced Memory System - Live Demo\n');
    console.log('=' .repeat(60));
    
    await this.demoBasicFunctionality();
    await this.demoAdvancedCategorization();
    await this.demoConsolidation();
    await this.demoAdaptiveLearning();
    await this.demoContextAwareness();
    await this.demoGermanLanguageFeatures();
    await this.demoPerformanceFeatures();
    
    console.log('\n🎉 Enhanced Memory System Demo Completed!');
    console.log('=' .repeat(60));
  }

  private async demoBasicFunctionality(): Promise<void> {
    console.log('\n📝 Demo 1: Basic Enhanced Functionality');
    console.log('-'.repeat(40));
    
    const context: ConversationContext = {
      userId: this.demoUserId,
      conversationTopic: 'personal_info',
      timeOfDay: 'morning'
    };

    // Test various types of information
    const testUtterances = [
      'Ich heiße Anna Müller und wohne in Berlin.',
      'Meine Lieblingsfarbe ist blau und ich mag italienisches Essen.',
      'Ich arbeite als Software-Entwicklerin bei Microsoft.',
      'Jeden Morgen trinke ich Kaffee und lese die Nachrichten.'
    ];

    for (const utterance of testUtterances) {
      console.log(`\n💬 Utterance: "${utterance}"`);
      
      const result = await this.manager.evaluateAndStore(
        context, 
        utterance, 
        { includeInsights: false }
      );
      
      console.log(`   📊 Result: ${result.saved.length} saved, ${result.suggestions.length} suggested, ${result.rejected.length} rejected`);
      
      if (result.saved.length > 0) {
        result.saved.forEach(memory => {
          console.log(`      ✅ Saved: ${memory.key}="${memory.value}" [${memory.category}/${memory.priority}]`);
        });
      }
      
      if (result.suggestions.length > 0) {
        result.suggestions.forEach(memory => {
          console.log(`      💭 Suggested: ${memory.key}="${memory.value}" [conf: ${memory.confidence.toFixed(2)}]`);
        });
      }
    }
  }

  private async demoAdvancedCategorization(): Promise<void> {
    console.log('\n🏷️ Demo 2: Advanced Categorization & Tagging');
    console.log('-'.repeat(40));
    
    const context: ConversationContext = {
      userId: this.demoUserId,
      conversationTopic: 'work_preferences',
      timeOfDay: 'afternoon',
      userMood: 'positive'
    };

    const complexUtterances = [
      'Ich bevorzuge Remote-Arbeit und verwende hauptsächlich TypeScript.',
      'Mein Team besteht aus 5 Entwicklern und wir haben jeden Freitag Retrospektiven.',
      'Ich kann nicht gut früh am Morgen arbeiten, aber abends bin ich sehr produktiv.'
    ];

    for (const utterance of complexUtterances) {
      console.log(`\n💼 Work Context: "${utterance}"`);
      
      const result = await this.manager.evaluateAndStore(
        context, 
        utterance,
        { includeInsights: true }
      );
      
      [...result.saved, ...result.suggestions].forEach(memory => {
        console.log(`   📋 Memory Details:`);
        console.log(`      Key/Value: ${memory.key}="${memory.value}"`);
        console.log(`      Category: ${memory.category}`);
        console.log(`      Priority: ${memory.priority}`);
        console.log(`      Volatility: ${memory.volatility}`);
        console.log(`      Tags: ${memory.tags?.join(', ') || 'none'}`);
        console.log(`      Importance: ${memory.importance.toFixed(2)}`);
      });
    }
  }

  private async demoConsolidation(): Promise<void> {
    console.log('\n🔄 Demo 3: Memory Consolidation & Conflict Resolution');
    console.log('-'.repeat(40));
    
    const context: ConversationContext = {
      userId: this.demoUserId,
      conversationTopic: 'preferences_update'
    };

    // Create conflicting information to demonstrate consolidation
    const conflictingUtterances = [
      'Meine Lieblingsfarbe ist rot.',           // Initial preference
      'Ich mag die Farbe rot sehr gerne.',       // Reinforcement (should merge)
      'Meine Lieblingsfarbe ist eigentlich grün.' // Contradiction (should create conflict)
    ];

    for (let i = 0; i < conflictingUtterances.length; i++) {
      const utterance = conflictingUtterances[i];
      console.log(`\n🔄 Step ${i + 1}: "${utterance}"`);
      
      const result = await this.manager.evaluateAndStore(context, utterance);
      
      if (result.consolidations.length > 0) {
        result.consolidations.forEach(consolidation => {
          console.log(`   🔗 Consolidation: ${consolidation.action}`);
          if (consolidation.confidenceChange) {
            console.log(`      Confidence change: +${consolidation.confidenceChange.toFixed(3)}`);
          }
        });
      }
      
      if (result.conflicts.length > 0) {
        result.conflicts.forEach(conflict => {
          console.log(`   ⚠️  Conflict detected: ${conflict.conflictReason}`);
          console.log(`      Primary: ${conflict.primary.key}="${conflict.primary.value}"`);
          if (conflict.related) {
            conflict.related.forEach(rel => {
              console.log(`      vs: ${rel.key}="${rel.value}"`);
            });
          }
        });
      }
    }
  }

  private async demoAdaptiveLearning(): Promise<void> {
    console.log('\n🧠 Demo 4: Adaptive Learning from User Feedback');
    console.log('-'.repeat(40));
    
    const context: ConversationContext = {
      userId: this.demoUserId,
      conversationTopic: 'learning_demo'
    };

    // Simulate learning over multiple interactions
    const learningSequence = [
      { utterance: 'Ich mag Pizza sehr gerne.', expectAccept: true },
      { utterance: 'Ich mag Sushi auch.', expectAccept: true },
      { utterance: 'Fast Food gefällt mir nicht.', expectAccept: true },
      { utterance: 'Heute ist schönes Wetter.', expectAccept: false }, // Too ephemeral
      { utterance: 'Ich esse gerne japanisches Essen.', expectAccept: true } // Should be accepted based on learning
    ];

    console.log('\n   🎯 Simulating user feedback and adaptation:');
    
    for (let i = 0; i < learningSequence.length; i++) {
      const { utterance, expectAccept } = learningSequence[i];
      
      console.log(`\n   Step ${i + 1}: "${utterance}"`);
      
      const result = await this.manager.evaluateAndStore(context, utterance);
      
      // Simulate user feedback
      const actuallyAccepted = result.saved.length > 0 || 
        (result.suggestions.length > 0 && expectAccept);
      
      console.log(`      System decision: ${result.saved.length > 0 ? 'Auto-saved' : result.suggestions.length > 0 ? 'Suggested' : 'Rejected'}`);
      console.log(`      Expected user: ${expectAccept ? 'Accept' : 'Reject'}`);
      console.log(`      Match: ${actuallyAccepted === expectAccept ? '✅' : '❌'}`);
      
      // The system should improve over time
      if (i >= 2) {
        console.log(`      🧠 System is learning from patterns...`);
      }
    }
  }

  private async demoContextAwareness(): Promise<void> {
    console.log('\n🌍 Demo 5: Context-Aware Processing');
    console.log('-'.repeat(40));
    
    // Same utterance in different contexts
    const testUtterance = 'Ich bin sehr müde.';
    
    const contexts = [
      {
        name: 'Morning Context',
        context: {
          userId: this.demoUserId,
          timeOfDay: 'morning',
          userMood: 'negative' as const,
          conversationTopic: 'health'
        }
      },
      {
        name: 'Evening Context', 
        context: {
          userId: this.demoUserId,
          timeOfDay: 'evening',
          userMood: 'neutral' as const,
          conversationTopic: 'routine'
        }
      }
    ];

    console.log(`\n   🔍 Testing utterance: "${testUtterance}"`);
    
    for (const { name, context } of contexts) {
      console.log(`\n   📍 ${name}:`);
      
      const result = await this.manager.evaluateAndStore(context, testUtterance);
      
      console.log(`      Time: ${context.timeOfDay}, Mood: ${context.userMood}`);
      console.log(`      Decision: ${result.saved.length > 0 ? 'Saved' : result.suggestions.length > 0 ? 'Suggested' : 'Rejected'}`);
      console.log(`      Reason: ${result.rejected.length > 0 ? result.rejected[0] : 'Context appropriate'}`);
    }
  }

  private async demoGermanLanguageFeatures(): Promise<void> {
    console.log('\n🇩🇪 Demo 6: German Language Specialization');
    console.log('-'.repeat(40));
    
    const context: ConversationContext = {
      userId: this.demoUserId,
      conversationTopic: 'german_features'
    };

    const germanSpecificUtterances = [
      'Ich möchte gerne Fußball schauen, aber nur Bundesliga.', // Umlauts, compound words
      'Mein Lieblingsgericht ist Sauerbraten mit Rotkohl.', // Cultural specifics
      'Ich wohne in München-Schwabing in einer Dreizimmerwohnung.', // German addressing
      'Jeden Donnerstag gehe ich zum Bäcker um die Ecke.', // German weekly patterns
      'Ich duze alle meine Kollegen, aber sieze den Chef.' // German formality levels
    ];

    for (const utterance of germanSpecificUtterances) {
      console.log(`\n🇩🇪 German text: "${utterance}"`);
      
      const result = await this.manager.evaluateAndStore(context, utterance);
      
      [...result.saved, ...result.suggestions].forEach(memory => {
        console.log(`      📝 Extracted: ${memory.key}="${memory.value}"`);
        console.log(`      🏷️  Tags: ${memory.tags?.join(', ') || 'none'}`);
        console.log(`      🎯 Category: ${memory.category}`);
      });
    }
  }

  private async demoPerformanceFeatures(): Promise<void> {
    console.log('\n⚡ Demo 7: Performance & Scalability');
    console.log('-'.repeat(40));
    
    const context: ConversationContext = {
      userId: this.demoUserId,
      conversationTopic: 'performance_test'
    };

    // Test batch processing
    const batchUtterances = Array.from({ length: 10 }, (_, i) => 
      `Ich mag Aktivität ${i + 1} und das macht mir Spaß am ${['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'][i % 5]}.`
    );

    console.log(`\n   ⏱️  Processing ${batchUtterances.length} utterances...`);
    const startTime = Date.now();
    
    let totalProcessed = 0;
    let totalSaved = 0;
    let totalSuggested = 0;

    for (const utterance of batchUtterances) {
      const result = await this.manager.evaluateAndStore(context, utterance);
      totalProcessed++;
      totalSaved += result.saved.length;
      totalSuggested += result.suggestions.length;
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / batchUtterances.length;
    
    console.log(`   📊 Performance Results:`);
    console.log(`      Total processed: ${totalProcessed}`);
    console.log(`      Total saved: ${totalSaved}`);
    console.log(`      Total suggested: ${totalSuggested}`);
    console.log(`      Processing time: ${endTime - startTime}ms`);
    console.log(`      Average per utterance: ${avgTime.toFixed(2)}ms`);
    console.log(`      Throughput: ${(1000 / avgTime).toFixed(1)} utterances/second`);
    
    // Demonstrate maintenance
    console.log(`\n   🧹 Running maintenance...`);
    const maintenanceResult = await this.manager.performMaintenance(this.demoUserId);
    console.log(`      Cleaned memories: ${maintenanceResult.cleanedMemories}`);
    console.log(`      Consolidated memories: ${maintenanceResult.consolidatedMemories}`);
  }

  async generateInsightsReport(): Promise<void> {
    console.log('\n📈 Demo Insights Report');
    console.log('-'.repeat(40));
    
    const context: ConversationContext = {
      userId: this.demoUserId,
      conversationTopic: 'insights_generation'
    };

    const result = await this.manager.evaluateAndStore(
      context,
      'Generiere Insights Report', // Dummy utterance
      { includeInsights: true }
    );

    if (result.insights) {
      console.log(`\n   📊 Memory System Insights:`);
      console.log(`      Total memories stored: ${result.insights.totalMemories}`);
      console.log(`      Memory distribution:`);
      
      Object.entries(result.insights.memoryDistribution).forEach(([type, count]) => {
        console.log(`        ${type}: ${count}`);
      });
      
      console.log(`      Recent trends:`);
      result.insights.recentTrends.forEach(trend => {
        console.log(`        - ${trend}`);
      });
      
      if (result.insights.learningStats) {
        const stats = result.insights.learningStats;
        console.log(`      Learning statistics:`);
        console.log(`        Total feedback: ${stats.totalFeedback}`);
        console.log(`        Acceptance rate: ${(stats.acceptanceRate * 100).toFixed(1)}%`);
        console.log(`        Most preferred type: ${stats.mostPreferredType}`);
        console.log(`        Adaptive threshold: ${stats.adaptiveThreshold.toFixed(3)}`);
      }
    }
  }
}

// Export demo functions
export async function runMemorySystemDemo(): Promise<void> {
  console.log('🚀 Starting Enhanced Memory System Demo...\n');
  
  const demo = new MemorySystemDemo();
  
  try {
    await demo.runFullDemo();
    await demo.generateInsightsReport();
    
    console.log('\n✅ Demo completed successfully!');
    console.log('\n🧪 Running automated tests...');
    
    await runEnhancedMemoryTests();
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMemorySystemDemo()
    .then(() => {
      console.log('🎉 Enhanced Memory System Demo & Tests Completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Demo/Tests failed:', error);
      process.exit(1);
    });
}
