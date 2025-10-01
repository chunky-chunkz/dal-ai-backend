/**
 * Aufgabe: Linter für faqs.json und eval.csv:
 * - Prüfe doppelte IDs, leere Felder, ungültige Dates (last_reviewed),
 *   zu lange answers (> 1000 chars), zu kurze question_variants,
 *   Waisen im eval.csv (answer_id nicht in faqs.json), und "__NONE__"-Zeilen ok.
 * - Ausgabe: Liste von Warnungen/Fehlern + exit code 1 bei harten Fehlern.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface LintIssue {
  type: 'ERROR' | 'WARNING';
  file: string;
  line?: number;
  message: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags?: string[];
  last_reviewed?: string;
  question_variants?: string[];
}



export class DatasetLinter {
  private issues: LintIssue[] = [];

  addIssue(type: 'ERROR' | 'WARNING', file: string, message: string, line?: number) {
    this.issues.push({ type, file, message, line });
  }

  lintFaqsJson(filePath: string): void {
    if (!existsSync(filePath)) {
      this.addIssue('ERROR', filePath, 'File does not exist');
      return;
    }

    let faqs: FAQ[];
    try {
      const content = readFileSync(filePath, 'utf-8');
      faqs = JSON.parse(content);
    } catch (error) {
      this.addIssue('ERROR', filePath, `Invalid JSON: ${error}`);
      return;
    }

    if (!Array.isArray(faqs)) {
      this.addIssue('ERROR', filePath, 'Root element must be an array');
      return;
    }

    const seenIds = new Set<string>();

    faqs.forEach((faq, index) => {
      const lineNumber = index + 1; // Approximate line number

      // Prüfe doppelte IDs
      if (seenIds.has(faq.id)) {
        this.addIssue('ERROR', filePath, `Duplicate ID: ${faq.id}`, lineNumber);
      } else {
        seenIds.add(faq.id);
      }

      // Prüfe leere Felder
      if (!faq.id || faq.id.trim() === '') {
        this.addIssue('ERROR', filePath, 'Empty or missing ID', lineNumber);
      }

      if (!faq.question || faq.question.trim() === '') {
        this.addIssue('ERROR', filePath, `Empty or missing question for ID: ${faq.id}`, lineNumber);
      }

      if (!faq.answer || faq.answer.trim() === '') {
        this.addIssue('ERROR', filePath, `Empty or missing answer for ID: ${faq.id}`, lineNumber);
      }

      if (!faq.category || faq.category.trim() === '') {
        this.addIssue('WARNING', filePath, `Empty or missing category for ID: ${faq.id}`, lineNumber);
      }

      // Prüfe zu lange answers (> 1000 chars)
      if (faq.answer && faq.answer.length > 1000) {
        this.addIssue('WARNING', filePath, `Answer too long (${faq.answer.length} chars) for ID: ${faq.id}`, lineNumber);
      }

      // Prüfe zu kurze question_variants
      if (faq.question_variants && faq.question_variants.length < 2) {
        this.addIssue('WARNING', filePath, `Too few question variants (${faq.question_variants.length}) for ID: ${faq.id}`, lineNumber);
      }

      // Prüfe ungültige Dates (last_reviewed)
      if (faq.last_reviewed) {
        const date = new Date(faq.last_reviewed);
        if (isNaN(date.getTime())) {
          this.addIssue('ERROR', filePath, `Invalid last_reviewed date for ID: ${faq.id}`, lineNumber);
        }
      }
    });
  }

  lintEvalCsv(filePath: string, faqsPath: string): void {
    if (!existsSync(filePath)) {
      this.addIssue('WARNING', filePath, 'File does not exist (optional)');
      return;
    }

    // Load valid FAQ IDs
    const validIds = new Set<string>();
    if (existsSync(faqsPath)) {
      try {
        const faqsContent = readFileSync(faqsPath, 'utf-8');
        const faqs: FAQ[] = JSON.parse(faqsContent);
        faqs.forEach(faq => validIds.add(faq.id));
      } catch (error) {
        this.addIssue('WARNING', filePath, 'Cannot validate answer_id references (faqs.json invalid)');
      }
    }

    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.addIssue('ERROR', filePath, `Cannot read file: ${error}`);
      return;
    }

    const lines = content.split('\n');
    if (lines.length === 0) {
      this.addIssue('ERROR', filePath, 'Empty file');
      return;
    }

    // Check header
    const header = lines[0].trim();
    const expectedHeader = 'question,expected_answer_id,note';
    if (header !== expectedHeader) {
      this.addIssue('ERROR', filePath, `Invalid header. Expected: ${expectedHeader}, Got: ${header}`, 1);
    }

    // Parse CSV entries
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue; // Skip empty lines

      const lineNumber = i + 1;
      const parts = line.split(',').map(part => part.trim().replace(/^"(.*)"$/, '$1'));

      if (parts.length < 2) {
        this.addIssue('ERROR', filePath, 'Insufficient columns', lineNumber);
        continue;
      }

      const [question, expectedAnswerId] = parts;

      // Prüfe leere Felder
      if (!question || question === '') {
        this.addIssue('ERROR', filePath, 'Empty question', lineNumber);
      }

      if (!expectedAnswerId || expectedAnswerId === '') {
        this.addIssue('ERROR', filePath, 'Empty expected_answer_id', lineNumber);
        continue;
      }

      // "__NONE__"-Zeilen sind ok
      if (expectedAnswerId === '__NONE__') {
        continue;
      }

      // Prüfe Waisen (answer_id nicht in faqs.json)
      if (validIds.size > 0 && !validIds.has(expectedAnswerId)) {
        this.addIssue('ERROR', filePath, `Orphaned answer_id: ${expectedAnswerId} not found in faqs.json`, lineNumber);
      }
    }
  }

  printResults(): void {
    if (this.issues.length === 0) {
      console.log('✅ No issues found');
      return;
    }

    console.log('\n📋 Dataset Lint Results:\n');

    const errors = this.issues.filter(issue => issue.type === 'ERROR');
    const warnings = this.issues.filter(issue => issue.type === 'WARNING');

    if (errors.length > 0) {
      console.log(`❌ ${errors.length} ERROR(S):`);
      errors.forEach(issue => {
        const location = issue.line ? `:${issue.line}` : '';
        console.log(`   ${issue.file}${location} - ${issue.message}`);
      });
      console.log();
    }

    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} WARNING(S):`);
      warnings.forEach(issue => {
        const location = issue.line ? `:${issue.line}` : '';
        console.log(`   ${issue.file}${location} - ${issue.message}`);
      });
      console.log();
    }

    console.log(`Summary: ${errors.length} errors, ${warnings.length} warnings`);
  }

  hasErrors(): boolean {
    return this.issues.some(issue => issue.type === 'ERROR');
  }
}

// CLI interface
export function runLinter(): void {
  const linter = new DatasetLinter();
  
  const faqsPath = join(process.cwd(), 'src/data/faqs.json');
  const evalPath = join(process.cwd(), 'eval/eval.csv');

  console.log('🔍 Linting dataset files...\n');

  linter.lintFaqsJson(faqsPath);
  linter.lintEvalCsv(evalPath, faqsPath);

  linter.printResults();

  if (linter.hasErrors()) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runLinter();
}
