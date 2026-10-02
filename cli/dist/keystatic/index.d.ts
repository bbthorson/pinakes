/**
 * Keystatic CMS collections for a Pinakes universe: chapters, posts,
 * stretches, and the character, place and item codex files.
 *
 * Keystatic is strict about frontmatter (@keystatic/core 0.5): **an entry
 * whose file has a key the schema does not name will not open** ("Key on object
 * value ... is not allowed"), and a save writes only the schema's keys. The
 * first version of these schemas named keys Pinakes never reads and missed
 * ones it does, so every Supper Club Secrets chapter, post, character and
 * place failed to open, and entries created in the CMS came out wrong: post
 * authors under `character` rather than `author`, a single `register` string
 * rather than the `registers:` map, `did`/`handle` in codex frontmatter (which
 * `lint` rejects), places with no `id`.
 *
 * So each schema here names exactly the keys Pinakes reads, as fields that
 * round-trip them unchanged:
 *
 * - A value Keystatic can edit without reshaping it gets an editable field.
 * - A value it cannot model (a map keyed by character name, a label-or-numbers
 *   union, an object) gets `fields.ignored()`: kept exactly as written, and
 *   edited in the file rather than the CMS.
 * - Keys only a universe uses (its own `clues:`, `day:`, public blurbs) are the
 *   universe's to declare, through `extraFields`. An entry with an undeclared
 *   key will not open, which is Keystatic's behaviour and at least never
 *   silent.
 *
 * The one change a save makes to a value Pinakes reads is cosmetic: an absent
 * list field is written as `[]`.
 *
 * This module must stay free of Node imports: Keystatic bundles its config
 * into the browser.
 */
export type PinakesCollectionName = 'chapters' | 'posts' | 'stretches' | 'characters' | 'places' | 'items';
export interface PinakesKeystaticOptions {
    /**
     * Path to the story directory from the repository root (e.g.
     * 'stories/01-missing-hot-sauce'). Keystatic resolves collection paths from
     * where it reads and writes: the repository root in GitHub mode, and the
     * folder the dev server runs in in local mode. Neither reaches above it, so a
     * path starting '../' finds nothing.
     */
    storyDir: string;
    /** Book URL slug for chapter previews (e.g. 'missing-hot-sauce'). */
    bookSlug?: string;
    /** Path to the codex directory from the repository root, as `storyDir`. Defaults to 'codex'. */
    codexDir?: string;
    /**
     * The chapter frontmatter key naming a chapter's sequence: the universe's
     * `project.sequenceField` in pinakes.yaml. Defaults to `sequence`, as there.
     */
    sequenceField?: string;
    /**
     * Fields for frontmatter keys the universe uses and Pinakes does not read,
     * per collection. Every key an entry's file carries must be named somewhere,
     * or Keystatic will not open the entry; use `fields.ignored()` for one that
     * should be kept but not edited. A key Pinakes already names is rejected,
     * since redefining it could reshape a value Pinakes reads.
     */
    extraFields?: Partial<Record<PinakesCollectionName, Record<string, any>>>;
}
/** Chapter frontmatter, as `pinakes lint` and `compile` read it. */
export declare function chapterFields(fields: any, options?: {
    sequenceField?: string;
}): {
    [x: string]: any;
    title: any;
    chapter: any;
    part: any;
    date: any;
    publishDate: any;
    location: any;
    pov: any;
    characters_present: any;
    characters_referenced: any;
    registers: any;
    affect: any;
    custody: any;
    beat: any;
    beat_purpose: any;
    tags: any;
    content: any;
};
/** Authored in-character posts. */
export declare function postFields(fields: any): {
    date: any;
    author: any;
    chapter: any;
    time: any;
    publish: any;
    reply_to: any;
    mentions: any;
    location: any;
    tags: any;
    note: any;
    content: any;
};
/** Character stretches: `stretches/<character-slug>/<asOf>.md`. */
export declare function stretchFields(fields: any): {
    asOf: any;
    character: any;
    since: any;
    register: any;
    status: any;
    carrying: any;
    sources: any;
    affect: any;
    note: any;
    content: any;
};
/**
 * Character codex files. A character's identity (`id`, `displayName`, `did`,
 * `handle`) lives on their registry entry, not here: `lint` rejects a `did` or
 * `handle` in codex frontmatter.
 */
export declare function characterFields(fields: any): {
    title: any;
    description: any;
    status: any;
    tags: any;
    affectBaseline: any;
    affectHalfLifeScale: any;
    content: any;
};
/** Location codex files. */
export declare function placeFields(fields: any): {
    title: any;
    id: any;
    description: any;
    status: any;
    region: any;
    neighborhood: any;
    first_appearance: any;
    tags: any;
    schedule: any;
    content: any;
};
/** Item codex files. An item's identity lives on its registry entry. */
export declare function itemFields(fields: any): {
    title: any;
    description: any;
    tags: any;
    content: any;
};
/**
 * Keystatic collections for a Pinakes universe.
 *
 * @param fields The `fields` export from `@keystatic/core`
 * @param options Universe paths, the sequence key, and the universe's own fields
 */
export declare function createPinakesCollections(fields: any, options: PinakesKeystaticOptions): {
    chapters: {
        previewUrl: string;
        schema: {
            [x: string]: any;
            title: any;
            chapter: any;
            part: any;
            date: any;
            publishDate: any;
            location: any;
            pov: any;
            characters_present: any;
            characters_referenced: any;
            registers: any;
            affect: any;
            custody: any;
            beat: any;
            beat_purpose: any;
            tags: any;
            content: any;
        } & Record<string, any>;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        label: string;
        slugField: string;
        path: `${string}/chapters/*`;
    };
    posts: {
        schema: {
            date: any;
            author: any;
            chapter: any;
            time: any;
            publish: any;
            reply_to: any;
            mentions: any;
            location: any;
            tags: any;
            note: any;
            content: any;
        } & Record<string, any>;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        label: string;
        slugField: string;
        path: `${string}/posts/*`;
    };
    stretches: {
        schema: {
            asOf: any;
            character: any;
            since: any;
            register: any;
            status: any;
            carrying: any;
            sources: any;
            affect: any;
            note: any;
            content: any;
        } & Record<string, any>;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        label: string;
        slugField: string;
        path: `${string}/stretches/**`;
    };
    characters: {
        previewUrl: string;
        schema: {
            title: any;
            description: any;
            status: any;
            tags: any;
            affectBaseline: any;
            affectHalfLifeScale: any;
            content: any;
        } & Record<string, any>;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        label: string;
        slugField: string;
        path: `${string}/characters/*`;
    };
    places: {
        previewUrl: string;
        schema: {
            title: any;
            id: any;
            description: any;
            status: any;
            region: any;
            neighborhood: any;
            first_appearance: any;
            tags: any;
            schedule: any;
            content: any;
        } & Record<string, any>;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        label: string;
        slugField: string;
        path: `${string}/locations/*`;
    };
    items: {
        schema: {
            title: any;
            description: any;
            tags: any;
            content: any;
        } & Record<string, any>;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        label: string;
        slugField: string;
        path: `${string}/items/*`;
    };
};
