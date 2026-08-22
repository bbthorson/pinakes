/**
 * Lexicon schema documents for the record types `pinakes compile` emits.
 *
 * These are ordinary AT Protocol Lexicon JSON documents, generated per-project
 * because the NSID authority comes from `pinakes.yaml` (`project.nsid`) — one
 * universe publishes `site.supperclub.scene`, another publishes
 * `com.example.scene`. They are the portable contract for a universe's records:
 * committed alongside the compiled output, installable by any consumer with
 * `lex install`, and — via `compile.ts` — the thing every record is validated
 * against before it is written.
 */
/** A local id (`char.emma`, `place.mcgolrick-market`, `scene.book1.ch1`). */
const localId = (description) => ({
    type: 'string',
    description,
    maxLength: 256,
});
/**
 * Record keys in a repository are the record's own `id`, so every record type
 * uses `key: 'any'` rather than `tid` — a scene's identity is its stable story
 * coordinate (`scene.book1.ch1`), not its creation order.
 */
const RECORD_KEY = 'any';
export function buildLexiconDocs(nsid) {
    return [scene(nsid), stateEvent(nsid), profile(nsid), place(nsid)];
}
function scene(ns) {
    return {
        lexicon: 1,
        id: `${ns}.scene`,
        description: 'A dated scene in the narrative timeline, projected from one or more chapters.',
        defs: {
            main: {
                type: 'record',
                key: RECORD_KEY,
                description: 'A scene record.',
                record: {
                    type: 'object',
                    required: ['id', 'storyDate', 'chapterRefs', 'title', 'createdAt', 'sourceFile'],
                    properties: {
                        id: localId('Stable scene id, e.g. `scene.book1.ch1`. Doubles as the record key.'),
                        storyDate: {
                            type: 'string',
                            description: 'In-story calendar date, `YYYY-MM-DD`. Story time, not wall-clock time.',
                            maxLength: 10,
                        },
                        storyDateEnd: {
                            type: 'string',
                            description: 'End of the in-story span when the scene covers more than one date.',
                            maxLength: 10,
                        },
                        chapterRefs: {
                            type: 'array',
                            description: 'Chapters this scene is projected from, e.g. `book1#ch1`.',
                            items: { type: 'string', maxLength: 256 },
                            minLength: 1,
                        },
                        title: { type: 'string', description: 'Chapter or scene title.', maxLength: 512 },
                        part: { type: 'integer', description: 'Structural part / act number.', minimum: 0 },
                        sequence: {
                            type: 'integer',
                            description: 'The sequence within the book that this scene belongs to — the grouping between book and chapter. Sourced from the frontmatter key named by `project.sequenceField`.',
                            minimum: 0,
                        },
                        beat: { type: 'string', description: 'Story beat label.', maxLength: 512 },
                        placeRefs: {
                            type: 'array',
                            description: 'Registry ids of resolved locations.',
                            items: localId('A place id.'),
                        },
                        placeText: {
                            type: 'array',
                            description: 'Unresolved location names kept as prose (known non-entities).',
                            items: { type: 'string', maxLength: 512 },
                        },
                        pov: localId('Registry id of the point-of-view character.'),
                        participants: {
                            type: 'array',
                            description: 'Characters physically present in the scene.',
                            items: localId('A character id.'),
                        },
                        referenced: {
                            type: 'array',
                            description: 'Characters mentioned but not present.',
                            items: localId('A character id.'),
                        },
                        primaryEvent: {
                            type: 'string',
                            description: 'One-line summary of what the scene accomplishes.',
                            maxLength: 3000,
                        },
                        createdAt: {
                            type: 'string',
                            description: 'Story time as an RFC3339 datetime (midnight UTC on `storyDate`). Fictional records are ordered by story time, not authoring time.',
                            format: 'datetime',
                        },
                        sourceFile: {
                            type: 'string',
                            description: 'Repository-relative path of the chapter this was projected from.',
                            maxLength: 1024,
                        },
                    },
                },
            },
        },
    };
}
function stateEvent(ns) {
    return {
        lexicon: 1,
        id: `${ns}.character.stateEvent`,
        description: "A change in a character's emotional or social register at a point in story time.",
        defs: {
            main: {
                type: 'record',
                key: RECORD_KEY,
                description: 'A character state event record.',
                record: {
                    type: 'object',
                    required: [
                        'id',
                        'subject',
                        'storyDate',
                        'register',
                        'state',
                        'chapterRef',
                        'sceneRef',
                        'createdAt',
                        'sourceFile',
                    ],
                    properties: {
                        id: localId('Stable event id, e.g. `stateEvent.emma.book1.ch1`.'),
                        subject: localId('Registry id of the character this event describes.'),
                        storyDate: { type: 'string', description: 'In-story date, `YYYY-MM-DD`.', maxLength: 10 },
                        storyDateEnd: { type: 'string', description: 'End of the in-story span.', maxLength: 10 },
                        register: {
                            type: 'string',
                            description: 'The register the character is in — the first term of the expression.',
                            maxLength: 128,
                        },
                        registerExpr: {
                            type: 'string',
                            description: 'Full register expression when it encodes a transition, e.g. `guarded -> open`.',
                            maxLength: 512,
                        },
                        state: {
                            type: 'string',
                            description: 'Verbatim register annotation from the chapter frontmatter.',
                            maxLength: 1024,
                        },
                        chapterRef: { type: 'string', description: 'Source chapter, e.g. `book1#ch1`.', maxLength: 256 },
                        sceneRef: localId('Scene record this event belongs to.'),
                        createdAt: { type: 'string', description: 'Story time as an RFC3339 datetime.', format: 'datetime' },
                        sourceFile: { type: 'string', description: 'Repository-relative chapter path.', maxLength: 1024 },
                    },
                },
            },
        },
    };
}
function profile(ns) {
    return {
        lexicon: 1,
        id: `${ns}.character.profile`,
        description: 'The public-facing identity of a character in the universe.',
        defs: {
            main: {
                type: 'record',
                key: RECORD_KEY,
                description: 'A character profile record.',
                record: {
                    type: 'object',
                    required: ['id', 'subject', 'displayName', 'sourceFile'],
                    properties: {
                        id: localId('Stable profile id, e.g. `profile.emma`.'),
                        subject: localId('Registry id of the character, e.g. `char.emma`.'),
                        displayName: { type: 'string', description: 'Name as readers see it.', maxLength: 640 },
                        handle: {
                            type: 'string',
                            description: "The character's handle, without an `@`. A bare label such as `emmacooks` until the universe is bound to a domain; consumers qualify it themselves.",
                            maxLength: 253,
                        },
                        oneLine: {
                            type: 'string',
                            description: "One-line character summary, lifted from the codex file's Overview.",
                            maxLength: 3000,
                        },
                        sourceFile: { type: 'string', description: 'Repository-relative codex path.', maxLength: 1024 },
                    },
                },
            },
        },
    };
}
function place(ns) {
    return {
        lexicon: 1,
        id: `${ns}.place`,
        description: 'A location in the universe.',
        defs: {
            main: {
                type: 'record',
                key: RECORD_KEY,
                description: 'A place record.',
                record: {
                    type: 'object',
                    required: ['id', 'name', 'status', 'sourceFile'],
                    properties: {
                        id: localId('Stable place id, e.g. `place.mcgolrick-market`.'),
                        name: { type: 'string', description: 'Display name.', maxLength: 640 },
                        status: {
                            type: 'string',
                            description: 'Lifecycle of the location within the series.',
                            maxLength: 64,
                        },
                        region: {
                            type: 'string',
                            description: 'Neighborhood, district, or region containing the place.',
                            maxLength: 256,
                        },
                        firstAppearance: {
                            type: 'string',
                            description: 'Where the place first appears, e.g. `Book 1, Chapter 8`.',
                            maxLength: 256,
                        },
                        schedule: { type: 'ref', description: 'Opening hours, when the place keeps any.', ref: '#schedule' },
                        sourceFile: { type: 'string', description: 'Repository-relative codex path.', maxLength: 1024 },
                    },
                },
            },
            schedule: {
                type: 'object',
                description: 'When a location is open.',
                properties: {
                    days: {
                        type: 'array',
                        description: 'Days of the week the place operates.',
                        items: { type: 'string', maxLength: 32 },
                    },
                    hours: { type: 'string', description: 'Human-readable hours.', maxLength: 256 },
                    note: { type: 'string', description: 'Caveat or seasonal exception.', maxLength: 512 },
                },
            },
        },
    };
}
