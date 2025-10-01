/**
 * Aufgabe: einfache "Confusion-Matrix" als Paare (expectedId -> predictedId, count),
 * um häufige Verwechslungen zu erkennen.
 * Export und print als Tabelle.
 */

import { readFileSync, existsSync } from 'fs';

interface ConfusionEntry {
  expected: string;
  predicted: string;
  count: number;
}

interface EvalResult {
  question: string;
  expected_answer_id: string;
  predicted_answer_id: string;
  correct: boolean;
  confidence?: number;
  note?: string;
}

export class ConfusionMatrix {
  private matrix = new Map<string, Map<string, number>>();

  addPrediction(expected: string, predicted: string): void {
    if (!this.matrix.has(expected)) {
      this.matrix.set(expected, new Map());
    }
    
    const expectedMap = this.matrix.get(expected)!;
    const currentCount = expectedMap.get(predicted) || 0;
    expectedMap.set(predicted, currentCount + 1);
  }

  getConfusionPairs(): ConfusionEntry[] {
    const pairs: ConfusionEntry[] = [];
    
    for (const [expected, predictedMap] of this.matrix) {
      for (const [predicted, count] of predictedMap) {
        pairs.push({ expected, predicted, count });
      }
    }

    // Sort by count descending, then by expected/predicted for consistency
    pairs.sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      if (a.expected !== b.expected) {
        return a.expected.localeCompare(b.expected);
      }
      return a.predicted.localeCompare(b.predicted);
    });

    return pairs;
  }

  getMostConfusedPairs(limit: number = 10): ConfusionEntry[] {
    return this.getConfusionPairs()
      .filter(pair => pair.expected !== pair.predicted) // Only wrong predictions
      .slice(0, limit);
  }

  printTable(maxRows: number = 20): void {
    const pairs = this.getConfusionPairs();
    
    if (pairs.length === 0) {
      console.log('📊 No confusion data available');
      return;
    }

    console.log('\n📊 Confusion Matrix (Top Confusions):\n');

    // Calculate column widths
    const maxExpected = Math.max(8, ...pairs.map(p => p.expected.length));
    const maxPredicted = Math.max(9, ...pairs.map(p => p.predicted.length));
    const maxCount = Math.max(5, ...pairs.map(p => p.count.toString().length));

    // Header
    const header = `${'Expected'.padEnd(maxExpected)} | ${'Predicted'.padEnd(maxPredicted)} | ${'Count'.padStart(maxCount)} | Status`;
    console.log(header);
    console.log('-'.repeat(header.length));

    // Rows
    const displayPairs = pairs.slice(0, maxRows);
    displayPairs.forEach(pair => {
      const status = pair.expected === pair.predicted ? '✅' : '❌';
      const expected = pair.expected.padEnd(maxExpected);
      const predicted = pair.predicted.padEnd(maxPredicted);
      const count = pair.count.toString().padStart(maxCount);
      
      console.log(`${expected} | ${predicted} | ${count} | ${status}`);
    });

    if (pairs.length > maxRows) {
      console.log(`\n... and ${pairs.length - maxRows} more entries`);
    }

    // Summary statistics
    const totalPredictions = pairs.reduce((sum, pair) => sum + pair.count, 0);
    const correctPredictions = pairs
      .filter(pair => pair.expected === pair.predicted)
      .reduce((sum, pair) => sum + pair.count, 0);
    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions * 100).toFixed(1) : '0.0';

    console.log(`\n📈 Summary:`);
    console.log(`   Total predictions: ${totalPredictions}`);
    console.log(`   Correct predictions: ${correctPredictions}`);
    console.log(`   Accuracy: ${accuracy}%`);

    // Top confusions
    const topConfusions = this.getMostConfusedPairs(5);
    if (topConfusions.length > 0) {
      console.log(`\n🔀 Top Confusions:`);
      topConfusions.forEach((pair, index) => {
        console.log(`   ${index + 1}. ${pair.expected} → ${pair.predicted} (${pair.count}x)`);
      });
    }
  }

  exportToCsv(): string {
    const pairs = this.getConfusionPairs();
    const lines = ['expected,predicted,count,correct'];
    
    pairs.forEach(pair => {
      const correct = pair.expected === pair.predicted ? 'true' : 'false';
      lines.push(`${pair.expected},${pair.predicted},${pair.count},${correct}`);
    });

    return lines.join('\n');
  }

  static fromEvalResults(evalResults: EvalResult[]): ConfusionMatrix {
    const matrix = new ConfusionMatrix();
    
    evalResults.forEach(result => {
      matrix.addPrediction(result.expected_answer_id, result.predicted_answer_id);
    });

    return matrix;
  }

  static fromCsvFile(filePath: string): ConfusionMatrix {
    if (!existsSync(filePath)) {
      throw new Error(`Evaluation results file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length === 0) {
      throw new Error('Empty evaluation results file');
    }

    // Parse header
    const header = lines[0].trim().split(',');
    const expectedIndex = header.indexOf('expected_answer_id');
    const predictedIndex = header.indexOf('predicted_answer_id');

    if (expectedIndex === -1 || predictedIndex === -1) {
      throw new Error('Invalid evaluation results format: missing expected_answer_id or predicted_answer_id columns');
    }

    const matrix = new ConfusionMatrix();

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;

      const parts = line.split(',').map(part => part.trim().replace(/^"(.*)"$/, '$1'));
      
      if (parts.length <= Math.max(expectedIndex, predictedIndex)) {
        continue; // Skip invalid rows
      }

      const expected = parts[expectedIndex];
      const predicted = parts[predictedIndex];

      if (expected && predicted) {
        matrix.addPrediction(expected, predicted);
      }
    }

    return matrix;
  }
}

// CLI interface
export function analyzeConfusion(resultsPath?: string): void {
  const defaultPath = 'eval/results.csv';
  const filePath = resultsPath || defaultPath;

  console.log('🔍 Analyzing confusion matrix...\n');

  try {
    const matrix = ConfusionMatrix.fromCsvFile(filePath);
    matrix.printTable();
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const resultsPath = process.argv[2];
  analyzeConfusion(resultsPath);
}
