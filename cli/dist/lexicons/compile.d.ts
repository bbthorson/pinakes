import type { LexiconDoc } from './docs.js';
export interface CompiledSchema {
    /** Fully-qualified NSID, e.g. `site.supperclub.scene`. */
    nsid: string;
    /** Validates one record, `$type` included. */
    safeParse(value: unknown): {
        success: boolean;
        reason?: {
            message: string;
        };
    };
}
/** Compiles every record def in `docs`, keyed by NSID. */
export declare function compileLexiconDocs(docs: LexiconDoc[]): Map<string, CompiledSchema>;
