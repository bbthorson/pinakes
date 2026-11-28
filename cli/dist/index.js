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
import { MemoryFS, nodeFS } from './fs.js';
import { Registry } from './registry/entities.js';
import { LinterEngine } from './linter/engine.js';
import { YamlRulesLoader } from './linter/yaml-loader.js';
import { compileProject } from './compiler/atproto.js';
import { buildContext, renderMarkdown } from './context/bundle.js';
import { buildProseReports } from './prose/check.js';
import { computeAffectState } from './compiler/affect-dynamics.js';
import { isCalendarDate } from './linter/stretches.js';
export { MemoryFS, nodeFS };
// The Keystatic collections are not exported here: they are
// `@bbthorson/pinakes/keystatic`. Keystatic bundles its config into the
// browser, and this entry point carries the Node-side compiler.
// Named, not `export *`: everything listed is a compatibility promise, and the
// affect module's internals should stay free to change.
export { BUILTIN_BASINS, CORE_AFFECT_LABELS, buildAffectVocabulary, classifyAttractorBasin, formatAffectPromptInjection, getBehavioralDirectives, normalizeAffectLabel, parseAffectDeclaration, resolveAffectLabel, } from './compiler/affect.js';
/** Reads `pinakes.yaml` and the registry. Throws if the config is missing or invalid. */
export function openUniverse(root, ufs = nodeFS) {
    const abs = path.resolve(root);
    const { config } = loadConfig(abs, ufs);
    const registry = new Registry(abs, config.paths.registry, config.paths.nonEntities, ufs);
    return { root: abs, config, registry, engine: new LinterEngine(abs, config, registry, ufs) };
}
/**
 * Opens a universe entirely in memory from a `{ relativePath: fileContent }`
 * snapshot (for example, a GitHub repo snapshot cached in Cloudflare R2).
 */
