/**
 * Keystatic CMS integration for Pinakes universes.
 *
 * Provides schema and collection generators that map Pinakes' creative layer
 * (chapters, posts, stretches, characters, places, items) directly into
 * Keystatic collections.
 */
export interface PinakesKeystaticOptions {
    /** Path to story directory relative to keystatic.config.ts (e.g. '../stories/01-missing-hot-sauce') */
    storyDir: string;
    /** Book URL slug (e.g. 'missing-hot-sauce') */
    bookSlug?: string;
    /** Path to codex directory relative to keystatic.config.ts (defaults to '../codex') */
    codexDir?: string;
}
/**
 * Field definitions for a Pinakes narrative chapter.
 */
export declare function chapterFields(fields: any): {
    chapterNumber: any;
    title: any;
    chapter: any;
    meal: any;
    date: any;
    day: any;
    time: any;
    pov: any;
    location: any;
    characters_present: any;
    characters_referenced: any;
    items_present: any;
    custody: any;
    beat: any;
    register: any;
    publishDate: any;
    content: any;
};
/**
 * Field definitions for in-universe character posts.
 */
export declare function postFields(fields: any): {
    filename: any;
    character: any;
    date: any;
    time: any;
    replyTo: any;
    tags: any;
    content: any;
};
/**
 * Field definitions for character dossiers.
 */
export declare function characterFields(fields: any): {
    id: any;
    name: any;
    status: any;
    did: any;
    handle: any;
    blurbPublic: any;
    personaPublic: any;
    content: any;
};
/**
 * Field definitions for places and locations.
 */
export declare function placeFields(fields: any): {
    id: any;
    name: any;
    status: any;
    location: any;
    foursquare: any;
    hoursPublic: any;
    content: any;
};
/**
 * Field definitions for story items.
 */
export declare function itemFields(fields: any): {
    id: any;
    name: any;
    status: any;
    content: any;
};
/**
 * Creates Keystatic collection configurations for a Pinakes universe.
 *
 * @param fields The `fields` export from `@keystatic/core`
 * @param options Universe paths and slugs
 */
export declare function createPinakesCollections(fields: any, options: PinakesKeystaticOptions): {
    chapters: {
        label: string;
        slugField: string;
        path: string;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        previewUrl: string;
        schema: {
            chapterNumber: any;
            title: any;
            chapter: any;
            meal: any;
            date: any;
            day: any;
            time: any;
            pov: any;
            location: any;
            characters_present: any;
            characters_referenced: any;
            items_present: any;
            custody: any;
            beat: any;
            register: any;
            publishDate: any;
            content: any;
        };
    };
    posts: {
        label: string;
        slugField: string;
        path: string;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        schema: {
            filename: any;
            character: any;
            date: any;
            time: any;
            replyTo: any;
            tags: any;
            content: any;
        };
    };
    characters: {
        label: string;
        slugField: string;
        path: string;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        previewUrl: string;
        schema: {
            id: any;
            name: any;
            status: any;
            did: any;
            handle: any;
            blurbPublic: any;
            personaPublic: any;
            content: any;
        };
    };
    places: {
        label: string;
        slugField: string;
        path: string;
        format: {
            contentField: string;
        };
        entryLayout: "content";
        previewUrl: string;
        schema: {
            id: any;
            name: any;
            status: any;
            location: any;
            foursquare: any;
            hoursPublic: any;
            content: any;
        };
    };
    items: {
        label: string;
        slugField: string;
        path: string;
        format: {
            contentField: string;
        };
        schema: {
            id: any;
            name: any;
            status: any;
            content: any;
        };
    };
};
