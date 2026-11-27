import path from 'path';
import YAML from 'yaml';
import { z } from 'zod';
import { BUILTIN_BASINS, CORE_AFFECT_LABELS, normalizeAffectLabel } from './compiler/affect.js';
import { nodeFS } from './fs.js';
const DEFAULT_RULES = {
    'unresolved-entities': 'error',
    'non-sequential-dates': 'error',
    'missing-date': 'error',
    'co-presence-conflict': 'warning',
    'post-register': 'error',
    'stretch-dates': 'error',
    'stretch-filename': 'error',
    'stretch-duplicate': 'error',
    'stretch-status': 'error',
    'stretch-register': 'error',
    'stretch-source-unresolved': 'error',
    'stretch-source-future': 'error',
    'stretch-length': 'warning',
    'stretch-affect-unresolved': 'error',
    'affect-label-unresolved': 'warning',
    'affect-malformed': 'error',
    'affect-out-of-range': 'error',
    'affect-declared-no-register': 'warning',
    'affect-discontinuity': 'warning',
};
const vadInt = z.number().int().min(-100).max(100);
const bound = z
    .tuple([vadInt, vadInt])
    .refine(([lo, hi]) => lo <= hi, { message: 'a bound is [min, max] with min <= max' });
/**
 * The affect vocabulary and basins, both the universe's to extend. Checked
 * when the config loads, because a collision here would make a label resolve
 * to whichever entry happened to be read last.
 */
