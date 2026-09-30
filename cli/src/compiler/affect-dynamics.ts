/**
 * Affect dynamics over compiled records: a character's state on a date,
 * replayed from their latest declared stretch through their chapter affect
 * events, relaxing toward a baseline between them. See
 * `design/affect-dynamics.md`.
 *
 * `context` and the compiler's `affect-discontinuity` check both call this, so
 * the state the drafter is shown and the state `lint` checks declarations
 * against cannot disagree.
 */
import fs from 'fs';
import path from 'path';
import { Config } from '../config.js';
import { Registry } from '../registry/entities.js';
import { LinterEngine } from '../linter/engine.js';
import {
  affectDistance,
  buildAffectVocabulary,
  classifyAttractorBasin,
  parseAffectDeclaration,
  replayAffect,
  resolveAffectLabel,
  scaleVad,
  type ReplayEvent,
  type ReplayRates,
  type ScaledVad,
  type VadVector,
} from './affect.js';

/** What a character's codex frontmatter says about their affect. */
export interface AffectTraits {
  baseline?: VadVector;
  /** Multiplies the universe's half-life for this character. 1 when unset. */
  halfLifeScale: number;
}

export interface AffectTraitProblem {
  file: string;
  message: string;
}

/**
 * Reads `affectBaseline` and `affectHalfLifeScale` from a character's codex
 * file. A problem means the character is not replayed at all: a wrong rate or
 * a guessed baseline would produce a state that looks like data.
 */
export function readAffectTraits(
  projectRoot: string,
  sourceFile: string | null | undefined,
  engine: LinterEngine,
  vocab: Map<string, VadVector>
): { traits?: AffectTraits; problems: AffectTraitProblem[] } {
  const traits: AffectTraits = { halfLifeScale: 1 };
  if (!sourceFile) return { traits, problems: [] };
  const abs = path.resolve(projectRoot, sourceFile);
  if (!fs.existsSync(abs)) return { traits, problems: [] };
  const { data } = engine.parseFrontmatter(fs.readFileSync(abs, 'utf-8'));
  if (!data) return { traits, problems: [] };

  const problems: AffectTraitProblem[] = [];
  if (data.affectBaseline !== undefined) {
    const decl = parseAffectDeclaration(data.affectBaseline);
    if ('problem' in decl) {
      problems.push({ file: sourceFile, message: `\`affectBaseline\`: ${decl.problem.message}` });
    } else if ('numeric' in decl) {
      traits.baseline = decl.numeric;
    } else if (decl.steps.length > 1) {
      problems.push({ file: sourceFile, message: `\`affectBaseline\` is a resting state, so one label or { v, a, d }; got '${decl.steps.join(' → ')}'.` });
    } else {
      traits.baseline = resolveAffectLabel(decl.steps[0], vocab);
      if (!traits.baseline) problems.push({ file: sourceFile, message: `\`affectBaseline\` '${decl.steps[0]}' is not in the affect vocabulary.` });
    }
  }
  if (data.affectHalfLifeScale !== undefined) {
    const n = data.affectHalfLifeScale;
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) traits.halfLifeScale = n;
    else problems.push({ file: sourceFile, message: `\`affectHalfLifeScale\` must be a positive number; got ${JSON.stringify(n)}.` });
  }
  return problems.length ? { problems } : { traits, problems };
}

const unscale = (s: ScaledVad): VadVector => ({ valence: s.valence / 100, arousal: s.arousal / 100, dominance: s.dominance / 100 });

