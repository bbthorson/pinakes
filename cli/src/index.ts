/**
 * The programmatic API: what `lint`, `compile`, `context` and `prose-check`
 * do, as functions that return their findings instead of printing them and
 * exiting. The CLI is built on these, so the two cannot disagree about a
 * verdict.
 *
 * Everything exported here is a compatibility promise. Internals stay
 * unexported so they can change without a major version.
 */
import path from 'path';
import { loadConfig, type Config } from './config.js';
import { Registry, type RegistryConflict, type RegistryInvalidEntry } from './registry/entities.js';
import { LinterEngine, type Diagnostic, type ChapterData } from './linter/engine.js';
import { YamlRulesLoader } from './linter/yaml-loader.js';
import { compileProject, type CompilationReport, type CompilationResult } from './compiler/atproto.js';
import { buildContext, renderMarkdown, type ContextBundle, type CodexSection } from './context/bundle.js';
import { buildProseReports, type ProseReport } from './prose/check.js';
import { computeAffectState, type AffectState, type AffectTraitProblem } from './compiler/affect-dynamics.js';
import { isCalendarDate } from './linter/stretches.js';

export type {
  Config,
  Diagnostic,
  ChapterData,
  CompilationReport,
  CompilationResult,
  ContextBundle,
  CodexSection,
  ProseReport,
  AffectState,
  AffectTraitProblem,
  RegistryConflict,
  RegistryInvalidEntry,
};

// The Keystatic collections are not exported here: they are
// `@bbthorson/pinakes/keystatic`. Keystatic bundles its config into the
// browser, and this entry point carries the Node-side compiler.

// Named, not `export *`: everything listed is a compatibility promise, and the
// affect module's internals should stay free to change.
export {
  BUILTIN_BASINS,
  CORE_AFFECT_LABELS,
  buildAffectVocabulary,
  classifyAttractorBasin,
  formatAffectPromptInjection,
  getBehavioralDirectives,
  normalizeAffectLabel,
  parseAffectDeclaration,
  resolveAffectLabel,
  type AffectDeclaration,
  type AffectLabelConfig,
  type BasinBounds,
  type BasinConfig,
  type BuiltinBasin,
  type ScaledVad,
  type VadVector,
} from './compiler/affect.js';

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
export function openUniverse(root: string): Universe {
  const abs = path.resolve(root);
  const { config } = loadConfig(abs);
  const registry = new Registry(abs, config.paths.registry, config.paths.nonEntities);
  return { root: abs, config, registry, engine: new LinterEngine(abs, config, registry) };
}

function open(input: UniverseInput): Universe {
  return typeof input === 'string' ? openUniverse(input) : input;
}

export interface LintResult {
  diagnostics: Diagnostic[];
  /** `false` when any diagnostic is an error: the verdict `pinakes lint` exits 1 on. */
  ok: boolean;
}

/** Runs every continuity check `pinakes lint` runs. Never writes or deletes anything. */
export function lint(input: UniverseInput): LintResult {
  const u = open(input);
  const diagnostics = u.engine.lint();

  // Stretch rules need every compiled record's dates, so build the record
  // set in memory (nothing is written) and take its stretch and affect findings.
  const { stretchFindings, affectFindings } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  diagnostics.push(...stretchFindings, ...affectFindings);

  if (u.config.paths.rules) {
    const customRules = new YamlRulesLoader(u.root, u.config.paths.rules);
    for (const storyDir of u.engine.getStories()) {
      diagnostics.push(...customRules.runCustomRules(u.engine.loadChapters(storyDir)));
    }
  }

  return { diagnostics, ok: !diagnostics.some((d) => d.severity === 'error') };
}

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
export function compile(input: UniverseInput, options: CompileOptions = {}): CompileResult {
  const u = open(input);
  const report = compileProject(u.root, u.config, u.registry, u.engine, { write: options.write ?? false });
  return { ...report, ok: report.diagnostics.length === 0 };
}

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
export function context(
  input: UniverseInput,
  character: string,
  asOf: string,
  options: ContextOptions = {}
): ContextResult {
  const u = open(input);
  const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  return buildContext(u.root, u.config, u.registry, u.engine, records, character, asOf, {
    fullState: Boolean(options.fullState),
  });
}

/** Renders a context bundle as the Markdown `pinakes context` prints. */
export const renderContextMarkdown: (bundle: ContextBundle) => string = renderMarkdown;

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
export function proseCheck(input: UniverseInput, options: ProseCheckOptions = {}): Partial<Record<ProseReport, string>> {
  const u = open(input);
  const report = options.report ?? 'all';
  if (!['tells', 'closers', 'all'].includes(report)) {
    throw new Error(`Unknown report '${report}'. Expected tells, closers or all.`);
  }

  let stories = u.engine.getStories();
  if (options.story) {
    const needle = options.story.toLowerCase();
    stories = stories.filter((s) => path.basename(s).toLowerCase().includes(needle));
  }
  if (stories.length === 0) throw new Error('No stories found.');

  const chapters = stories.flatMap((s) => u.engine.loadChapters(s));
  if (chapters.length === 0) throw new Error('No chapters found.');

  return buildProseReports(chapters, u.config, report);
}

export interface AffectStateAtResult {
  /** Absent when the character has no declared affect to start from, or `errors` is non-empty. */
  state?: AffectState;
  /** An unresolvable character, a malformed date, or invalid codex affect fields. */
  errors: string[];
}

/**
 * A character's affect on `asOf` (YYYY-MM-DD): the state `pinakes context`
 * prints, with how it was reached. With `affect.dynamics` unset it is the
 * latest approved stretch's declared affect; with it set, that affect
 * replayed through the chapter events since. Never writes anything.
 */
export function affectStateAt(input: UniverseInput, character: string, asOf: string): AffectStateAtResult {
  const u = open(input);
  const resolved = u.registry.resolve(character, 'character');
  const errors: string[] = [];
  if (!resolved) errors.push(`'${character}' does not resolve to a registry character.`);
  if (!isCalendarDate(asOf)) errors.push(`asOf must be a YYYY-MM-DD calendar date; got '${asOf}'.`);
  if (!resolved || errors.length) return { errors };
  const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  const { state, problems } = computeAffectState(u.root, u.config, u.registry, u.engine, records, resolved.id, asOf);
  return { state, errors: problems.map((p) => `${p.file}: ${p.message}`) };
}
