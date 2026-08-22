/**
 * Schema enforcement for compiled records.
 *
 * `pinakes compile` used to stamp a `$type` onto plain objects and call the
 * result AT Protocol-compliant. Nothing checked that claim, so drift — a
 * renamed field, a date where a datetime belongs — reached consumers silently.
 * Every compiled record now goes through the universe's own Lexicon documents
 * before it is written.
 */
import fs from 'fs';
import path from 'path';
import { Diagnostic } from '../linter/engine.js';
import { buildLexiconDocs, type LexiconDoc } from './docs.js';
import { compileLexiconDocs, type CompiledSchema } from './compile.js';

export { buildLexiconDocs, compileLexiconDocs };
export type { LexiconDoc, CompiledSchema };

/**
 * Writes the universe's Lexicon documents next to its records, one JSON file
 * per NSID. These are meant to be committed: they are what a consumer needs to
 * read the records without reading pinakes.
 */
export function writeLexiconDocs(outputDir: string, docs: LexiconDoc[]): string[] {
  const dir = path.join(outputDir, 'lexicons');
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const doc of docs) {
    const file = path.join(dir, `${doc.id}.json`);
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
    written.push(file);
  }
  return written;
}

/**
 * Validates records against the compiled schema for their `$type`.
 *
 * `relativeFile` is the record file being written, so a failure points at the
 * output the author can actually look at. Records identify themselves by `id`
 * where they have one, since compiled records have no line numbers.
 */
export function validateRecords(
  records: unknown[],
  schemas: Map<string, CompiledSchema>,
  relativeFile: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const record of records) {
    const rec = record as Record<string, unknown>;
    const type = typeof rec?.$type === 'string' ? rec.$type : null;
    const label = typeof rec?.id === 'string' ? rec.id : '<unidentified record>';

    if (!type) {
      diagnostics.push({
        file: relativeFile,
        rule: 'lexicon-validation',
        severity: 'error',
        message: `Record '${label}' has no $type.`,
      });
      continue;
    }

    const schema = schemas.get(type);
    if (!schema) {
      diagnostics.push({
        file: relativeFile,
        rule: 'lexicon-validation',
        severity: 'error',
        message: `Record '${label}' declares $type '${type}', which has no Lexicon document.`,
      });
      continue;
    }

    const result = schema.safeParse(record);
    if (!result.success) {
      diagnostics.push({
        file: relativeFile,
        rule: 'lexicon-validation',
        severity: 'error',
        message: `${label}: ${result.reason?.message ?? 'failed Lexicon validation'}`,
      });
    }
  }

  return diagnostics;
}
