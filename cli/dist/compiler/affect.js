/**
 * Character affect: VAD (valence, arousal, dominance) coordinates, and the
 * attractor basins that turn a coordinate into drafting tendencies.
 *
 * Affect is declared, never inferred. A chapter or stretch carries it in its
 * own `affect:` field, as vocabulary labels or explicit numbers, and a record
 * gets coordinates only from a declaration that resolved.
 *
 * Voice registers (`public`, `private`, `under-pressure`) are not affect. A
 * register says who the character is talking to and how guarded they are; it
 * has no coordinates. The first version of this module mapped registers to
 * fixed VAD values and read affect out of the register annotation's
 * parenthetical. On Supper Club Secrets Book 1 that gave every stretch its
 * register's numbers rather than the character's (six characters, two distinct
 * coordinates, all `grounded-stoic`), and scored 77 of 89 chapter events from
 * labels it could not resolve as if they were neutral, some with the wrong
 * sign. `pinakes context` then told the drafter to write a character in
 * performative chaos as "measured, steady, and deliberative".
 *
 * Serialized values are integers in [-100, 100]: Lexicon has no floats.
 * Internally a VadVector is in [-1, 1].
 */
import { parseRegister } from '../linter/registers.js';
export const BUILTIN_BASINS = [
    'hyper-vigilant',
    'depressive-exhaustion',
    'manic-fixation',
    'dissociative-numb',
    'grounded-stoic',
];
/** Clamps a number to [min, max]. */
function clip(val, min = -1.0, max = 1.0) {
    return Math.max(min, Math.min(max, val));
}
/** Scales a continuous VadVector to the integer form records carry. */
export function scaleVad(v) {
    const s = (x) => Math.round(clip(x * 100, -100, 100));
    return { valence: s(v.valence), arousal: s(v.arousal), dominance: s(v.dominance) };
}
/**
 * The labels every universe starts with. A universe adds to or overrides these
 * under `affect.labels` in `pinakes.yaml`; the numbers for its own words are
 * the author's, not Pinakes'.
 */
export const CORE_AFFECT_LABELS = {
    alarmed: { valence: -0.6, arousal: 0.7, dominance: -0.3 },
    'quietly alarmed': { valence: -0.4, arousal: 0.4, dominance: -0.1 },
    panic: { valence: -0.8, arousal: 0.9, dominance: -0.6 },
    paralyzed: { valence: -0.7, arousal: 0.5, dominance: -0.8 },
    guarded: { valence: -0.2, arousal: 0.3, dominance: 0.1 },
    curious: { valence: 0.4, arousal: 0.3, dominance: 0.2 },
    warm: { valence: 0.6, arousal: 0.1, dominance: 0.3 },
    elated: { valence: 0.8, arousal: 0.6, dominance: 0.5 },
    defiant: { valence: -0.1, arousal: 0.6, dominance: 0.6 },
    deflating: { valence: -0.5, arousal: -0.3, dominance: -0.4 },
    exhausted: { valence: -0.4, arousal: -0.6, dominance: -0.5 },
    stoic: { valence: 0.0, arousal: -0.2, dominance: 0.4 },
    skeptical: { valence: -0.1, arousal: 0.2, dominance: 0.3 },
    animated: { valence: 0.5, arousal: 0.5, dominance: 0.3 },
    conflicted: { valence: -0.3, arousal: 0.4, dominance: -0.1 },
    softening: { valence: 0.3, arousal: -0.2, dominance: 0.1 },
};
/** Case- and whitespace-insensitive; nothing looser. */
export function normalizeAffectLabel(label) {
    return label.trim().toLowerCase().replace(/\s+/g, ' ');
}
/**
 * The resolved vocabulary: the core labels, overlaid with the universe's, each
 * reachable by its name and its aliases. Collisions are rejected when the
 * config is loaded, so a lookup here has exactly one answer.
 */
export function buildAffectVocabulary(labels = {}) {
    const vocab = new Map();
    for (const [name, vad] of Object.entries(CORE_AFFECT_LABELS))
        vocab.set(name, vad);
    for (const [name, l] of Object.entries(labels)) {
        const vad = { valence: l.v / 100, arousal: l.a / 100, dominance: l.d / 100 };
        vocab.set(normalizeAffectLabel(name), vad);
        for (const alias of l.aliases ?? [])
            vocab.set(normalizeAffectLabel(alias), vad);
    }
    return vocab;
}
/**
 * Exact match on the normalized label, or undefined. There is no substring
 * fallback: the old one resolved `not warm` to `warm`, and an unknown label to
 * a neutral 0/0/0 that looked like data.
 */
export function resolveAffectLabel(label, vocab) {
    return vocab.get(normalizeAffectLabel(label));
}
/**
 * Reads one `affect:` value: a label, a transition (`curious → angry`), or a
 * numeric triple `{ v, a, d }` of integers in [-100, 100].
 *
 * A label string is split by `parseRegister`, the same code that reads
 * `registers:`. The two used to have separate parsers, and one annotation
 * compiled to one register for the state event and to a transition into an
 * unknown state for the affect event.
 */