/** A character's affect events as replay input, in replay order: end date, then book, then chapter. */
export function replayEvents(records: any[], NS: string, subject: string): (ReplayEvent & { sourceFile: string })[] {
  const chapterOf = (r: any) => {
    const m = String(r.chapterRef ?? '').match(/^(.*)#ch(\d+)$/);
    return m ? { book: m[1], ch: parseInt(m[2], 10) } : { book: '', ch: 0 };
  };
  return records
    .filter((r) => r.$type === `${NS}.character.affect.event` && r.subject === subject)
    .map((r) => ({ r, end: String(r.storyDateEnd ?? r.storyDate), ...chapterOf(r) }))
    .sort((a, b) => a.end.localeCompare(b.end) || a.book.localeCompare(b.book) || a.ch - b.ch)
    .map(({ r, end }) => ({
      id: r.id,
      end,
      from: r.from ? unscale(r.from) : undefined,
      to: r.to ? unscale(r.to) : undefined,
      delta: unscale(r.delta),
      sourceFile: r.sourceFile,
    }));
}

/** Approved stretches that declared affect, oldest first. Drafts neither anchor nor are checked. */
export function affectAnchors(records: any[], NS: string, subject: string): any[] {
  return records
    .filter((r) => r.$type === `${NS}.character.stretch` && r.subject === subject && r.status === 'approved' && r.coordinates)
    .sort((a, b) => String(a.asOf).localeCompare(String(b.asOf)));
}

export interface AffectState {
  asOf: string;
  /**
   * `declared`: dynamics are off, and this is the latest stretch's affect as
   * written. `replayed`: carried forward through events, decaying toward the
   * baseline. `held`: carried forward, but with no baseline nothing decays.
   */
  mode: 'declared' | 'replayed' | 'held';
  coordinates: ScaledVad;
  attractorBasin?: string;
  /** The stretch the state starts from. */
  anchor: { id: string; asOf: string };
  /** Events applied, oldest first. */
  events: { id: string; end: string }[];
  halfLifeDays?: number;
}

export interface AffectStateResult {
  state?: AffectState;
  /** Why no state could be computed. The character's codex affect fields are invalid. */
  problems: AffectTraitProblem[];
}

/**
 * A character's affect on `asOf`, from compiled records.
 *
 * With `affect.dynamics` unset it is the latest approved stretch's declared
 * affect, or nothing when that stretch declares none. With dynamics on it
 * starts from the latest approved stretch that declares affect and replays
 * the events since. With no such stretch there is no state: replaying from a
 * baseline alone would give the character a state nobody declared.
 */
export function computeAffectState(
  projectRoot: string,
  config: Config,
  registry: Registry,
  engine: LinterEngine,
  records: any[],
  subject: string,
  asOf: string
): AffectStateResult {
  const NS = config.project.nsid;
  const dynamics = config.affect.dynamics;

  if (!dynamics) {
    const latest = records
      .filter((r) => r.$type === `${NS}.character.stretch` && r.subject === subject && r.status === 'approved' && r.asOf <= asOf)
      .sort((a, b) => String(a.asOf).localeCompare(String(b.asOf)))
      .pop();
    if (!latest?.coordinates) return { problems: [] };
    return {
      problems: [],
      state: {
        asOf,
        mode: 'declared',
        coordinates: latest.coordinates,
        attractorBasin: latest.attractorBasin,
        anchor: { id: latest.id, asOf: latest.asOf },
        events: [],
      },
    };
  }

  const anchor = affectAnchors(records, NS, subject).filter((s) => s.asOf <= asOf).pop();
  if (!anchor) return { problems: [] };

  const vocab = buildAffectVocabulary(config.affect.labels);
  const { traits, problems } = readAffectTraits(projectRoot, registry.getEntity(subject)?.sourceFile, engine, vocab);
  if (!traits) return { problems };

  const rates: ReplayRates = { baseline: traits.baseline, halfLifeDays: dynamics.halfLifeDays * traits.halfLifeScale };
  const { vad, steps } = replayAffect(unscale(anchor.coordinates), anchor.asOf, replayEvents(records, NS, subject), asOf, rates);
  return {
    problems: [],
    state: {
      asOf,
      mode: traits.baseline ? 'replayed' : 'held',
      coordinates: scaleVad(vad),
      attractorBasin: classifyAttractorBasin(vad, config.affect.basins),
      anchor: { id: anchor.id, asOf: anchor.asOf },
      events: steps.map((s) => ({ id: s.event.id, end: s.event.end })),
      halfLifeDays: traits.baseline ? rates.halfLifeDays : undefined,
    },
  };
}

/**
 * `affect-discontinuity`: where the author's declarations disagree with the
 * replay. A chapter's first step is checked against the state it is entered
 * in, and each stretch against the state replayed from the stretch before it.
 * The stretch still re-anchors either way; the finding only asks whether the
 * jump was meant.
 */
export function discontinuityFindings(
  projectRoot: string,
  config: Config,
  registry: Registry,
  engine: LinterEngine,
  records: any[]
): { file: string; message: string }[] {
  const dynamics = config.affect.dynamics;
  const threshold = dynamics?.discontinuity;
  if (!dynamics || threshold === undefined) return [];
  const NS = config.project.nsid;
  const vocab = buildAffectVocabulary(config.affect.labels);
  const out: { file: string; message: string }[] = [];

  const subjects = new Set(
    records
      .filter((r) => r.$type === `${NS}.character.stretch` || r.$type === `${NS}.character.affect.event`)
      .map((r) => r.subject)
  );
  for (const subject of [...subjects].sort()) {
    const anchors = affectAnchors(records, NS, subject);
    if (anchors.length === 0) continue;
    // Invalid traits are reported once, by the compiler's own pass over the codex.
    const { traits } = readAffectTraits(projectRoot, registry.getEntity(subject)?.sourceFile, engine, vocab);
    if (!traits) continue;
    const rates: ReplayRates = { baseline: traits.baseline, halfLifeDays: dynamics.halfLifeDays * traits.halfLifeScale };
    const events = replayEvents(records, NS, subject);
    const fmt = (v: VadVector) => {
      const s = scaleVad(v);
      return `${s.valence}/${s.arousal}/${s.dominance}`;
    };

    for (const event of events) {
      if (!event.from) continue;
      const anchor = anchors.filter((a) => a.asOf < event.end).pop();
      if (!anchor) continue;
      const step = replayAffect(unscale(anchor.coordinates), anchor.asOf, events, event.end, rates).steps.find(
        (s) => s.event.id === event.id
      );
      if (!step) continue;
      const d = affectDistance(step.entering, event.from);
      if (d > threshold) {
        out.push({
          file: event.sourceFile,
          message:
            `${event.id} says ${subject} enters at ${fmt(event.from)}, but the replay from ${anchor.id} ` +
            `has them at ${fmt(step.entering)} (distance ${Math.round(d)}, threshold ${threshold}).`,
        });
      }
    }

    for (let i = 1; i < anchors.length; i++) {
      const prev = anchors[i - 1];
      const cur = anchors[i];
      const { vad } = replayAffect(unscale(prev.coordinates), prev.asOf, events, cur.asOf, rates);
      const declared = unscale(cur.coordinates);
      const d = affectDistance(vad, declared);
      if (d > threshold) {
        out.push({
          file: cur.sourceFile,
          message:
            `${cur.id} declares ${fmt(declared)}, but the replay from ${prev.id} has ${subject} at ${fmt(vad)} ` +
            `(distance ${Math.round(d)}, threshold ${threshold}). The stretch still re-anchors; this asks whether the jump was meant.`,
        });
      }
    }
  }
  return out;
}