const AffectSchema = z
    .object({
    labels: z
        .record(z.object({ v: vadInt, a: vadInt, d: vadInt, aliases: z.array(z.string()).default([]) }))
        .default({}),
    basins: z
        .record(z.object({ when: z.object({ v: bound, a: bound, d: bound }).partial().optional(), directives: z.array(z.string()).optional() }))
        .default({}),
    /**
     * Replay between declarations. Absent means off: the context block shows
     * the latest stretch's affect as declared. There is no default half-life,
     * because a rate nobody chose would be a number that looks like data.
     * `discontinuity` is the distance (scaled units) past which a declaration
     * that disagrees with the replay is reported; unset, it is not checked.
     */
    dynamics: z
        .object({
        halfLifeDays: z.number().positive(),
        discontinuity: z.number().positive().optional(),
    })
        .optional(),
})
    .default({ labels: {}, basins: {} })
    .superRefine((affect, ctx) => {
    const owner = new Map();
    for (const name of Object.keys(affect.labels)) {
        const key = normalizeAffectLabel(name);
        const first = owner.get(key);
        if (first) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['labels', name], message: `Label '${name}' is the same label as '${first}'.` });
        }
        owner.set(key, first ?? name);
    }
    for (const [name, l] of Object.entries(affect.labels)) {
        for (const alias of l.aliases) {
            const key = normalizeAffectLabel(alias);
            const taken = owner.has(key) ? `used by '${owner.get(key)}'` : key in CORE_AFFECT_LABELS ? 'a core label' : undefined;
            if (taken) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['labels', name, 'aliases'],
                    message: `Alias '${alias}' of '${name}' is already ${taken}.`,
                });
            }
            else {
                owner.set(key, name);
            }
        }
    }
    for (const [name, b] of Object.entries(affect.basins)) {
        const builtin = BUILTIN_BASINS.includes(name);
        if (builtin && b.when) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['basins', name, 'when'],
                message: `'${name}' is a built-in basin; its region is fixed. Give it directives, or add a basin under a new name.`,
            });
        }
        if (!builtin && !b.when) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['basins', name], message: `Basin '${name}' is not built in, so it needs \`when\` bounds.` });
        }
        if (!builtin && !b.directives?.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['basins', name], message: `Basin '${name}' needs \`directives\`.` });
        }
    }
});
export const ConfigSchema = z.object({
    spec: z.number().default(0.1),
    project: z.object({
        name: z.string(),
        nsid: z.string(),
        /**
         * Chapter frontmatter key naming the sequence a chapter belongs to — the
         * grouping between "book" and "chapter". Universes name this differently
         * (a meal, an arc, a case, a session), so the key is configurable and the
         * compiled records carry it under the neutral name `sequence`.
         */
        sequenceField: z.string().default('sequence'),
    }),
    paths: z.object({
        registry: z.string().default('codex/entities.yaml'),
        nonEntities: z.string().default('codex/non_entities.yaml'),
        stories: z.string().default('stories'),
        locations: z.string().default('codex/locations'),
        characters: z.string().default('codex/characters'),
        output: z.string().default('records'),
        /**
         * Glob matching the custom rule files, e.g. `rules/*.yaml`. This is a
         * glob, not a directory: a bare `rules` matches the directory itself and
         * loads nothing.
         */
        rules: z.string().optional(),
    }),
    /**
     * Posts are the one authored record type, so they are the one place an author
     * can contradict the prose rather than be derived from it. `publicRegisters`
     * names the register values that permit a character to post at all; every
     * other value means the character is holding something back and should be
     * silent. Which words those are is a property of the universe's own register
     * vocabulary, so it is configured rather than assumed.
     */
    posts: z
        .object({
        publicRegisters: z.array(z.string()).default(['public']),
    })
        .default({ publicRegisters: ['public'] }),
    /**
     * Stretches are the mid tier of character state: how a character would
     * describe the last few weeks, written from one story date and looking only
     * backward from it. Like posts they are authored, and they are emitted only
     * when a story has a `stretches/` directory, so nothing here turns them on.
     *
     * `registers` is the vocabulary a stretch's `register` must come from. Left
     * unset, it is every register first-term the universe's chapters already use,
     * so a stretch cannot name a register no scene has ever been in.
     * `softMaxChars` is the length past which `stretch-length` warns: a stretch is
     * a paragraph, and one that is growing into a summary has stopped being one.
     */
    stretches: z
        .object({
        registers: z.array(z.string()).optional(),
        softMaxChars: z.number().default(600),
    })
        .default({ softMaxChars: 600 }),
    /**
     * What `pinakes context` may show of a character's codex file — the long tier
     * of the as-of bundle.
     *
     * This fails closed. A codex file is written by an author who knows the whole
     * series, so nothing in it is shown unless a heading is named in `include`.
     * With no configuration the long tier is empty, never everything.
     *
     * - `include`: headings whose sections may be shown, matched case-insensitively
     *   as a prefix (`Everyday Life` matches `Everyday Life (working canon)`).
     *   Subsections come along unless excluded.
     * - `exclude`: per character (a registry name), headings inside an included
     *   section to withhold — a series-held secret that lives in its own
     *   subsection. Every entry must match a heading in that character's file, so
     *   a renamed heading fails loudly instead of silently un-withholding.
     * - `excludeParagraphs`: paragraph prefixes to drop wherever they appear, for
     *   held material that shares a section with shown material.
     * - `frontmatter`: codex frontmatter keys that may be shown.
     */
    context: z
        .object({
        /**
         * Whether `pinakes context` prints the affect block. `auto` prints it
         * only for a stretch that declared its affect and landed in a basin;
         * `off` never does, for a universe that wants it out of drafting.
         */
        affect: z.enum(['auto', 'off']).default('auto'),
        codex: z
            .object({
            include: z.array(z.string()).default([]),
            exclude: z.record(z.array(z.string())).default({}),
            excludeParagraphs: z.array(z.string()).default([]),
            frontmatter: z.array(z.string()).default([]),
        })
            .default({ include: [], exclude: {}, excludeParagraphs: [], frontmatter: [] }),
    })
        .default({ affect: 'auto', codex: { include: [], exclude: {}, excludeParagraphs: [], frontmatter: [] } }),
    /**
     * Affect labels (`labels`, integers in [-100, 100], with optional `aliases`)
     * and attractor basins (`basins`: directives for a built-in basin, or `when`
     * bounds plus directives for a new one). See `compiler/affect.ts`.
     */
    affect: AffectSchema,
    /**
     * `prose-check` configuration. Every field is optional: the defaults are the
     * AI-tells catalogue itself, so the command is useful before a universe
     * configures anything.
     *
     * `signals` replaces the built-in list when given — a universe whose voice
     * legitimately earns a catalogued word ("leverage" in a corporate satire,
     * "symphony" in a lyrical one) should not be made to read that column forever.
     * `carveOuts` names terms the voice guide has already catalogued as designed:
     * they are reported for subtraction, never suppressed, because the judgment
     * pass needs both the raw count and the designed share.
     */
    prose: z
        .object({
        signals: z
            .array(z.object({
            label: z.string(),
            pattern: z.string(),
            note: z.string().optional(),
        }))
            .optional(),
        carveOuts: z
            .array(z.object({
            term: z.string(),
            character: z.string().optional(),
            note: z.string().optional(),
        }))
            .default([]),
        closerMaxWords: z.number().default(12),
    })
        .default({ carveOuts: [], closerMaxWords: 12 }),
    /**
     * Optional probabilistic writing and editorial layer configuration.
     * Every field has a safe default so existing universes need not configure it.
     */
    probabilistic: z
        .object({
        scorer: z
            .object({
            provider: z.enum(['clef', 'llm', 'mock']).default('clef'),
            model: z.string().default('@cf/cloudflare/clef'),
            flashModel: z.string().default('@cf/cloudflare/clef-flash'),
            /** Custom Jev-API / Workers AI compatible endpoint URL (overrides Cloudflare account URL). */
            endpoint: z.string().optional(),
            accountIdEnv: z.string().default('CLOUDFLARE_ACCOUNT_ID'),
            apiTokenEnv: z.string().default('CLOUDFLARE_API_TOKEN'),
            llmEndpoint: z.string().optional(),
            llmModel: z.string().optional(),
            llmApiKeyEnv: z.string().default('OPENAI_API_KEY'),
        })
            .default({}),
        sampling: z
            .object({
            floor: z.number().min(0).max(1).default(0.08),
            temperature: z.number().positive().default(0.85),
            beatTemperatures: z.record(z.number().positive()).default({}),
        })
            .default({}),
        /**
         * Optional System-1 vs. System-2 brief generation routing: maps character
         * affect basin, beat type, scope (`main` vs. `guest`), or character name
         * to a recommended `model` and/or `reasoningEffort` (`none` | `low` |
         * `medium` | `high`). First matching rule wins, falling back to `default`.
         */
        briefRouting: z
            .object({
            default: z
                .object({
                model: z.string().optional(),
                reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).optional(),
            })
                .default({}),
            rules: z
                .array(z.object({
                name: z.string().optional(),
                when: z.object({
                    basin: z.union([z.string(), z.array(z.string())]).optional(),
                    beatType: z.union([z.string(), z.array(z.string())]).optional(),
                    scope: z.enum(['main', 'guest']).optional(),
                    character: z.union([z.string(), z.array(z.string())]).optional(),
                }),
                model: z.string().optional(),
                reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).optional(),
            }))
                .default([]),
        })
            .default({}),
        escalation: z
            .object({
            lowConfidence: z.number().min(0).max(1).default(0.35),
            highConfidence: z.number().min(0).max(1).default(0.65),
            leakThreshold: z.number().min(0).max(1).default(0.5),
            toneCeiling: z.number().min(1).max(10).optional(),
        })
            .default({}),
        heldSecrets: z
            .array(z.object({
            id: z.string(),
            description: z.string(),
            terms: z.array(z.string()).default([]),
            patterns: z.array(z.string()).default([]),
            holdUntil: z
                .object({
                book: z.string().optional(),
                chapter: z.number().int().positive().optional(),
                date: z.string().optional(),
            })
                .optional(),
            checkFields: z
                .array(z.enum(['tactic', 'notice', 'say', 'holdBack', 'physicalTell']))
                .default(['say', 'tactic', 'physicalTell']),
        }))
            .default([]),
        doNotReveal: z
            .array(z.object({
            id: z.string(),
            description: z.string(),
            terms: z.array(z.string()).default([]),
            patterns: z.array(z.string()).default([]),
            holdUntil: z
                .object({
                book: z.string().optional(),
                chapter: z.number().int().positive().optional(),
                date: z.string().optional(),
            })
                .optional(),
            checkFields: z
                .array(z.enum(['tactic', 'notice', 'say', 'holdBack', 'physicalTell']))
                .default(['say', 'tactic', 'physicalTell']),
        }))
            .default([]),
        /** Craft-vocabulary words/regexes to flag in review pre-passes (e.g. `red herring(s)?`). */
        craftVocabulary: z.array(z.string()).default(['red herring(?:s)?']),
        review: z
            .object({
            priorChapters: z.number().int().min(0).default(3),
            upcomingChapters: z.number().int().min(1).default(4),
            paths: z
                .object({
                writingGuide: z.string().optional(),
                voiceGuide: z.string().optional(),
                bookBible: z.string().optional(),
                outline: z.string().optional(),
                subplotThreads: z.string().optional(),
                interiorityDir: z.string().optional(),
                seriesArcs: z.string().optional(),
                seriesPlan: z.string().optional(),
                heldSecretPolicy: z.string().optional(),
            })
                .default({}),
        })
            .default({}),
    })
        .default({}),
    /**
     * Per-rule severity. A universe's `rules:` block is merged over the defaults
     * rather than replacing them: setting one rule to `off` must not leave every
     * other rule without a severity, which reported errors as warnings and let
     * `lint` pass.
     */
    rules: z
        .record(z.union([z.literal('error'), z.literal('warning'), z.literal('off')]))
        .default({})
        .transform((rules) => ({ ...DEFAULT_RULES, ...rules })),
});
export function loadConfig(projectRoot, ufs = nodeFS) {
    const possiblePaths = [
        path.join(projectRoot, 'pinakes.yaml'),
        path.join(projectRoot, 'pinakes.yml'),
        path.join(projectRoot, '.pinakes.yaml'),
        path.join(projectRoot, '.pinakes.yml'),
    ];
    let configPath = '';
    let rawContent = '';
    for (const p of possiblePaths) {
        if (ufs.exists(p)) {
            configPath = p;
            rawContent = ufs.readFile(p);
            break;
        }
    }
    if (!configPath) {
        throw new Error(`Could not find pinakes.yaml in ${projectRoot}`);
    }
    const parsed = YAML.parse(rawContent);
    const validated = ConfigSchema.parse(parsed);
    return { config: validated, configPath };
}
