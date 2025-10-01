/**
 * Aufgabe: CSV-Zeilen validieren (question:string, answer_id:string, notes?:string).
 * Exportiere parseEvalRow(rec) -> {question, answer_id, notes}.
 * Prüfe, dass question min. 3 Zeichen lang ist; answer_id entweder "__NONE__" oder slug.
 */

import { z } from 'zod';

// Schema for evaluation CSV row
export const EvalRowSchema = z.object({
  question: z.string()
    .min(3, 'Question must be at least 3 characters long')
    .trim(),
  answer_id: z.string()
    .refine(
      (value) => value === '__NONE__' || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
      'Answer ID must be "__NONE__" or a valid slug (lowercase, numbers, hyphens only)'
    ),
  notes: z.string().optional().default(''),
});

export type EvalRow = z.infer<typeof EvalRowSchema>;

// Raw CSV record interface (before validation)
export interface RawEvalRecord {
  question?: string;
  answer_id?: string;
  notes?: string;
  [key: string]: any; // Allow additional fields from CSV parsing
}

/**
 * Parse and validate a single evaluation CSV row
 * @param rec Raw CSV record object
 * @returns Validated evaluation row
 * @throws Error if validation fails
 */
export function parseEvalRow(rec: RawEvalRecord): EvalRow {
  try {
    // Clean up the record - remove quotes and trim whitespace
    const cleanRecord = {
      question: rec.question?.replace(/^"(.*)"$/, '$1').trim() || '',
      answer_id: rec.answer_id?.replace(/^"(.*)"$/, '$1').trim() || '',
      notes: rec.notes?.replace(/^"(.*)"$/, '$1').trim() || '',
    };

    // Validate against schema
    return EvalRowSchema.parse(cleanRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      throw new Error(`Validation failed for eval row: ${issues}`);
    }
    throw new Error(`Failed to parse eval row: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate multiple evaluation rows
 * @param records Array of raw CSV records
 * @returns Array of validated evaluation rows
 */
export function parseEvalRows(records: RawEvalRecord[]): EvalRow[] {
  const results: EvalRow[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    try {
      const parsed = parseEvalRow(record);
      results.push(parsed);
    } catch (error) {
      errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Validation failed for ${errors.length} rows:\n${errors.join('\n')}`);
  }

  return results;
}

/**
 * Check if an answer_id represents a "no match" case
 * @param answerId The answer ID to check
 * @returns True if this represents no expected match
 */
export function isNoneCase(answerId: string): boolean {
  return answerId === '__NONE__';
}

/**
 * Get evaluation statistics from parsed rows
 * @param rows Array of validated evaluation rows
 * @returns Statistics object
 */
export function getEvalStats(rows: EvalRow[]) {
  const totalRows = rows.length;
  const noneRows = rows.filter(row => isNoneCase(row.answer_id)).length;
  const expectMatchRows = totalRows - noneRows;
  
  // Group by notes for category analysis
  const categories = rows.reduce((acc, row) => {
    const category = row.notes || 'uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: totalRows,
    expectMatch: expectMatchRows,
    expectNone: noneRows,
    categories,
    coverage: expectMatchRows > 0 ? (expectMatchRows / totalRows * 100).toFixed(1) + '%' : '0%'
  };
}
