/**
 * Lexicon schema documents for the record types `pinakes compile` emits.
 *
 * These are ordinary AT Protocol Lexicon JSON documents, generated per-project
 * because the NSID authority comes from `pinakes.yaml` (`project.nsid`) — one
 * universe publishes `site.supperclub.scene`, another publishes
 * `com.example.scene`. They are the portable contract for a universe's records:
 * committed alongside the compiled output, installable by any consumer with
 * `lex install`, and — via `compile.ts` — the thing every record is validated
 * against before it is written.
 */
export interface LexiconDoc {
    lexicon: 1;
    id: string;
    description?: string;
    defs: Record<string, LexDef>;
}
export type LexDef = {
    type: 'record';
    key: string;
    description?: string;
    record: LexObject;
} | LexObject;
export interface LexObject {
    type: 'object';
    description?: string;
    required?: string[];
    nullable?: string[];
    properties: Record<string, LexProp>;
}
export type LexProp = {
    type: 'string';
    description?: string;
    format?: string;
    maxLength?: number;
    knownValues?: string[];
} | {
    type: 'integer';
    description?: string;
    minimum?: number;
    maximum?: number;
} | {
    type: 'boolean';
    description?: string;
} | {
    type: 'array';
    description?: string;
    items: LexProp;
    minLength?: number;
    maxLength?: number;
} | {
    type: 'ref';
    description?: string;
    ref: string;
} | {
    type: 'unknown';
    description?: string;
};
export declare function buildLexiconDocs(nsid: string): LexiconDoc[];
