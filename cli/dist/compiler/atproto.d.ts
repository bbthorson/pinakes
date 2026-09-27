import { Config } from '../config.js';
import { Registry } from '../registry/entities.js';
import { Diagnostic, LinterEngine } from '../linter/engine.js';
export interface CompilationResult {
    file: string;
    count: number;
}
export interface CompilationReport {
    results: CompilationResult[];
    /** Lexicon documents written alongside the records. */
    lexiconFiles: string[];
    /** Records that failed validation against the universe's own Lexicons. */
    diagnostics: Diagnostic[];
    /**
     * Continuity findings for stretches. Computed here because they need every
     * other compiled record's dates; reported by `lint`, not `compile` (see
     * `linter/stretches.ts`).
     */
    stretchFindings: Diagnostic[];
    /** Every compiled record, across types, for consumers such as `context`. */
    records: any[];
    /**
     * Stale record and Lexicon files this compile deleted, relative to the
     * project root. `null` when pruning was skipped because the output
     * directory is not a directory of its own (see `prune.ts`).
     */
    removed: string[] | null;
}
export interface CompileOptions {
    /**
     * `false` builds and validates every record without touching disk, which is
     * how `lint` gets the compiled record set it needs for the stretch rules.
     */
    write?: boolean;
}
export declare function compileProject(projectRoot: string, config: Config, registry: Registry, engine: LinterEngine, options?: CompileOptions): CompilationReport;