export function openMemoryUniverse(files, root = '/universe') {
    const mem = new MemoryFS(files, root);
    return openUniverse(mem.root, mem);
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
        story: options.story,
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
// ------------------------------------------------------------------ probabilistic & review layer
import { buildFirstAppearanceLedgerFromEngine, filterLedgerBeforeChapter, getBookKeyFromDir, renderFirstAppearancesMarkdown, } from './compiler/first-appearances.js';
import { CharacterBriefSchema, CharacterMoveSchema, MoveIdSchema, ReasoningEffortSchema, } from './probabilistic/schemas.js';
import { THREE_MOVE_BRIEF_CONTRACT, buildSceneBriefBundles, collectConstraintRules, evaluateDeterministicMask, isConstraintActive, renderCharacterBriefPrompt, resolveBriefRoute, } from './probabilistic/brief.js';
import { MOVE_IDS, computeSeed, sampleCharacterMove, } from './probabilistic/sampler.js';
import { DEFAULT_NARRATOR_GUIDANCE, composeNarratorBundle, renderNarratorBundleMarkdown, stripToObservableSurface, } from './probabilistic/compose.js';
import { CloudflareClefScorer, GenericLlmScorer, MockDecisionScorer, createDecisionScorer, parseClefResponse, scoreBriefWithScorer, } from './probabilistic/scorer.js';
import { CalibrationExampleSchema, loadCalibrationJsonl, parseCalibrationJsonl, renderCalibrationMarkdown, runCalibration, } from './probabilistic/calibrate.js';
import { TEMPORAL_LENSES, buildReviewSlices, numberLines, renderReviewSliceMarkdown, } from './review/slices.js';
import { ReviewFindingSchema, defaultCategoryForLens, mergeReviewFindings, parseLineSpan, renderMergedFindingsMarkdown, } from './review/findings.js';
import { collectAmbiguousTellHits, runProbabilisticLintPrepass, } from './review/runner.js';
import { detectWitnessKnowledgeIssues, } from './review/witness.js';
import { chapterWordToNumber, numberToChapterWord, renumberChapters, } from './renumber.js';
export { 
// First-appearance ledger
filterLedgerBeforeChapter, renderFirstAppearancesMarkdown, 
// Probabilistic schemas & Scene-Mode brief
MoveIdSchema, CharacterMoveSchema, CharacterBriefSchema, ReasoningEffortSchema, THREE_MOVE_BRIEF_CONTRACT, collectConstraintRules, evaluateDeterministicMask, isConstraintActive, renderCharacterBriefPrompt, resolveBriefRoute, 
// Seeded sampler
MOVE_IDS, computeSeed, sampleCharacterMove, 
// POV-locked narrator handoff
DEFAULT_NARRATOR_GUIDANCE, composeNarratorBundle, stripToObservableSurface, renderNarratorBundleMarkdown, 
// Decision scorers
CloudflareClefScorer, MockDecisionScorer, GenericLlmScorer, createDecisionScorer, parseClefResponse, scoreBriefWithScorer, 
// Calibration
CalibrationExampleSchema, loadCalibrationJsonl, parseCalibrationJsonl, runCalibration, renderCalibrationMarkdown, 
// Six-lens review board
TEMPORAL_LENSES, numberLines, renderReviewSliceMarkdown, ReviewFindingSchema, defaultCategoryForLens, parseLineSpan, mergeReviewFindings, renderMergedFindingsMarkdown, collectAmbiguousTellHits, runProbabilisticLintPrepass, detectWitnessKnowledgeIssues, 
// Chapter renumber helper
numberToChapterWord, chapterWordToNumber, };
/** Builds the deterministic First-Appearance Entity Ledger for a universe. Never writes to disk. */
export function firstAppearances(input) {
    const u = open(input);
    return buildFirstAppearanceLedgerFromEngine(u.registry, u.engine);
}
/** Assembles Scene-Mode 3-Move Character Brief prompt bundles with the information firewall enforced. */
export function briefBundles(input, request) {
    const u = open(input);
    const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
    const needle = request.story.toLowerCase();
    const matchedStory = u.engine
        .getStories()
        .find((s) => path.basename(s).toLowerCase().includes(needle) || getBookKeyFromDir(s) === needle);
    const book = request.book ?? (matchedStory ? getBookKeyFromDir(matchedStory) : request.story);
    return buildSceneBriefBundles(u.root, u.config, u.registry, u.engine, records, { ...request, book });
}
/**
 * Evaluates pre-sampling constraints (deterministic + optional semantic Clef gates),
 * scores candidate moves when a scorer is provided, and draws deterministically.
 */
export async function sampleBrief(input, brief, options = {}) {
    const u = open(input);
    const validated = CharacterBriefSchema.parse(brief);
    const rules = collectConstraintRules(u.config, options.extraConstraints);
    const detMask = evaluateDeterministicMask(validated, rules);
    let rawProbs = options.rawProbs;
    let scorerName = 'manual';
    const combinedMask = {
        A: { ...detMask.A, reasons: [...detMask.A.reasons] },
        B: { ...detMask.B, reasons: [...detMask.B.reasons] },
        C: { ...detMask.C, reasons: [...detMask.C.reasons] },
    };
    if (!rawProbs) {
        const scorer = options.scorer ?? createDecisionScorer(u.config);
        scorerName = scorer.name;
        const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
        const ctxRes = buildContext(u.root, u.config, u.registry, u.engine, records, validated.character, validated.asOf, {
            fullState: false,
            story: options.story ?? validated.book,
        });
        const ctxMd = ctxRes.bundle ? renderMarkdown(ctxRes.bundle) : `Character: ${validated.character}`;
        const scored = await scoreBriefWithScorer(scorer, validated, {
            contextMarkdown: ctxMd,
            sceneSetup: options.sceneSetup ?? '',
            constraints: rules,
            leakThreshold: u.config.probabilistic.escalation.leakThreshold,
        });
        rawProbs = scored.rawProbs;
        for (const id of MOVE_IDS) {
            const sem = scored.semanticMask[id];
            if (sem?.masked) {
                combinedMask[id].masked = true;
                combinedMask[id].reasons.push(...sem.reasons);
            }
        }
    }
    const beatType = options.beatType ?? validated.beatType;
    const samplingCfg = u.config.probabilistic.sampling;
    const temperature = options.temperature ??
        (beatType && samplingCfg.beatTemperatures[beatType] !== undefined
            ? samplingCfg.beatTemperatures[beatType]
            : samplingCfg.temperature);
    return sampleCharacterMove(validated, {
        rawProbs,
        mask: combinedMask,
        floor: options.floor ?? samplingCfg.floor,
        temperature,
        reroll: options.reroll,
        scorer: scorerName,
    });
}
/**
 * Samples a batch of 3-Move Character Briefs in a single invocation,
 * preserving deterministic per-character seeds and returning all roll logs.
 */
export async function sampleBriefs(input, briefs, options = {}) {
    const u = open(input);
    const outcomes = [];
    const logs = [];
    const errors = [];
    for (const raw of briefs) {
        const validated = CharacterBriefSchema.parse(raw);
        const outcome = await sampleBrief(u, validated, options);
        outcomes.push({ brief: validated, outcome });
        if (outcome.ok && outcome.log) {
            logs.push(outcome.log);
        }
        else {
            errors.push(`${validated.character}: ${outcome.error ?? 'Sampling failed.'}`);
        }
    }
    return { outcomes, logs, errors };
}
/**
 * Chains `sampleBriefs` -> `composeNarrator` in a single Scene-Mode ensemble
 * invocation, enforcing the POV-locked narrator handoff firewall.
 */
export async function sceneRun(input, briefs, options) {
    const u = open(input);
    if (briefs.length === 0) {
        return { logs: [], errors: ['sceneRun requires at least one character brief.'] };
    }
    const sampled = await sampleBriefs(u, briefs, options);
    if (sampled.errors.length > 0) {
        return { logs: sampled.logs, errors: sampled.errors };
    }
    const winningMoves = sampled.outcomes.map(({ brief, outcome }) => ({
        character: brief.character,
        move: outcome.log.chosenMove,
    }));
    const first = sampled.outcomes[0].brief;
    const composed = composeNarrator(u, {
        book: options.book ?? first.book,
        chapter: options.chapter ?? first.chapter,
        asOf: options.asOf ?? first.asOf,
        povCharacter: options.povCharacter,
        sceneSetup: options.sceneSetup ?? '',
        winningMoves,
        writingGuidePath: options.writingGuidePath,
    });
    return {
        logs: sampled.logs,
        bundle: composed.bundle,
        errors: composed.errors,
    };
}
/** Safely shifts chapter filenames, frontmatter `chapter:` numbers, and `#/### Chapter <Word>` headings. */
export function renumber(input, options) {
    const u = open(input);
    return renumberChapters(u.root, u.engine, options);
}
/** Assembles a POV-locked Single Narrator Pen Handoff bundle. */
export function composeNarrator(input, options) {
    const u = open(input);
    const writingGuidePath = options.writingGuidePath ?? u.config.probabilistic.review.paths.writingGuide;
    return composeNarratorBundle({
        ...options,
        writingGuidePath,
        projectRoot: u.root,
        ufs: u.engine.ufs,
    });
}
/** Assembles deterministic temporal review slices for the 6-lens review board. Never writes to disk. */
export function reviewSlices(input, options) {
    const u = open(input);
    const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
    return buildReviewSlices(u.root, u.config, u.registry, u.engine, records, options);
}
/** Runs the batched Clef-flash -> Clef 27B probabilistic lint pre-pass for a target chapter. */
export async function reviewPrepass(input, options) {
    const u = open(input);
    const { records } = compileProject(u.root, u.config, u.registry, u.engine, { write: false });
    const { slices, errors } = buildReviewSlices(u.root, u.config, u.registry, u.engine, records, {
        story: options.story,
        chapter: options.chapter,
        lenses: ['backward-short'],
    });
    if (errors.length || slices.length === 0)
        return { errors };
    const slice = slices[0];
    const storyDir = u.engine
        .getStories()
        .find((s) => path.basename(s).toLowerCase().includes(options.story.toLowerCase()) ||
        getBookKeyFromDir(s) === options.story.toLowerCase());
    const allChapters = storyDir ? u.engine.loadChapters(storyDir) : [];
    const targetIdx = allChapters.findIndex((c) => String(c.chapterNum) === String(options.chapter));
    const ch = targetIdx >= 0 ? allChapters[targetIdx] : undefined;
    if (!ch)
        return { errors: [`Could not load chapter body for ${options.story} ch ${options.chapter}.`] };
    // Build witness / off-page knowledge check input from compiled scene `participants`
    // (`characters_present`) of prior chapters in the same book.
    const NS = u.config.project.nsid;
    const book = slice.book;
    const sceneParticipantsByChapter = new Map();
    for (const r of records) {
        if (r.$type !== `${NS}.scene`)
            continue;
        const m = String(r.id).match(/^scene\.(.+)\.ch(.+)$/);
        if (!m || m[1] !== book)
            continue;
        sceneParticipantsByChapter.set(m[2], Array.isArray(r.participants) ? r.participants : []);
    }
    const priorChapters = allChapters.slice(0, targetIdx).map((p) => {
        const compiledParticipants = sceneParticipantsByChapter.get(String(p.chapterNum));
        const participants = compiledParticipants ??
            p.charactersPresent
                .map((n) => u.registry.resolve(n, 'character')?.id)
                .filter((id) => Boolean(id));
        return {
            chapterNum: p.chapterNum,
            title: p.title,
            participants,
            body: p.body,
            beatPurpose: p.beatPurpose,
        };
    });
    const targetCharIds = new Set();
    const targetPovId = ch.pov ? (u.registry.resolve(ch.pov, 'character')?.id ?? null) : null;
    if (targetPovId)
        targetCharIds.add(targetPovId);
    for (const name of ch.charactersPresent) {
        const resolved = u.registry.resolve(name, 'character');
        if (resolved)
            targetCharIds.add(resolved.id);
    }
    const targetCharacters = [...targetCharIds].map((id) => {
        const ent = u.registry.getEntity(id);
        const displayName = ent?.displayName ?? id;
        const names = [displayName, ...(ent?.aliases ?? [])];
        return { id, displayName, names };
    });
    const flashScorer = options.flashScorer ?? createDecisionScorer(u.config, { provider: u.config.probabilistic.scorer.provider === 'mock' ? 'mock' : 'clef-flash' });
    const deepScorer = options.deepScorer ?? (u.config.probabilistic.scorer.provider === 'clef' ? createDecisionScorer(u.config, { provider: 'clef' }) : undefined);
    const result = await runProbabilisticLintPrepass(ch.body, slice, u.config, {
        flashScorer,
        deepScorer,
        plantedClues: options.plantedClues,
        witnessCheck: {
            targetChapterNum: ch.chapterNum,
            targetBody: ch.body,
            targetPovId,
            targetCharacters,
            priorChapters,
        },
    });
    return { result, errors: [] };
}
export { PinakesMcpServer, } from './mcp/server.js';
