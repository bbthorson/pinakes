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
import { loadConfig } from './config.js';
import { Registry } from './registry/entities.js';
import { LinterEngine } from './linter/engine.js';
import { YamlRulesLoader } from './linter/yaml-loader.js';
import { compileProject } from './compiler/atproto.js';
import { buildContext, renderMarkdown } from './context/bundle.js';
import { buildProseReports } from './prose/check.js';
import { computeAffectState } from './compiler/affect-dynamics.js';
import { isCalendarDate } from './linter/stretches.js';
// The Keystatic collections are not exported here: they are
// `@bbthorson/pinakes/keystatic`. Keystatic bundles its config into the
// browser, and this entry point carries the Node-side compiler.
// Named, not `export *`: everything listed is a compatibility promise, and the
// affect module's internals should stay free to change.
export { BUILTIN_BASINS, CORE_AFFECT_LABELS, buildAffectVocabulary, classifyAttractorBasin, formatAffectPromptInjection, getBehavioralDirectives, normalizeAffectLabel, parseAffectDeclaration, resolveAffectLabel, } from './compiler/affect.js';
/** Reads `pinakes.yaml` and the registry. Throws if the config is missing or invalid. */
export function openUniverse(root) {
    const abs = path.resolve(root);
    const { config } = loadConfig(abs);
    const registry = new Registry(abs, config.paths.registry, config.paths.nonEntities);
    return { root: abs, config, registry, engine: new LinterEngine(abs, config, registry) };
}
function open(input) {
    return typeof input === 'string' ? openUniverse(input) : input;
}
/** Runs every continuity check `pinakes lint` runs. Never writes or deletes anything. */
export function lint(input) {
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
/**
 * Builds and validates every record. `records` holds them all in memory;
 * `stretchFindings` and `affectFindings` are continuity findings, reported by
 * `lint` rather than counted against `ok`.
 */
export function compile(input, options = {}) {
    const u = open(input);
    const report = compileProject(u.root, u.config, u.registry, u.engine, { write: options.write ?? false });
    return { ...report, ok: report.diagnostics.length === 0 };
}
/**
 * What `character` (a registry name or id) can see on `asOf` (YYYY-MM-DD).
 * An unresolvable character or a malformed date is returned in `errors`, not
 * thrown. Never writes anything.
 */
export function context(input, character, asOf, options = {}) {
    const u = open(input);
    const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
    return buildContext(u.root, u.config, u.registry, u.engine, records, character, asOf, {
        fullState: Boolean(options.fullState),
    });
}
/** Renders a context bundle as the Markdown `pinakes context` prints. */
export const renderContextMarkdown = renderMarkdown;
/**
 * The `prose-check` reports as Markdown, keyed by name. There is no verdict:
 * these are inputs to a judgment pass. Throws when there is nothing to check,
 * so a mistyped `story` cannot come back as an empty, clean-looking report.
 */
export function proseCheck(input, options = {}) {
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
    if (stories.length === 0)
        throw new Error('No stories found.');
    const chapters = stories.flatMap((s) => u.engine.loadChapters(s));
    if (chapters.length === 0)
        throw new Error('No chapters found.');
    return buildProseReports(chapters, u.config, report);
}
/**
 * A character's affect on `asOf` (YYYY-MM-DD): the state `pinakes context`
 * prints, with how it was reached. With `affect.dynamics` unset it is the
 * latest approved stretch's declared affect; with it set, that affect
 * replayed through the chapter events since. Never writes anything.
 */
export function affectStateAt(input, character, asOf) {
    const u = open(input);
    const resolved = u.registry.resolve(character, 'character');
    const errors = [];
    if (!resolved)
        errors.push(`'${character}' does not resolve to a registry character.`);
    if (!isCalendarDate(asOf))
        errors.push(`asOf must be a YYYY-MM-DD calendar date; got '${asOf}'.`);
    if (!resolved || errors.length)
        return { errors };
    const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
    const { state, problems } = computeAffectState(u.root, u.config, u.registry, u.engine, records, resolved.id, asOf);
    return { state, errors: problems.map((p) => `${p.file}: ${p.message}`) };
}
