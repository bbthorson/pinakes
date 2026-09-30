import { type Config } from './config.js';
import { Registry, type RegistryConflict, type RegistryInvalidEntry } from './registry/entities.js';
import { LinterEngine, type Diagnostic, type ChapterData } from './linter/engine.js';
import { type CompilationReport, type CompilationResult } from './compiler/atproto.js';
import { type ContextBundle, type CodexSection } from './context/bundle.js';
import { type ProseReport } from './prose/check.js';
export type { Config, Diagnostic, ChapterData, CompilationReport, CompilationResult, ContextBundle, CodexSection, ProseReport, RegistryConflict, RegistryInvalidEntry, };
export * from './keystatic/index.js';
export { BUILTIN_BASINS, CORE_AFFECT_LABELS, buildAffectVocabulary, classifyAttractorBasin, formatAffectPromptInjection, getBehavioralDirectives, normalizeAffectLabel, parseAffectDeclaration, resolveAffectLabel, type AffectDeclaration, type AffectLabelConfig, type BasinBounds, type BasinConfig, type BuiltinBasin, type ScaledVad, type VadVector, } from './compiler/affect.js';
/**
 * A loaded universe. Open one when making several calls against the same
 * root, so the config and registry are read once; every function also
 * accepts a root path and opens it itself.
 */
export interface Universe {
    /** Absolute path to the universe root. */
    root: string;
    config: Config;
    registry: Registry;
    engine: LinterEngine;
}
type UniverseInput = string | Universe;
/** Reads `pinakes.yaml` and the registry. Throws if the config is missing or invalid. */
export declare function openUniverse(root: string): Universe;
export interface LintResult {
    diagnostics: Diagnostic[];
    /** `false` when any diagnostic is an error: the verdict `pinakes lint` exits 1 on. */
    ok: boolean;
}
/** Runs every continuity check `pinakes lint` runs. Never writes or deletes anything. */
export declare function lint(input: UniverseInput): LintResult;
export interface CompileOptions {
    /**
     * Write records and Lexicon documents to `paths.output`, and remove stale
     * files there. Defaults to `false`, unlike the CLI: a library caller asking
     * for records should not find its output directory pruned as a side effect.
     */
    write?: boolean;
}
export interface CompileResult extends CompilationReport {
    /** `false` when any record failed resolution, Lexicon validation or id checks. */
    ok: boolean;
}
/**
 * Builds and validates every record. `records` holds them all in memory;
 * `stretchFindings` and `affectFindings` are continuity findings, reported by
 * `lint` rather than counted against `ok`.
 */
export declare function compile(input: UniverseInput, options?: CompileOptions): CompileResult;
export interface ContextOptions {
    /** Include state-event annotations, which are authored omnisciently. */
    fullState?: boolean;
}
export interface ContextResult {
    /** Absent when `errors` is non-empty. */
    bundle?: ContextBundle;
    errors: string[];
}
/**
 * What `character` (a registry name or id) can see on `asOf` (YYYY-MM-DD).
 * An unresolvable character or a malformed date is returned in `errors`, not
 * thrown. Never writes anything.
 */
export declare function context(input: UniverseInput, character: string, asOf: string, options?: ContextOptions): ContextResult;
/** Renders a context bundle as the Markdown `pinakes context` prints. */
export declare const renderContextMarkdown: (bundle: ContextBundle) => string;
export interface ProseCheckOptions {
    /** Limit to story directories whose name contains this (case-insensitive). */
    story?: string;
    report?: ProseReport | 'all';
}
/**
 * The `prose-check` reports as Markdown, keyed by name. There is no verdict:
 * these are inputs to a judgment pass. Throws when there is nothing to check,
 * so a mistyped `story` cannot come back as an empty, clean-looking report.
 */
export declare function proseCheck(input: UniverseInput, options?: ProseCheckOptions): Partial<Record<ProseReport, string>>;
