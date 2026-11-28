import { buildContext, renderMarkdown } from '../context/bundle.js';
import { compareBookChapter } from '../compiler/first-appearances.js';
function matchesFilter(value, expected) {
    if (expected === undefined)
        return true;
    if (!value)
        return false;
    const list = Array.isArray(expected) ? expected : [expected];
    const low = value.trim().toLowerCase();
    return list.some((e) => e.trim().toLowerCase() === low);
}
/**
 * Resolves the recommended model and reasoning effort for generating a
 * character's 3-Move Brief based on `probabilistic.briefRouting` rules
 * (affect attractor basin, beat type, main vs. guest scope, or character).
 */
export function resolveBriefRoute(config, input) {
    const routing = config.probabilistic.briefRouting;
    const baseModel = routing.default.model;
    const baseEffort = routing.default.reasoningEffort;
    for (let i = 0; i < routing.rules.length; i++) {
        const rule = routing.rules[i];
        const w = rule.when;
        const basinOk = matchesFilter(input.basin, w.basin);
        const beatOk = matchesFilter(input.beatType, w.beatType);
        const scopeOk = w.scope === undefined || w.scope === input.scope;
        const charOk = w.character === undefined ||
            matchesFilter(input.characterId, w.character) ||
            matchesFilter(input.characterName, w.character);
        if (basinOk && beatOk && scopeOk && charOk) {
            const label = rule.name ?? `rule[${i}]`;
            return {
                model: rule.model ?? baseModel,
                reasoningEffort: rule.reasoningEffort ?? baseEffort,
                matchedRule: label,
                reason: `Matched briefRouting rule '${label}' (basin=${input.basin ?? 'none'}, beatType=${input.beatType ?? 'none'}, scope=${input.scope})`,
            };
        }
    }
    return {
        model: baseModel,
        reasoningEffort: baseEffort,
        reason: baseModel || baseEffort
            ? 'Used probabilistic.briefRouting.default'
            : 'No briefRouting rules configured',
    };
}
export const THREE_MOVE_BRIEF_CONTRACT = [
    'Produce a JSON object matching the 3-Move Character Brief schema:',
    '{',
    '  "character": "<character name or id>",',
    '  "asOf": "<YYYY-MM-DD>",',
    '  "book": "<book key>",',
    '  "chapter": <chapter number>,',
    '  "moves": [',
    '    { "id": "A", "tactic": "characteristic move", "notice": "...", "say": "...", "holdBack": "...", "physicalTell": "..." },',
    '    { "id": "B", "tactic": "secondary contradiction-engine side", "notice": "...", "say": "...", "holdBack": "...", "physicalTell": "..." },',
    '    { "id": "C", "tactic": "guarded or lateral angle", "notice": "...", "say": "...", "holdBack": "...", "physicalTell": "..." }',
    '  ]',
    '}',
    'Stay strictly inside what this character knows as of the date above. Never invent or anticipate future plot beats.',
].join('\n');
export function buildSceneBriefBundles(root, config, registry, engine, records, req) {
    const bundles = [];
    const errors = [];
    for (const name of req.characters) {
        // Hardcoded `fullState: false`: Scene-Mode firewall enforced in code.
        const res = buildContext(root, config, registry, engine, records, name, req.asOf, {
            fullState: false,
            story: req.story,
            registryFallback: true,
        });
        if (!res.bundle) {
            errors.push(...res.errors);
            continue;
        }
        const route = resolveBriefRoute(config, {
            characterId: res.bundle.character.id,
            characterName: res.bundle.character.displayName,
            basin: res.bundle.affect?.state?.attractorBasin,
            beatType: req.beatType,
            scope: res.bundle.long.sourceScope === 'series' ? 'main' : 'guest',
        });
        bundles.push({
            character: res.bundle.character,
            asOf: req.asOf,
            book: req.book,
            chapter: req.chapter,
            ...(req.beatType ? { beatType: req.beatType } : {}),
            route,
            context: res.bundle,
            contextMarkdown: renderMarkdown(res.bundle),
            sceneSetup: req.sceneSetup,
            briefContract: THREE_MOVE_BRIEF_CONTRACT,
        });
    }
    return { bundles, errors };
}
export function renderCharacterBriefPrompt(bundle) {
    const routeBits = [
        bundle.route.model ? `Model: \`${bundle.route.model}\`` : null,
        bundle.route.reasoningEffort ? `Reasoning: \`${bundle.route.reasoningEffort}\`` : null,
        bundle.route.matchedRule ? `Rule: \`${bundle.route.matchedRule}\`` : null,
    ].filter(Boolean);
    return [
        `# Scene-Mode Brief Input — ${bundle.character.displayName}`,
        '',
        `Book: \`${bundle.book}\` | Chapter: \`${bundle.chapter}\` | Date: \`${bundle.asOf}\`${bundle.beatType ? ` | Beat: \`${bundle.beatType}\`` : ''}`,
        ...(routeBits.length ? [`Routing: ${routeBits.join(' | ')}`] : []),
        '',
        '## Scene Setup',
        '',
        bundle.sceneSetup.trim() || '_No scene setup provided._',
        '',
        '## Character Context (Scene-Mode Firewall: Backward-Only, No Author State)',
        '',
        bundle.contextMarkdown.trim(),
        '',
        '## Required Output Contract (3-Move Character Brief)',
        '',
        '```text',
        bundle.briefContract,
        '```',
        '',
    ].join('\n');
}
/**
 * Whether a `doNotReveal` / `heldSecret` rule is still active (held) at
 * `(book, chapter, asOf)`. Fails closed: if `holdUntil` is omitted, the rule
 * is always active.
 */
