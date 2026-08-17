/**
 * Compiles Lexicon documents into runtime validators from `@atproto/lex`.
 *
 * The official path from a Lexicon document to a validator is codegen —
 * `lex build` emits TypeScript that calls the `@atproto/lex-schema`
 * combinators. That doesn't fit pinakes: the NSID authority is chosen by each
 * universe in `pinakes.yaml`, so there is nothing fixed to generate code from
 * when the CLI is published to npm. Instead we walk the documents at runtime
 * and build the same combinators codegen would have emitted.
 *
 * This covers the subset of Lexicon that `docs.ts` uses (object, string,
 * integer, boolean, array, and local refs). It is deliberately not a general
 * Lexicon implementation — anything outside that subset throws rather than
 * silently validating nothing, so a schema can never quietly stop enforcing.
 */
import { l } from '@atproto/lex';
import type { LexDef, LexObject, LexProp, LexiconDoc } from './docs.js';

export interface CompiledSchema {
  /** Fully-qualified NSID, e.g. `site.supperclub.scene`. */
  nsid: string;
  /** Validates one record, `$type` included. */
  safeParse(value: unknown): { success: boolean; reason?: { message: string } };
}

class UnsupportedLexicon extends Error {
  constructor(docId: string, detail: string) {
    super(`Unsupported Lexicon construct in '${docId}': ${detail}`);
    this.name = 'UnsupportedLexicon';
  }
}

/** Compiles every record def in `docs`, keyed by NSID. */
export function compileLexiconDocs(docs: LexiconDoc[]): Map<string, CompiledSchema> {
  const compiled = new Map<string, CompiledSchema>();
  for (const doc of docs) {
    const main = doc.defs.main;
    if (!main || main.type !== 'record') {
      throw new UnsupportedLexicon(doc.id, "expected a 'record' def named 'main'");
    }
    const shape = buildObject(doc, main.record);
    const schema = l.record(main.key as 'any', doc.id as `${string}.${string}.${string}`, shape as never);
    compiled.set(doc.id, { nsid: doc.id, safeParse: (v) => schema.safeParse(v) });
  }
  return compiled;
}

function buildObject(doc: LexiconDoc, def: LexObject): ReturnType<typeof l.object> {
  const required = new Set(def.required ?? []);
  const shape: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries(def.properties)) {
    const validator = buildProp(doc, prop);
    // Lexicon has no null: a property is either present and valid, or absent.
    shape[name] = required.has(name) ? validator : l.optional(validator as never);
  }
  return l.object(shape as never);
}

function buildProp(doc: LexiconDoc, prop: LexProp): unknown {
  switch (prop.type) {
    case 'string': {
      const opts: Record<string, unknown> = {};
      if (prop.format) opts.format = prop.format;
      if (prop.maxLength !== undefined) opts.maxLength = prop.maxLength;
      if (prop.knownValues) opts.knownValues = prop.knownValues;
      return l.string(opts as never);
    }
    case 'integer': {
      const opts: Record<string, unknown> = {};
      if (prop.minimum !== undefined) opts.minimum = prop.minimum;
      if (prop.maximum !== undefined) opts.maximum = prop.maximum;
      return l.integer(opts as never);
    }
    case 'boolean':
      return l.boolean();
    case 'array': {
      const opts: Record<string, unknown> = {};
      if (prop.minLength !== undefined) opts.minLength = prop.minLength;
      if (prop.maxLength !== undefined) opts.maxLength = prop.maxLength;
      return l.array(buildProp(doc, prop.items) as never, opts as never);
    }
    case 'ref': {
      if (!prop.ref.startsWith('#')) {
        throw new UnsupportedLexicon(doc.id, `cross-document ref '${prop.ref}'`);
      }
      const target: LexDef | undefined = doc.defs[prop.ref.slice(1)];
      if (!target || target.type !== 'object') {
        throw new UnsupportedLexicon(doc.id, `ref '${prop.ref}' does not name an object def`);
      }
      return buildObject(doc, target);
    }
    case 'unknown':
      return l.unknown();
    default:
      throw new UnsupportedLexicon(doc.id, `property type '${(prop as { type: string }).type}'`);
  }
}
