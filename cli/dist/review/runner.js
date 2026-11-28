import { DEFAULT_SIGNALS } from '../prose/check.js';
import { isConstraintActive } from '../probabilistic/brief.js';
import { mergeReviewFindings, } from './findings.js';
import { detectWitnessKnowledgeIssues } from './witness.js';
const TRIAGED_PROSE_SIGNALS = new Set([
    'negative-parallelism-split',
    'corporate-filler',
    "here's-the-kicker",
]);
function findLineNumber(text, index) {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text[i] === '\n')
            line++;
    }
    return line;
}
const SEED_COMPOUND_LOOKBEHIND = '(?<!poppy[- ]|sesame[- ]|caraway[- ]|mustard[- ]|sunflower[- ]|pumpkin[- ])';
const BARE_SEED_PATTERN_RE = /^(?:\\b)?(?:\(\?:)?seed(?:s\??|\(\?:[^)]*\)\??|\([^)]*\)\??)?\)?(?:\\b)?$/i;
function compileCraftVocabRegex(vocab) {
    const trimmed = vocab.trim();
    if (BARE_SEED_PATTERN_RE.test(trimmed)) {
        const core = trimmed.replace(/^\\b/, '').replace(/\\b$/, '');
        return new RegExp(`${SEED_COMPOUND_LOOKBEHIND}\\b(?:${core})\\b`, 'gi');
    }
    if (trimmed.includes('(?<!') || trimmed.startsWith('\\b') || trimmed.endsWith('\\b')) {
        return new RegExp(trimmed, 'gi');
    }
    return new RegExp(`\\b(?:${trimmed})\\b`, 'gi');
}
/**
 * Extracts ambiguous mechanical hits from `prose/check` signals plus
 * configured `craftVocabulary` terms (e.g. `red herring(s)`).
 */
