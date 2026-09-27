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
export declare function writeLexiconDocs(outputDir: string, docs: LexiconDoc[]): string[];
/**
 * Validates records against the compiled schema for their `$type`.
 *
 * `relativeFile` is the record file being written, so a failure points at the
 * output the author can actually look at. Records identify themselves by `id`
 * where they have one, since compiled records have no line numbers.
 */
export declare function validateRecords(records: unknown[], schemas: Map<string, CompiledSchema>, relativeFile: string): Diagnostic[];
