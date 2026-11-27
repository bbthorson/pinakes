/**
 * Single Narrator Pen Handoff Bundle (`pinakes compose`).
 *
 * Enforces third-person-limited POV structurally in code:
 * - The POV character receives their full winning move (`tactic`, `notice`,
 *   `say`, `holdBack`, `physicalTell`).
 * - Every non-POV character has `notice`, `holdBack`, and `tactic` stripped
 *   before serialization so the Narrator sees ONLY their observable surface
 *   (`say` + `physicalTell`).
 */
import fs from 'fs';
import path from 'path';
export const DEFAULT_NARRATOR_GUIDANCE = [
    'Third-person-limited POV lock: render interiority (`notice`, `holdBack`) ONLY for the POV character. Non-POV characters are represented strictly by observable speech (`say`) and physical tells (`physicalTell`); never head-hop into their private thoughts or unspoken motives.',
    'Avoid brief-to-dialogue seams: integrate each character\'s sampled move organically into conversational turns and scene rhythm rather than splicing a greeting or line into turn two of an already-started exchange.',
    'Respect the observable surface: convey non-POV hesitation, deflection, or subtext solely through phrasing, timing, and physical tells as perceived by the POV character.',
];
function sameCharacter(a, b, aId) {
    const norm = (s) => s.trim().toLowerCase();
    if (norm(a) === norm(b))
        return true;
    if (aId && norm(aId) === norm(b))
        return true;
    return false;
}
/**
 * Strips non-observable fields (`notice`, `holdBack`, `tactic`) from a non-POV
 * character's winning move. Returns a fresh object containing strictly
 * `{ character, characterId?, say, physicalTell }`.
 */
export function stripToObservableSurface(entry) {
    return {
        character: entry.character,
        ...(entry.characterId ? { characterId: entry.characterId } : {}),
        say: entry.move.say,
        physicalTell: entry.move.physicalTell,
    };
}
export function composeNarratorBundle(options) {
    const errors = [];
    if (options.winningMoves.length === 0) {
        return { errors: ['No winning character moves provided.'] };
    }
    const povMatches = options.winningMoves.filter((w) => sameCharacter(w.character, options.povCharacter, w.characterId));
    if (povMatches.length === 0) {
        errors.push(`POV character '${options.povCharacter}' was not found among the provided winning moves.`);
        return { errors };
    }
    if (povMatches.length > 1) {
        errors.push(`Multiple winning moves matched POV character '${options.povCharacter}'.`);
        return { errors };
    }
    const povEntry = povMatches[0];
    const pov = {
        character: povEntry.character,
        ...(povEntry.characterId ? { characterId: povEntry.characterId } : {}),
        id: povEntry.move.id,
        tactic: povEntry.move.tactic,
        notice: povEntry.move.notice,
        say: povEntry.move.say,
        holdBack: povEntry.move.holdBack,
        physicalTell: povEntry.move.physicalTell,
    };
    const others = options.winningMoves
        .filter((w) => w !== povEntry)
        .map(stripToObservableSurface);
    let writingGuide;
    if (options.writingGuidePath) {
        const abs = options.projectRoot
            ? path.resolve(options.projectRoot, options.writingGuidePath)
            : path.resolve(options.writingGuidePath);
        if (!fs.existsSync(abs)) {
            errors.push(`Writing guide not found at ${options.writingGuidePath}.`);
            return { errors };
        }
        writingGuide = {
            path: options.writingGuidePath,
            content: fs.readFileSync(abs, 'utf-8').trim(),
        };
    }
    return {
        errors: [],
        bundle: {
            ...(options.book ? { book: options.book } : {}),
            ...(options.chapter !== undefined ? { chapter: options.chapter } : {}),
            ...(options.asOf ? { asOf: options.asOf } : {}),
            sceneSetup: options.sceneSetup,
            pov,
            others,
            ...(writingGuide ? { writingGuide } : {}),
            narratorGuidance: [...DEFAULT_NARRATOR_GUIDANCE, ...(options.extraGuidance ?? [])],
        },
    };
}
export function renderNarratorBundleMarkdown(bundle) {
    const out = [];
    const meta = [
        bundle.book ? `Book: \`${bundle.book}\`` : null,
        bundle.chapter !== undefined ? `Chapter: \`${bundle.chapter}\`` : null,
        bundle.asOf ? `Date: \`${bundle.asOf}\`` : null,
        `POV: **${bundle.pov.character}**`,
    ]
        .filter(Boolean)
        .join(' | ');
    out.push('# Single Narrator Pen Handoff Bundle', '', meta, '');
    out.push('## Scene Setup', '', bundle.sceneSetup.trim() || '_No scene setup provided._', '');
    out.push(`## POV Character — ${bundle.pov.character} (Full Interiority, Move ${bundle.pov.id})`, '');
    out.push(`- **Tactic:** ${bundle.pov.tactic}`);
    out.push(`- **Notice:** ${bundle.pov.notice}`);
    out.push(`- **Say:** ${bundle.pov.say}`);
    out.push(`- **Hold Back:** ${bundle.pov.holdBack}`);
    out.push(`- **Physical Tell:** ${bundle.pov.physicalTell}`, '');
    out.push('## Non-POV Characters (Observable Surface Only — Interiority Stripped)', '');
    if (bundle.others.length === 0) {
        out.push('_No other characters in this scene._', '');
    }
    else {
        for (const other of bundle.others) {
            out.push(`### ${other.character}`, '');
            out.push(`- **Say:** ${other.say}`);
            out.push(`- **Physical Tell:** ${other.physicalTell}`, '');
        }
    }
    out.push('## Narrator Guidance', '');
    for (const g of bundle.narratorGuidance)
        out.push(`- ${g}`);
    out.push('');
    if (bundle.writingGuide) {
        out.push(`## Writing Guide (\`${bundle.writingGuide.path}\`)`, '', bundle.writingGuide.content, '');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