export function isConstraintActive(rule, target) {
    const h = rule.holdUntil;
    if (!h)
        return true;
    if (h.date && target.asOf < h.date)
        return true;
    if (h.book && h.chapter !== undefined) {
        return compareBookChapter({ book: target.book, chapter: target.chapter }, { book: h.book, chapter: h.chapter }) < 0;
    }
    if (h.chapter !== undefined) {
        const chNum = typeof target.chapter === 'number' ? target.chapter : Number(target.chapter);
        if (Number.isFinite(chNum))
            return chNum < h.chapter;
        return true;
    }
    if (h.book) {
        return compareBookChapter({ book: target.book, chapter: 1 }, { book: h.book, chapter: 1 }) < 0;
    }
    return false;
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Evaluates active `doNotReveal` / `heldSecrets` rules deterministically
 * against each move in a 3-Move Character Brief before sampling.
 */
export function evaluateDeterministicMask(brief, rules) {
    const active = rules.filter((r) => isConstraintActive(r, { book: brief.book, chapter: brief.chapter, asOf: brief.asOf }));
    const out = {
        A: { moveId: 'A', masked: false, reasons: [] },
        B: { moveId: 'B', masked: false, reasons: [] },
        C: { moveId: 'C', masked: false, reasons: [] },
    };
    for (const move of brief.moves) {
        const reasons = [];
        for (const rule of active) {
            const fields = rule.checkFields?.length ? rule.checkFields : ['say', 'tactic', 'physicalTell'];
            const haystack = fields.map((f) => move[f] ?? '').join('\n');
            let matched = false;
            for (const term of rule.terms ?? []) {
                if (!term.trim())
                    continue;
                const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(term.trim())}(?![\\p{L}\\p{N}_])`, 'iu');
                if (re.test(haystack)) {
                    reasons.push(`[${rule.id}] matched held term "${term}" (${rule.description})`);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                for (const pat of rule.patterns ?? []) {
                    if (!pat)
                        continue;
                    try {
                        const re = new RegExp(pat, 'iu');
                        if (re.test(haystack)) {
                            reasons.push(`[${rule.id}] matched held pattern /${pat}/ (${rule.description})`);
                            break;
                        }
                    }
                    catch {
                        // Fail closed on invalid regex in a constraint rule.
                        reasons.push(`[${rule.id}] invalid constraint regex /${pat}/ (failed closed)`);
                        break;
                    }
                }
            }
        }
        out[move.id] = { moveId: move.id, masked: reasons.length > 0, reasons };
    }
    return out;
}
/** Combines `heldSecrets` and `doNotReveal` from `config.probabilistic` with any caller overrides. */
export function collectConstraintRules(config, extra = []) {
    return [...config.probabilistic.heldSecrets, ...config.probabilistic.doNotReveal, ...extra];
}
export function findMove(brief, id) {
    const found = brief.moves.find((m) => m.id === id);
    if (!found)
        throw new Error(`Move '${id}' not found in brief for ${brief.character}`);
    return found;
}
