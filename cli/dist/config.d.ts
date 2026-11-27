import { z } from 'zod';
import { type UniverseFS } from './fs.js';
type Severity = 'error' | 'warning' | 'off';
export declare const ConfigSchema: z.ZodObject<{
    spec: z.ZodDefault<z.ZodNumber>;
    project: z.ZodObject<{
        name: z.ZodString;
        nsid: z.ZodString;
        /**
         * Chapter frontmatter key naming the sequence a chapter belongs to — the
         * grouping between "book" and "chapter". Universes name this differently
         * (a meal, an arc, a case, a session), so the key is configurable and the
         * compiled records carry it under the neutral name `sequence`.
         */
        sequenceField: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        nsid: string;
        sequenceField: string;
    }, {
        name: string;
        nsid: string;
        sequenceField?: string | undefined;
    }>;
    paths: z.ZodObject<{
        registry: z.ZodDefault<z.ZodString>;
        nonEntities: z.ZodDefault<z.ZodString>;
        stories: z.ZodDefault<z.ZodString>;
        locations: z.ZodDefault<z.ZodString>;
        characters: z.ZodDefault<z.ZodString>;
        output: z.ZodDefault<z.ZodString>;
        /**
         * Glob matching the custom rule files, e.g. `rules/*.yaml`. This is a
         * glob, not a directory: a bare `rules` matches the directory itself and
         * loads nothing.
         */
        rules: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        registry: string;
        nonEntities: string;
        stories: string;
        locations: string;
        characters: string;
        output: string;
        rules?: string | undefined;
    }, {
        registry?: string | undefined;
        nonEntities?: string | undefined;
        stories?: string | undefined;
        locations?: string | undefined;
        characters?: string | undefined;
        output?: string | undefined;
        rules?: string | undefined;
    }>;
    /**
     * Posts are the one authored record type, so they are the one place an author
     * can contradict the prose rather than be derived from it. `publicRegisters`
     * names the register values that permit a character to post at all; every
     * other value means the character is holding something back and should be
     * silent. Which words those are is a property of the universe's own register
     * vocabulary, so it is configured rather than assumed.
     */
    posts: z.ZodDefault<z.ZodObject<{
        publicRegisters: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        publicRegisters: string[];
    }, {
        publicRegisters?: string[] | undefined;
    }>>;
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
    stretches: z.ZodDefault<z.ZodObject<{
        registers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        softMaxChars: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        softMaxChars: number;
        registers?: string[] | undefined;
    }, {
        registers?: string[] | undefined;
        softMaxChars?: number | undefined;
    }>>;
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
    context: z.ZodDefault<z.ZodObject<{
        /**
         * Whether `pinakes context` prints the affect block. `auto` prints it
         * only for a stretch that declared its affect and landed in a basin;
         * `off` never does, for a universe that wants it out of drafting.
         */
        affect: z.ZodDefault<z.ZodEnum<["auto", "off"]>>;
        codex: z.ZodDefault<z.ZodObject<{
            include: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            exclude: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
            excludeParagraphs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            frontmatter: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            include: string[];
            exclude: Record<string, string[]>;
            excludeParagraphs: string[];
            frontmatter: string[];
        }, {
            include?: string[] | undefined;
            exclude?: Record<string, string[]> | undefined;
            excludeParagraphs?: string[] | undefined;
            frontmatter?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        affect: "off" | "auto";
        codex: {
            include: string[];
            exclude: Record<string, string[]>;
            excludeParagraphs: string[];
            frontmatter: string[];
        };
    }, {
        affect?: "off" | "auto" | undefined;
        codex?: {
            include?: string[] | undefined;
            exclude?: Record<string, string[]> | undefined;
            excludeParagraphs?: string[] | undefined;
            frontmatter?: string[] | undefined;
        } | undefined;
    }>>;
    /**
     * Affect labels (`labels`, integers in [-100, 100], with optional `aliases`)
     * and attractor basins (`basins`: directives for a built-in basin, or `when`
     * bounds plus directives for a new one). See `compiler/affect.ts`.
     */
    affect: z.ZodEffects<z.ZodDefault<z.ZodObject<{
        labels: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            v: z.ZodNumber;
            a: z.ZodNumber;
            d: z.ZodNumber;
            aliases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            v: number;
            a: number;
            d: number;
            aliases: string[];
        }, {
            v: number;
            a: number;
            d: number;
            aliases?: string[] | undefined;
        }>>>;
        basins: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            when: z.ZodOptional<z.ZodObject<{
                v: z.ZodOptional<z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>>;
                a: z.ZodOptional<z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>>;
                d: z.ZodOptional<z.ZodEffects<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, [number, number], [number, number]>>;
            }, "strip", z.ZodTypeAny, {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            }, {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            }>>;
            directives: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }>>>;
        /**
         * Replay between declarations. Absent means off: the context block shows
         * the latest stretch's affect as declared. There is no default half-life,
         * because a rate nobody chose would be a number that looks like data.
         * `discontinuity` is the distance (scaled units) past which a declaration
         * that disagrees with the replay is reported; unset, it is not checked.
         */
        dynamics: z.ZodOptional<z.ZodObject<{
            halfLifeDays: z.ZodNumber;
            discontinuity: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        }, {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        labels: Record<string, {
            v: number;
            a: number;
            d: number;
            aliases: string[];
        }>;
        basins: Record<string, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }>;
        dynamics?: {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        } | undefined;
    }, {
        labels?: Record<string, {
            v: number;
            a: number;
            d: number;
            aliases?: string[] | undefined;
        }> | undefined;
        basins?: Record<string, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }> | undefined;
        dynamics?: {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        } | undefined;
    }>>, {
        labels: Record<string, {
            v: number;
            a: number;
            d: number;
            aliases: string[];
        }>;
        basins: Record<string, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }>;
        dynamics?: {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        } | undefined;
    }, {
        labels?: Record<string, {
            v: number;
            a: number;
            d: number;
            aliases?: string[] | undefined;
        }> | undefined;
        basins?: Record<string, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }> | undefined;
        dynamics?: {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        } | undefined;
    } | undefined>;
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
    prose: z.ZodDefault<z.ZodObject<{
        signals: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            pattern: z.ZodString;
            note: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            pattern: string;
            note?: string | undefined;
        }, {
            label: string;
            pattern: string;
            note?: string | undefined;
        }>, "many">>;
        carveOuts: z.ZodDefault<z.ZodArray<z.ZodObject<{
            term: z.ZodString;
            character: z.ZodOptional<z.ZodString>;
            note: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            term: string;
            note?: string | undefined;
            character?: string | undefined;
        }, {
            term: string;
            note?: string | undefined;
            character?: string | undefined;
        }>, "many">>;
        closerMaxWords: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        carveOuts: {
            term: string;
            note?: string | undefined;
            character?: string | undefined;
        }[];
        closerMaxWords: number;
        signals?: {
            label: string;
            pattern: string;
            note?: string | undefined;
        }[] | undefined;
    }, {
        signals?: {
            label: string;
            pattern: string;
            note?: string | undefined;
        }[] | undefined;
        carveOuts?: {
            term: string;
            note?: string | undefined;
            character?: string | undefined;
        }[] | undefined;
        closerMaxWords?: number | undefined;
    }>>;
    /**
     * Optional probabilistic writing and editorial layer configuration.
     * Every field has a safe default so existing universes need not configure it.
     */
    probabilistic: z.ZodDefault<z.ZodObject<{
        scorer: z.ZodDefault<z.ZodObject<{
            provider: z.ZodDefault<z.ZodEnum<["clef", "llm", "mock"]>>;
            model: z.ZodDefault<z.ZodString>;
            flashModel: z.ZodDefault<z.ZodString>;
            /** Custom Jev-API / Workers AI compatible endpoint URL (overrides Cloudflare account URL). */
            endpoint: z.ZodOptional<z.ZodString>;
            accountIdEnv: z.ZodDefault<z.ZodString>;
            apiTokenEnv: z.ZodDefault<z.ZodString>;
            llmEndpoint: z.ZodOptional<z.ZodString>;
            llmModel: z.ZodOptional<z.ZodString>;
            llmApiKeyEnv: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            provider: "clef" | "llm" | "mock";
            model: string;
            flashModel: string;
            accountIdEnv: string;
            apiTokenEnv: string;
            llmApiKeyEnv: string;
            endpoint?: string | undefined;
            llmEndpoint?: string | undefined;
            llmModel?: string | undefined;
        }, {
            provider?: "clef" | "llm" | "mock" | undefined;
            model?: string | undefined;
            flashModel?: string | undefined;
            endpoint?: string | undefined;
            accountIdEnv?: string | undefined;
            apiTokenEnv?: string | undefined;
            llmEndpoint?: string | undefined;
            llmModel?: string | undefined;
            llmApiKeyEnv?: string | undefined;
        }>>;
        sampling: z.ZodDefault<z.ZodObject<{
            floor: z.ZodDefault<z.ZodNumber>;
            temperature: z.ZodDefault<z.ZodNumber>;
            beatTemperatures: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            floor: number;
            temperature: number;
            beatTemperatures: Record<string, number>;
        }, {
            floor?: number | undefined;
            temperature?: number | undefined;
            beatTemperatures?: Record<string, number> | undefined;
        }>>;
        /**
         * Optional System-1 vs. System-2 brief generation routing: maps character
         * affect basin, beat type, scope (`main` vs. `guest`), or character name
         * to a recommended `model` and/or `reasoningEffort` (`none` | `low` |
         * `medium` | `high`). First matching rule wins, falling back to `default`.
         */
        briefRouting: z.ZodDefault<z.ZodObject<{
            default: z.ZodDefault<z.ZodObject<{
                model: z.ZodOptional<z.ZodString>;
                reasoningEffort: z.ZodOptional<z.ZodEnum<["none", "low", "medium", "high"]>>;
            }, "strip", z.ZodTypeAny, {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }, {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }>>;
            rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodOptional<z.ZodString>;
                when: z.ZodObject<{
                    basin: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
                    beatType: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
                    scope: z.ZodOptional<z.ZodEnum<["main", "guest"]>>;
                    character: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
                }, "strip", z.ZodTypeAny, {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                }, {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                }>;
                model: z.ZodOptional<z.ZodString>;
                reasoningEffort: z.ZodOptional<z.ZodEnum<["none", "low", "medium", "high"]>>;
            }, "strip", z.ZodTypeAny, {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }, {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            rules: {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }[];
            default: {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            };
        }, {
            rules?: {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }[] | undefined;
            default?: {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            } | undefined;
        }>>;
        escalation: z.ZodDefault<z.ZodObject<{
            lowConfidence: z.ZodDefault<z.ZodNumber>;
            highConfidence: z.ZodDefault<z.ZodNumber>;
            leakThreshold: z.ZodDefault<z.ZodNumber>;
            toneCeiling: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            lowConfidence: number;
            highConfidence: number;
            leakThreshold: number;
            toneCeiling?: number | undefined;
        }, {
            lowConfidence?: number | undefined;
            highConfidence?: number | undefined;
            leakThreshold?: number | undefined;
            toneCeiling?: number | undefined;
        }>>;
        heldSecrets: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            description: z.ZodString;
            terms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            patterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            holdUntil: z.ZodOptional<z.ZodObject<{
                book: z.ZodOptional<z.ZodString>;
                chapter: z.ZodOptional<z.ZodNumber>;
                date: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            }, {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            }>>;
            checkFields: z.ZodDefault<z.ZodArray<z.ZodEnum<["tactic", "notice", "say", "holdBack", "physicalTell"]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            description: string;
            terms: string[];
            patterns: string[];
            checkFields: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[];
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
        }, {
            id: string;
            description: string;
            terms?: string[] | undefined;
            patterns?: string[] | undefined;
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
            checkFields?: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[] | undefined;
        }>, "many">>;
        doNotReveal: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            description: z.ZodString;
            terms: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            patterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            holdUntil: z.ZodOptional<z.ZodObject<{
                book: z.ZodOptional<z.ZodString>;
                chapter: z.ZodOptional<z.ZodNumber>;
                date: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            }, {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            }>>;
            checkFields: z.ZodDefault<z.ZodArray<z.ZodEnum<["tactic", "notice", "say", "holdBack", "physicalTell"]>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            description: string;
            terms: string[];
            patterns: string[];
            checkFields: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[];
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
        }, {
            id: string;
            description: string;
            terms?: string[] | undefined;
            patterns?: string[] | undefined;
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
            checkFields?: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[] | undefined;
        }>, "many">>;
        /** Craft-vocabulary words/regexes to flag in review pre-passes (e.g. `red herring(s)?`). */
        craftVocabulary: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        review: z.ZodDefault<z.ZodObject<{
            priorChapters: z.ZodDefault<z.ZodNumber>;
            upcomingChapters: z.ZodDefault<z.ZodNumber>;
            paths: z.ZodDefault<z.ZodObject<{
                writingGuide: z.ZodOptional<z.ZodString>;
                voiceGuide: z.ZodOptional<z.ZodString>;
                bookBible: z.ZodOptional<z.ZodString>;
                outline: z.ZodOptional<z.ZodString>;
                subplotThreads: z.ZodOptional<z.ZodString>;
                interiorityDir: z.ZodOptional<z.ZodString>;
                seriesArcs: z.ZodOptional<z.ZodString>;
                seriesPlan: z.ZodOptional<z.ZodString>;
                heldSecretPolicy: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            }, {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            paths: {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            };
            priorChapters: number;
            upcomingChapters: number;
        }, {
            paths?: {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            } | undefined;
            priorChapters?: number | undefined;
            upcomingChapters?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        scorer: {
            provider: "clef" | "llm" | "mock";
            model: string;
            flashModel: string;
            accountIdEnv: string;
            apiTokenEnv: string;
            llmApiKeyEnv: string;
            endpoint?: string | undefined;
            llmEndpoint?: string | undefined;
            llmModel?: string | undefined;
        };
        sampling: {
            floor: number;
            temperature: number;
            beatTemperatures: Record<string, number>;
        };
        briefRouting: {
            rules: {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }[];
            default: {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            };
        };
        escalation: {
            lowConfidence: number;
            highConfidence: number;
            leakThreshold: number;
            toneCeiling?: number | undefined;
        };
        heldSecrets: {
            id: string;
            description: string;
            terms: string[];
            patterns: string[];
            checkFields: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[];
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
        }[];
        doNotReveal: {
            id: string;
            description: string;
            terms: string[];
            patterns: string[];
            checkFields: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[];
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
        }[];
        craftVocabulary: string[];
        review: {
            paths: {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            };
            priorChapters: number;
            upcomingChapters: number;
        };
    }, {
        scorer?: {
            provider?: "clef" | "llm" | "mock" | undefined;
            model?: string | undefined;
            flashModel?: string | undefined;
            endpoint?: string | undefined;
            accountIdEnv?: string | undefined;
            apiTokenEnv?: string | undefined;
            llmEndpoint?: string | undefined;
            llmModel?: string | undefined;
            llmApiKeyEnv?: string | undefined;
        } | undefined;
        sampling?: {
            floor?: number | undefined;
            temperature?: number | undefined;
            beatTemperatures?: Record<string, number> | undefined;
        } | undefined;
        briefRouting?: {
            rules?: {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }[] | undefined;
            default?: {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            } | undefined;
        } | undefined;
        escalation?: {
            lowConfidence?: number | undefined;
            highConfidence?: number | undefined;
            leakThreshold?: number | undefined;
            toneCeiling?: number | undefined;
        } | undefined;
        heldSecrets?: {
            id: string;
            description: string;
            terms?: string[] | undefined;
            patterns?: string[] | undefined;
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
            checkFields?: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[] | undefined;
        }[] | undefined;
        doNotReveal?: {
            id: string;
            description: string;
            terms?: string[] | undefined;
            patterns?: string[] | undefined;
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
            checkFields?: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[] | undefined;
        }[] | undefined;
        craftVocabulary?: string[] | undefined;
        review?: {
            paths?: {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            } | undefined;
            priorChapters?: number | undefined;
            upcomingChapters?: number | undefined;
        } | undefined;
    }>>;
    /**
     * Per-rule severity. A universe's `rules:` block is merged over the defaults
     * rather than replacing them: setting one rule to `off` must not leave every
     * other rule without a severity, which reported errors as warnings and let
     * `lint` pass.
     */
    rules: z.ZodEffects<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodLiteral<"error">, z.ZodLiteral<"warning">, z.ZodLiteral<"off">]>>>, {
        [x: string]: Severity;
    }, Record<string, "error" | "warning" | "off"> | undefined>;
}, "strip", z.ZodTypeAny, {
    spec: number;
    project: {
        name: string;
        nsid: string;
        sequenceField: string;
    };
    paths: {
        registry: string;
        nonEntities: string;
        stories: string;
        locations: string;
        characters: string;
        output: string;
        rules?: string | undefined;
    };
    rules: {
        [x: string]: Severity;
    };
    posts: {
        publicRegisters: string[];
    };
    stretches: {
        softMaxChars: number;
        registers?: string[] | undefined;
    };
    affect: {
        labels: Record<string, {
            v: number;
            a: number;
            d: number;
            aliases: string[];
        }>;
        basins: Record<string, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }>;
        dynamics?: {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        } | undefined;
    };
    context: {
        affect: "off" | "auto";
        codex: {
            include: string[];
            exclude: Record<string, string[]>;
            excludeParagraphs: string[];
            frontmatter: string[];
        };
    };
    prose: {
        carveOuts: {
            term: string;
            note?: string | undefined;
            character?: string | undefined;
        }[];
        closerMaxWords: number;
        signals?: {
            label: string;
            pattern: string;
            note?: string | undefined;
        }[] | undefined;
    };
    probabilistic: {
        scorer: {
            provider: "clef" | "llm" | "mock";
            model: string;
            flashModel: string;
            accountIdEnv: string;
            apiTokenEnv: string;
            llmApiKeyEnv: string;
            endpoint?: string | undefined;
            llmEndpoint?: string | undefined;
            llmModel?: string | undefined;
        };
        sampling: {
            floor: number;
            temperature: number;
            beatTemperatures: Record<string, number>;
        };
        briefRouting: {
            rules: {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }[];
            default: {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            };
        };
        escalation: {
            lowConfidence: number;
            highConfidence: number;
            leakThreshold: number;
            toneCeiling?: number | undefined;
        };
        heldSecrets: {
            id: string;
            description: string;
            terms: string[];
            patterns: string[];
            checkFields: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[];
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
        }[];
        doNotReveal: {
            id: string;
            description: string;
            terms: string[];
            patterns: string[];
            checkFields: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[];
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
        }[];
        craftVocabulary: string[];
        review: {
            paths: {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            };
            priorChapters: number;
            upcomingChapters: number;
        };
    };
}, {
    project: {
        name: string;
        nsid: string;
        sequenceField?: string | undefined;
    };
    paths: {
        registry?: string | undefined;
        nonEntities?: string | undefined;
        stories?: string | undefined;
        locations?: string | undefined;
        characters?: string | undefined;
        output?: string | undefined;
        rules?: string | undefined;
    };
    spec?: number | undefined;
    rules?: Record<string, "error" | "warning" | "off"> | undefined;
    posts?: {
        publicRegisters?: string[] | undefined;
    } | undefined;
    stretches?: {
        registers?: string[] | undefined;
        softMaxChars?: number | undefined;
    } | undefined;
    affect?: {
        labels?: Record<string, {
            v: number;
            a: number;
            d: number;
            aliases?: string[] | undefined;
        }> | undefined;
        basins?: Record<string, {
            when?: {
                v?: [number, number] | undefined;
                a?: [number, number] | undefined;
                d?: [number, number] | undefined;
            } | undefined;
            directives?: string[] | undefined;
        }> | undefined;
        dynamics?: {
            halfLifeDays: number;
            discontinuity?: number | undefined;
        } | undefined;
    } | undefined;
    context?: {
        affect?: "off" | "auto" | undefined;
        codex?: {
            include?: string[] | undefined;
            exclude?: Record<string, string[]> | undefined;
            excludeParagraphs?: string[] | undefined;
            frontmatter?: string[] | undefined;
        } | undefined;
    } | undefined;
    prose?: {
        signals?: {
            label: string;
            pattern: string;
            note?: string | undefined;
        }[] | undefined;
        carveOuts?: {
            term: string;
            note?: string | undefined;
            character?: string | undefined;
        }[] | undefined;
        closerMaxWords?: number | undefined;
    } | undefined;
    probabilistic?: {
        scorer?: {
            provider?: "clef" | "llm" | "mock" | undefined;
            model?: string | undefined;
            flashModel?: string | undefined;
            endpoint?: string | undefined;
            accountIdEnv?: string | undefined;
            apiTokenEnv?: string | undefined;
            llmEndpoint?: string | undefined;
            llmModel?: string | undefined;
            llmApiKeyEnv?: string | undefined;
        } | undefined;
        sampling?: {
            floor?: number | undefined;
            temperature?: number | undefined;
            beatTemperatures?: Record<string, number> | undefined;
        } | undefined;
        briefRouting?: {
            rules?: {
                when: {
                    character?: string | string[] | undefined;
                    basin?: string | string[] | undefined;
                    beatType?: string | string[] | undefined;
                    scope?: "main" | "guest" | undefined;
                };
                name?: string | undefined;
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            }[] | undefined;
            default?: {
                model?: string | undefined;
                reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;
            } | undefined;
        } | undefined;
        escalation?: {
            lowConfidence?: number | undefined;
            highConfidence?: number | undefined;
            leakThreshold?: number | undefined;
            toneCeiling?: number | undefined;
        } | undefined;
        heldSecrets?: {
            id: string;
            description: string;
            terms?: string[] | undefined;
            patterns?: string[] | undefined;
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
            checkFields?: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[] | undefined;
        }[] | undefined;
        doNotReveal?: {
            id: string;
            description: string;
            terms?: string[] | undefined;
            patterns?: string[] | undefined;
            holdUntil?: {
                date?: string | undefined;
                book?: string | undefined;
                chapter?: number | undefined;
            } | undefined;
            checkFields?: ("tactic" | "notice" | "say" | "holdBack" | "physicalTell")[] | undefined;
        }[] | undefined;
        craftVocabulary?: string[] | undefined;
        review?: {
            paths?: {
                writingGuide?: string | undefined;
                voiceGuide?: string | undefined;
                bookBible?: string | undefined;
                outline?: string | undefined;
                subplotThreads?: string | undefined;
                interiorityDir?: string | undefined;
                seriesArcs?: string | undefined;
                seriesPlan?: string | undefined;
                heldSecretPolicy?: string | undefined;
            } | undefined;
            priorChapters?: number | undefined;
            upcomingChapters?: number | undefined;
        } | undefined;
    } | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function loadConfig(projectRoot: string, ufs?: UniverseFS): {
    config: Config;
    configPath: string;
};
export {};
