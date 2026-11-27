/**
 * Deterministic SHA-256 seeded sampler for 3-Move Character Briefs.
 *
 * Seeded by `sha256("<book>:<chapter>:<date>:<character>[:reroll]")`, so any
 * beat is 100% reproducible and a single beat can be re-rolled cleanly.
 * Applies pre-sampling hard masks, a plausibility floor (default 0.08), and
 * temperature scaling (default 0.85, configurable per beat type).
 */
import crypto from 'node:crypto';
import { findMove } from './brief.js';
export const MOVE_IDS = ['A', 'B', 'C'];
/**
 * Computes the deterministic seed hash and uniform draw `u ∈ [0, 1)`.
 */
export function computeSeed(params) {
    const base = `${params.book}:${params.chapter}:${params.asOf}:${params.character}`;
    const seedInput = params.reroll !== undefined && params.reroll !== '' ? `${base}:${params.reroll}` : base;
    const digest = crypto.createHash('sha256').update(seedInput, 'utf-8').digest();
    const seedHash = digest.toString('hex');
    // 53 bits of IEEE-754 double precision: top 53 bits / 2^53 => [0, 1).
    const hi = digest.readUInt32BE(0);
    const lo = digest.readUInt32BE(4);
    const int53 = hi * 0x200000 + (lo >>> 11); // 32 + 21 = 53 bits
    const u = int53 / 0x20000000000000; // 2^53
    return { seedInput, seedHash, u };
}
function normalize(probs) {
    const sum = probs.A + probs.B + probs.C;
    if (sum <= 0)
        return { A: 0, B: 0, C: 0 };
    return { A: probs.A / sum, B: probs.B / sum, C: probs.C / sum };
}
export function sampleCharacterMove(brief, options) {
    const floor = options.floor ?? 0.08;
    const temperature = options.temperature ?? 0.85;
    if (!(temperature > 0) || !Number.isFinite(temperature)) {
        return { ok: false, error: `Temperature must be a positive finite number; got ${temperature}.` };
    }
    if (floor < 0 || floor > 1 || !Number.isFinite(floor)) {
        return { ok: false, error: `Floor must be in [0, 1]; got ${floor}.` };
    }
    const raw = {
        A: Math.max(0, options.rawProbs.A ?? 0),
        B: Math.max(0, options.rawProbs.B ?? 0),
        C: Math.max(0, options.rawProbs.C ?? 0),
    };
    const rawNorm = normalize(raw);
    // 1. Pre-sampling hard constraint mask
    const maskedMoves = [];
    const maskReasons = {};
    const afterMask = { ...rawNorm };
    for (const id of MOVE_IDS) {
        const m = options.mask?.[id];
        if (m?.masked) {
            maskedMoves.push(id);
            maskReasons[id] = [...m.reasons];
            afterMask[id] = 0;
        }
    }
    const unmaskedIds = MOVE_IDS.filter((id) => !maskedMoves.includes(id));
    if (unmaskedIds.length === 0) {
        return {
            ok: false,
            error: `All 3 candidate moves for ${brief.character} were masked by pre-sampling constraints. Regenerate the brief.`,
        };
    }
    // If all unmasked moves had 0 raw probability, fall back to uniform over unmasked moves.
    const maskSum = afterMask.A + afterMask.B + afterMask.C;
    let surviving = maskSum > 0
        ? normalize(afterMask)
        : normalize({
            A: unmaskedIds.includes('A') ? 1 : 0,
            B: unmaskedIds.includes('B') ? 1 : 0,
            C: unmaskedIds.includes('C') ? 1 : 0,
        });
    // 2. Plausibility floor: drop moves below floor unless ALL surviving moves fall below.
    const floorDroppedMoves = [];
    const aboveFloor = unmaskedIds.filter((id) => surviving[id] >= floor);
    if (aboveFloor.length > 0 && aboveFloor.length < unmaskedIds.length) {
        const filtered = { A: 0, B: 0, C: 0 };
        for (const id of unmaskedIds) {
            if (surviving[id] >= floor)
                filtered[id] = surviving[id];
            else
                floorDroppedMoves.push(id);
        }
        surviving = normalize(filtered);
    }
    // 3. Temperature scaling: p_i^(1/T) / Z
    const powered = { A: 0, B: 0, C: 0 };
    for (const id of MOVE_IDS) {
        if (surviving[id] > 0) {
            powered[id] = Math.pow(surviving[id], 1 / temperature);
        }
    }
    const adjustedProbs = normalize(powered);
    // 4. Deterministic seeded draw
    const { seedInput, seedHash, u } = computeSeed({
        book: brief.book,
        chapter: brief.chapter,
        asOf: brief.asOf,
        character: brief.character,
        reroll: options.reroll,
    });
    let cumulative = 0;
    let chosenMoveId = unmaskedIds[unmaskedIds.length - 1];
    for (const id of MOVE_IDS) {
        const p = adjustedProbs[id];
        if (p <= 0)
            continue;
        cumulative += p;
        if (u < cumulative) {
            chosenMoveId = id;
            break;
        }
    }
    return {
        ok: true,
        log: {
            seedInput,
            seedHash,
            u,
            floor,
            temperature,
            beatType: brief.beatType,
            ...(brief.briefModel ? { briefModel: brief.briefModel } : {}),
            ...(brief.reasoningEffort ? { reasoningEffort: brief.reasoningEffort } : {}),
            reroll: options.reroll,
            scorer: options.scorer ?? 'manual',
            rawProbs: rawNorm,
            maskedMoves,
            maskReasons,
            floorDroppedMoves,
            adjustedProbs,
            chosenMoveId,
            chosenMove: findMove(brief, chosenMoveId),
        },
    };
}
