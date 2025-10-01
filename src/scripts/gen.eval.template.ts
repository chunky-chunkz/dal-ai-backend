/**
 * Aufgabe: Erzeuge aus faqs.json ein eval-Template:
 * - Nimm question_variants als Start und schreibe eval/eval.template.csv
 * - Ergänze leere note-Spalte
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags?: string[];
  last_reviewed?: string;
  question_variants?: string[];
}

interface EvalTemplateEntry {
  question: string;
  expected_answer_id: string;
  note: string;
}

export class EvalTemplateGenerator {
  generateTemplate(faqsPath: string, outputPath: string): void {
    console.log('📝 Generating evaluation template...\n');

    // Read FAQs
    if (!existsSync(faqsPath)) {
      console.error(`❌ Error: FAQs file not found: ${faqsPath}`);
      process.exit(1);
    }

    let faqs: FAQ[];
    try {
      const content = readFileSync(faqsPath, 'utf-8');
      faqs = JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error reading FAQs: ${error}`);
      process.exit(1);
    }

    // Generate template entries
    const entries: EvalTemplateEntry[] = [];

    faqs.forEach(faq => {
      // Add main question
      entries.push({
        question: faq.question,
        expected_answer_id: faq.id,
        note: ''
      });

      // Add question variants
      if (faq.question_variants && faq.question_variants.length > 0) {
        faq.question_variants.forEach(variant => {
          entries.push({
            question: variant,
            expected_answer_id: faq.id,
            note: ''
          });
        });
      }
    });

    // Create output directory if it doesn't exist
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Generate CSV content
    const csvLines = ['question,expected_answer_id,note'];
    
    entries.forEach(entry => {
      // Escape CSV fields if they contain commas or quotes
      const escapeCsvField = (field: string): string => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      csvLines.push([
        escapeCsvField(entry.question),
        escapeCsvField(entry.expected_answer_id),
        escapeCsvField(entry.note)
      ].join(','));
    });

    // Write to file
    try {
      writeFileSync(outputPath, csvLines.join('\n') + '\n', 'utf-8');
      console.log(`✅ Generated evaluation template: ${outputPath}`);
      console.log(`   ${entries.length} questions from ${faqs.length} FAQs`);
      
      // Show breakdown
      const mainQuestions = faqs.length;
      const variants = entries.length - faqs.length;
      console.log(`   └─ ${mainQuestions} main questions + ${variants} variants`);

    } catch (error) {
      console.error(`❌ Error writing template: ${error}`);
      process.exit(1);
    }
  }
}

// CLI interface
export function generateEvalTemplate(): void {
  const faqsPath = join(process.cwd(), 'src/data/faqs.json');
  const outputPath = join(process.cwd(), 'eval/eval.template.csv');

  const generator = new EvalTemplateGenerator();
  generator.generateTemplate(faqsPath, outputPath);
}

// Run if called directly
if (require.main === module) {
  generateEvalTemplate();
}