export function parseAffectDeclaration(raw) {
    if (typeof raw === 'string') {
        const { steps } = parseRegister(raw);
        if (steps.length === 0)
            return { problem: { rule: 'affect-malformed', message: `\`affect\` value '${raw}' names no label.` } };
        return { steps };
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const keys = Object.keys(raw).sort();
        if (keys.join(',') !== 'a,d,v') {
            return {
                problem: {
                    rule: 'affect-malformed',
                    message: `A numeric \`affect\` value has exactly the keys v, a and d; got ${keys.length ? keys.join(', ') : 'none'}.`,
                },
            };
        }
        const r = raw;
        for (const k of ['v', 'a', 'd']) {
            const n = r[k];
            if (typeof n !== 'number' || !Number.isInteger(n) || n < -100 || n > 100) {
                return {
                    problem: {
                        rule: 'affect-out-of-range',
                        message: `\`affect.${k}\` must be an integer in [-100, 100]; got ${JSON.stringify(n)}.`,
                    },
                };
            }
        }
        return { numeric: { valence: r.v / 100, arousal: r.a / 100, dominance: r.d / 100 } };
    }
    return {
        problem: {
            rule: 'affect-malformed',
            message: `\`affect\` must be a label, a transition (\`a → b\`) or { v, a, d }; got ${JSON.stringify(raw)}.`,
        },
    };
}
/** `to - from`, clipped: the shift an event records. */
export function affectDelta(from, to) {
    return {
        valence: clip(to.valence - from.valence),
        arousal: clip(to.arousal - from.arousal),
        dominance: clip(to.dominance - from.dominance),
    };
}
function builtinBasin(vad) {
    const { valence: v, arousal: a, dominance: d } = vad;
    if (a > 0.35 && v < -0.15)
        return 'hyper-vigilant';
    if (a < -0.25 && v < -0.25 && d < -0.15)
        return 'depressive-exhaustion';
    if (a > 0.45 && d > 0.25 && Math.abs(v) > 0.2)
        return 'manic-fixation';
    if (a < -0.45 && Math.abs(v) <= 0.25 && d < -0.2)
        return 'dissociative-numb';
    // A band, not the leftover. It used to be the fall-through, so `elated` and
    // `animated` (high arousal, positive valence) were labelled measured and steady.
    if (Math.abs(a) <= 0.35 && v >= -0.15)
        return 'grounded-stoic';
    return undefined;
}
function within(x, range) {
    if (!range)
        return true;
    const n = Math.round(x * 100);
    return n >= range[0] && n <= range[1];
}
/**
 * The basin a coordinate falls in, or undefined when none claims it. The
 * built-in basins are tried first; a universe's own basins (those with `when`)
 * cover what they leave, in the order `pinakes.yaml` lists them.
 */
export function classifyAttractorBasin(vad, basins = {}) {
    const hit = builtinBasin(vad);
    if (hit)
        return hit;
    for (const [name, b] of Object.entries(basins)) {
        if (!b.when)
            continue;
        if (within(vad.valence, b.when.v) && within(vad.arousal, b.when.a) && within(vad.dominance, b.when.d))
            return name;
    }
    return undefined;
}
const BUILTIN_DIRECTIVES = {
    'hyper-vigilant': [
        'Dialogue tends to be rapid, guarded, or interrogative.',
        'Subtext prioritizes scanning the environment and tracking signs of deception.',
        'Hesitates to disclose personal commitments or vulnerable details.',
    ],
    'depressive-exhaustion': [
        'Dialogue tends to be sparse, flat, or delayed.',
        'Subtext reflects exhaustion, fatalism, and reluctance to invest effort.',
        'Responds mostly in short, low-effort acquiescence.',
    ],
    'manic-fixation': [
        'Dialogue tends to be intense, rapid-fire, and prone to monologue bursts.',
        'Subtext tunnels on the active objective to the exclusion of other cues.',
        'Dismisses risks and overestimates personal control.',
    ],
    'dissociative-numb': [
        'Dialogue tends to be mechanical, compliant, or flatly detached.',
        'Subtext shows blunted affect and disconnection from surroundings.',
        'Observes high-stakes developments with eerie neutrality.',
    ],
    'grounded-stoic': [
        'Dialogue tends to be measured, steady, and deliberative.',
        'Subtext shows agency, emotional containment, and situational awareness.',
        'Evaluates conflicts pragmatically without panic or despair.',
    ],
};
/**
 * A basin's tendencies: the universe's own when `pinakes.yaml` gives them, so
 * they can be phrased in its voice guide's terms, else the built-in set.
 */
export function getBehavioralDirectives(basin, basins = {}) {
    return basins[basin]?.directives ?? BUILTIN_DIRECTIVES[basin] ?? [];
}
/**
 * The block `pinakes context` prints. Advisory by construction: the voice
 * guide and the register decide how a character speaks, and these are
 * tendencies the declared affect suggests, not constraints.
 */
export function formatAffectPromptInjection(snapshot) {
    const c = snapshot.coordinates;
    const f = (n) => (n / 100).toFixed(2);
    const lines = [
        '[INTERNAL_AFFECT_STATE]',
        `DIMENSIONS: Valence=${f(c.valence)} | Arousal=${f(c.arousal)} | Dominance=${f(c.dominance)}`,
        `ATTRACTOR: ${snapshot.attractorBasin}`,
    ];
    if (snapshot.behavioralDirectives?.length) {
        lines.push('SUGGESTED_TENDENCIES:');
        for (const directive of snapshot.behavioralDirectives)
            lines.push(`  - ${directive}`);
    }
    lines.push('[/INTERNAL_AFFECT_STATE]');
    return lines.join('\n');
}