export function collectAmbiguousTellHits(chapterBody, config) {
    const hits = [];
    const signals = config.prose?.signals && config.prose.signals.length > 0 ? config.prose.signals : DEFAULT_SIGNALS;
    for (const sig of signals) {
        if (!TRIAGED_PROSE_SIGNALS.has(sig.label))
            continue;
        const re = new RegExp(sig.pattern, 'gi');
        for (const m of chapterBody.matchAll(re)) {
            const idx = m.index ?? 0;
            const a = Math.max(0, idx - 60);
            const b = Math.min(chapterBody.length, idx + m[0].length + 60);
            hits.push({
                label: sig.label,
                lineNum: findLineNumber(chapterBody, idx),
                snippet: chapterBody.slice(a, b).trim().replace(/\s+/g, ' '),
            });
        }
    }
    for (const vocab of config.probabilistic.craftVocabulary) {
        if (!vocab.trim())
            continue;
        try {
            const re = compileCraftVocabRegex(vocab);
            for (const m of chapterBody.matchAll(re)) {
                const idx = m.index ?? 0;
                const a = Math.max(0, idx - 60);
                const b = Math.min(chapterBody.length, idx + m[0].length + 60);
                hits.push({
                    label: 'craft-vocabulary',
                    lineNum: findLineNumber(chapterBody, idx),
                    snippet: chapterBody.slice(a, b).trim().replace(/\s+/g, ' '),
                });
            }
        }
        catch {
            // Ignore malformed user regex here; schema/lint handles validation.
        }
    }
    return hits;
}
function isMidConfidence(p, lo, hi) {
    return p >= lo && p <= hi;
}
export async function runProbabilisticLintPrepass(chapterBody, slice, config, options) {
    const esc = config.probabilistic.escalation;
    const lo = options.lowConfidence ?? esc.lowConfidence;
    const hi = options.highConfidence ?? esc.highConfidence;
    const leakThreshold = options.leakThreshold ?? esc.leakThreshold;
    const toneCeiling = options.toneCeiling ?? esc.toneCeiling;
    const questions = [];
    const meta = new Map();
    // 1. Held-secret leak probability per active held secret
    const activeSecrets = [
        ...config.probabilistic.heldSecrets,
        ...config.probabilistic.doNotReveal,
    ].filter((s) => isConstraintActive(s, { book: slice.book, chapter: slice.chapter, asOf: slice.storyDate }));
    for (const secret of activeSecrets) {
        if (questions.length >= 64)
            break;
        const id = `secret:${secret.id}`;
        questions.push({
            id,
            type: 'binary',
            prompt: `Does this chapter reveal or prematurely telegraph the held secret "${secret.id}" (${secret.description})?`,
            options: ['yes', 'no'],
        });
        meta.set(id, { kind: 'secret', secretId: secret.id, description: secret.description });
    }
    // 2. POV slip detection
    if (questions.length < 64 && slice.targetChapter.pov) {
        questions.push({
            id: 'pov_slip',
            type: 'binary',
            prompt: `This chapter is third-person limited to ${slice.targetChapter.pov}. Does any passage head-hop into another character's private thoughts or unobservable motives?`,
            options: ['yes', 'no'],
        });
        meta.set('pov_slip', { kind: 'pov' });
    }
    // 3. Tone scale (1-10) ceiling check
    if (questions.length < 64) {
        questions.push({
            id: 'tone_scale',
            type: 'scale',
            prompt: 'Rate the chapter\'s tonal intensity/darkness on a 1 (light/cozy) to 10 (grim/severe) scale.',
            scale: [1, 10],
        });
        meta.set('tone_scale', { kind: 'tone' });
    }
    // 4. Clue telegraphing per planted clue
    for (const clue of options.plantedClues ?? []) {
        if (questions.length >= 64)
            break;
        const id = `clue:${clue.id}`;
        questions.push({
            id,
            type: 'enum',
            prompt: `How does the chapter land the planted clue "${clue.id}" (${clue.description})?`,
            options: ['invisible', 'fair-play', 'over-signaled'],
        });
        meta.set(id, { kind: 'clue', clueId: clue.id, description: clue.description, lineRef: clue.lineRef });
    }
    // 5. Ambiguous mechanical-tell & craft-vocabulary triage
    const tellHits = collectAmbiguousTellHits(chapterBody, config);
    for (let i = 0; i < tellHits.length && questions.length < 64; i++) {
        const hit = tellHits[i];
        const id = `tell:${i}:${hit.label}:L${hit.lineNum}`;
        questions.push({
            id,
            type: 'enum',
            prompt: `Line L${hit.lineNum} matched \`${hit.label}\`: "${hit.snippet}". Is this natural character dialogue/voice or an AI fingerprint / meta-craft tell?`,
            options: ['natural-dialogue', 'ai-fingerprint'],
        });
        meta.set(id, { kind: 'tell', hit });
    }
    const context = [
        `Book: ${slice.book} | Chapter ${slice.chapter} — ${slice.targetChapter.title} (${slice.storyDate})`,
        `POV: ${slice.targetChapter.pov ?? 'unspecified'}`,
        '',
        '## Target Chapter (Line-Numbered)',
        slice.targetChapter.numberedBody,
    ].join('\n');
    // Tier 1: fast pass (`clef-flash`)
    const flashAnswers = await options.flashScorer.score({ context, questions });
    // Identify items needing Tier 2 escalation (`clef` 27B)
    const toEscalate = [];
    for (const q of questions) {
        const ans = flashAnswers.find((a) => a.id === q.id);
        if (!ans)
            continue;
        const m = meta.get(q.id);
        if (!m)
            continue;
        if (m.kind === 'secret') {
            const p = ans.probabilities.yes ?? 0;
            if (p >= leakThreshold || isMidConfidence(p, lo, hi)) {
                toEscalate.push({ q, flash: ans, reason: `secret leak p=${p.toFixed(2)}` });
            }
        }
        else if (m.kind === 'pov') {
            const p = ans.probabilities.yes ?? 0;
            if (p >= 0.5 || isMidConfidence(p, lo, hi)) {
                toEscalate.push({ q, flash: ans, reason: `POV slip p=${p.toFixed(2)}` });
            }
        }
        else if (m.kind === 'tone') {
            if (toneCeiling !== undefined && (ans.expectedValue ?? 0) > toneCeiling) {
                toEscalate.push({ q, flash: ans, reason: `tone ${ans.expectedValue?.toFixed(1)} > ceiling ${toneCeiling}` });
            }
        }
        else if (m.kind === 'clue') {
            const pOver = ans.probabilities['over-signaled'] ?? 0;
            const pInv = ans.probabilities['invisible'] ?? 0;
            if (ans.topLabel !== 'fair-play' || isMidConfidence(pOver, lo, hi) || isMidConfidence(pInv, lo, hi)) {
                toEscalate.push({ q, flash: ans, reason: `clue telegraphing top=${ans.topLabel}` });
            }
        }
        else if (m.kind === 'tell') {
            const pAi = ans.probabilities['ai-fingerprint'] ?? 0;
            if (pAi >= 0.5 || isMidConfidence(pAi, lo, hi)) {
                toEscalate.push({ q, flash: ans, reason: `tell triage p(ai-fingerprint)=${pAi.toFixed(2)}` });
            }
        }
    }
    // Tier 2: deep pass (`clef` 27B) if a deepScorer is provided
    let deepAnswers = [];
    if (options.deepScorer && toEscalate.length > 0) {
        deepAnswers = await options.deepScorer.score({
            context,
            questions: toEscalate.map((e) => e.q),
        });
    }
    const escalations = [];
    const findings = [];
    for (const q of questions) {
        const flash = flashAnswers.find((a) => a.id === q.id);
        if (!flash)
            continue;
        const deep = deepAnswers.find((a) => a.id === q.id);
        const effective = deep ?? flash;
        const m = meta.get(q.id);
        if (!m)
            continue;
        const escRecord = toEscalate.find((e) => e.q.id === q.id);
        let escalateToLlm = false;
        if (m.kind === 'secret') {
            const p = effective.probabilities.yes ?? 0;
            if (p >= leakThreshold || isMidConfidence(p, lo, hi)) {
                escalateToLlm = true;
                findings.push({
                    lens: 'probabilistic-lint',
                    severity: p >= leakThreshold ? 'blocker' : 'warn',
                    category: 'firewall',
                    lineRef: 'L1',
                    issue: `Potential held-secret leak for "${m.secretId}" (${m.description}) — p=${p.toFixed(2)}.`,
                    fix: `Inspect chapter against held-secret policy for "${m.secretId}" and escalate to backward-long / forward-short review.`,
                    confidence: p,
                });
            }
        }
        else if (m.kind === 'pov') {
            const p = effective.probabilities.yes ?? 0;
            if (p >= 0.5 || isMidConfidence(p, lo, hi)) {
                escalateToLlm = true;
                findings.push({
                    lens: 'probabilistic-lint',
                    severity: p >= hi ? 'blocker' : 'warn',
                    category: 'continuity',
                    lineRef: 'L1',
                    issue: `Possible POV slip outside ${slice.targetChapter.pov}'s perspective — p=${p.toFixed(2)}.`,
                    fix: 'Verify all interiority stays locked to the POV character; convert non-POV thoughts to observable dialogue/tells.',
                    confidence: p,
                });
            }
        }
        else if (m.kind === 'tone') {
            const val = effective.expectedValue ?? 0;
            if (toneCeiling !== undefined && val > toneCeiling) {
                escalateToLlm = true;
                findings.push({
                    lens: 'probabilistic-lint',
                    severity: 'warn',
                    category: 'craft',
                    lineRef: 'L1',
                    issue: `Tone intensity scored ${val.toFixed(1)}/10, exceeding configured ceiling of ${toneCeiling}/10.`,
                    fix: 'Check scene register and voice guide to ensure tonal escalation is earned.',
                    confidence: effective.topProbability,
                });
            }
        }
        else if (m.kind === 'clue') {
            if (effective.topLabel === 'over-signaled' || effective.topLabel === 'invisible') {
                escalateToLlm = true;
                findings.push({
                    lens: 'probabilistic-lint',
                    severity: 'warn',
                    category: 'arc-fair-play',
                    lineRef: m.lineRef ?? 'L1',
                    issue: `Planted clue "${m.clueId}" (${m.description}) classified as \`${effective.topLabel}\` (p=${(effective.topProbability ?? 0).toFixed(2)}).`,
                    fix: effective.topLabel === 'over-signaled'
                        ? 'Soften the signpost so the clue lands in fair-play register without spotlighting it.'
                        : 'Make the clue observable on-page so fair-play provenance holds.',
                    confidence: effective.topProbability,
                });
            }
        }
        else if (m.kind === 'tell') {
            const pAi = effective.probabilities['ai-fingerprint'] ?? 0;
            if (pAi >= 0.5 || isMidConfidence(pAi, lo, hi)) {
                escalateToLlm = pAi < hi;
                findings.push({
                    lens: 'probabilistic-lint',
                    severity: m.hit.label === 'craft-vocabulary' ? 'warn' : 'note',
                    category: 'craft',
                    lineRef: `L${m.hit.lineNum}`,
                    issue: `Triaged \`${m.hit.label}\` hit as likely AI/craft fingerprint (p=${pAi.toFixed(2)}): "${m.hit.snippet}".`,
                    fix: 'Rewrite in character-native phrasing unless deliberately earned by the voice guide.',
                    confidence: pAi,
                });
            }
        }
        if (escRecord) {
            escalations.push({
                questionId: q.id,
                reason: escRecord.reason,
                flashAnswer: flash,
                ...(deep ? { deepAnswer: deep } : {}),
                escalateToLlm,
            });
        }
    }
    if (options.witnessCheck) {
        findings.push(...detectWitnessKnowledgeIssues(options.witnessCheck));
    }
    return {
        questions,
        flashAnswers,
        deepAnswers,
        escalations,
        findings,
        merged: mergeReviewFindings(findings),
    };
}
