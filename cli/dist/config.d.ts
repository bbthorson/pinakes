import { z } from 'zod';
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
}>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function loadConfig(projectRoot: string): {
    config: Config;
    configPath: string;
};
export {};
