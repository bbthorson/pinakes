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
import { Registry } from './registry/entities.js';
import { LinterEngine, type Diagnostic, type ChapterData } from './linter/engine.js';
import { YamlRulesLoader } from './linter/yaml-loader.js';
import { compileProject, type CompilationReport, type CompilationResult } from './compiler/atproto.js';
import { buildContext, renderMarkdown, type ContextBundle, type CodexSection } from './context/bundle.js';
import { buildProseReports, type ProseReport } from './prose/check.js';

export type { Config, Diagnostic, ChapterData, CompilationReport, CompilationResult, ContextBundle, CodexSection, ProseReport };

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
  // set in memory (nothing is written) and take its stretch findings.
  const { stretchFindings } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
  diagnostics.push(...stretchFindings);

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
 * `stretchFindings` are continuity findings, reported by `lint` rather than
 * counted against `ok`.
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
