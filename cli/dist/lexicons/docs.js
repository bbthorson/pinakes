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
 * Free-form labels carried through from the source file's `tags` frontmatter.
 * They are the author's own vocabulary — `main-cast`, `location` — so nothing
 * here constrains the values.
 */
const tags = (description) => ({
    type: 'array',
    description,
    items: { type: 'string', maxLength: 128 },
});
/**
 * Record keys in a repository are the record's own `id`, so every record type
 * uses `key: 'any'` rather than `tid` — a scene's identity is its stable story
 * coordinate (`scene.book1.ch1`), not its creation order.
 */
const RECORD_KEY = 'any';
export function buildLexiconDocs(nsid) {
    return [
        scene(nsid),
        stateEvent(nsid),
        profile(nsid),
        place(nsid),
        item(nsid),
        custodyEvent(nsid),
        post(nsid),
    ];
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
                        tags: tags("Labels from the chapter's `tags` frontmatter."),
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
                        description: {
                            type: 'string',
                            description: "One-line summary the author wrote in the codex file's `description` frontmatter. `oneLine` is the same idea lifted from the file's Overview prose; a surface that wants one line should read `description` and fall back to `oneLine`.",
                            maxLength: 3000,
                        },
                        oneLine: {
                            type: 'string',
                            description: "One-line character summary, lifted from the codex file's Overview.",
                            maxLength: 3000,
                        },
                        tags: tags("Labels from the codex file's `tags` frontmatter, e.g. `main-cast`."),
                        status: {
                            type: 'string',
                            description: "Where the character stands in the series, from the codex file's `status` frontmatter, falling back to the registry entry's status.",
                            maxLength: 64,
                        },
                        sourceFile: { type: 'string', description: 'Repository-relative codex path.', maxLength: 1024 },
                    },
                },
            },
        },
    };
}
/**
 * The one record type authored rather than extracted.
 *
 * Every other type is projected out of finished prose, so it cannot contradict
 * the story. A post is new in-world content written *as* the character, which
 * makes it canon-bearing and puts it under the same review the prose gets. It
 * is emitted from `posts/` files beside a story's `chapters/`, one file per
 * post, so each one is reviewable and diffable on its own.
 *
 * Two fields are gates rather than metadata, and they answer different
 * questions. `publishDate` decides whether a post exists yet — absent means
 * released, matching the chapter rule. `chapterRef` decides whether a given
 * reader has earned it, resolved against whatever reading-position the
 * consuming surface keeps. During a live serialized run the two coincide. They
 * diverge the moment the run ends and a new reader starts at chapter one, which
 * is why `chapterRef` is required: a post with no reveal gate is a post that
 * cannot be shown safely to a reader who arrived late.
 */
function post(ns) {
    return {
        lexicon: 1,
        id: `${ns}.character.post`,
        description: 'A short in-world post authored as a character, anchored to a point in story time.',
        defs: {
            main: {
                type: 'record',
                key: RECORD_KEY,
                description: 'A character post record.',
                record: {
                    type: 'object',
                    required: ['id', 'author', 'text', 'storyDate', 'chapterRef', 'createdAt', 'sourceFile'],
                    properties: {
                        id: localId('Stable post id, e.g. `post.book1.ch12.emma.1`.'),
                        author: localId('Registry id of the character speaking.'),
                        text: {
                            type: 'string',
                            description: "The post body, in the character's own voice.",
                            maxLength: 3000,
                        },
                        storyDate: { type: 'string', description: 'In-story date, `YYYY-MM-DD`.', maxLength: 10 },
                        storyTime: {
                            type: 'string',
                            description: 'Informal in-story time of day from the source frontmatter, e.g. `late evening`.',
                            maxLength: 128,
                        },
                        chapterRef: {
                            type: 'string',
                            description: 'Reveal gate: the chapter a reader must have reached before this post is safe to show, e.g. `book1#ch12`.',
                            maxLength: 256,
                        },
                        publishDate: {
                            type: 'string',
                            description: 'Release gate: real-world date the post becomes servable. Absent means released.',
                            maxLength: 10,
                        },
                        inReplyTo: localId('Post id this one answers, so a thread reads as a thread.'),
                        mentions: {
                            type: 'array',
                            description: 'Registry ids of characters named in the post.',
                            items: localId('A character id.'),
                        },
                        placeRef: localId('Place id the post is pinned to, so it also surfaces on that location.'),
                        tags: tags('Labels carried through from the source frontmatter.'),
                        createdAt: { type: 'string', description: 'Story time as an RFC3339 datetime.', format: 'datetime' },
                        sourceFile: { type: 'string', description: 'Repository-relative post path.', maxLength: 1024 },
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
                        kind: {
                            type: 'string',
                            description: "What sort of place this is — home, shop, public space — from the `**Type:**` line in the location file's body. Frontmatter `type:` is the knowledge-graph document type and is always `Location`.",
                            maxLength: 256,
                        },
                        description: {
                            type: 'string',
                            description: "One-line summary from the location file's `description` frontmatter.",
                            maxLength: 3000,
                        },
                        tags: tags("Labels from the location file's `tags` frontmatter."),
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
function item(ns) {
    return {
        lexicon: 1,
        id: `${ns}.item`,
        description: 'A tracked object in the universe — one whose custody the narrative follows.',
        defs: {
            main: {
                type: 'record',
                key: RECORD_KEY,
                description: 'An item record.',
                record: {
                    type: 'object',
                    required: ['id', 'displayName'],
                    properties: {
                        id: localId('Stable item id, e.g. `item.heritage-bottle`.'),
                        displayName: { type: 'string', description: 'Name as readers see it.', maxLength: 640 },
                        description: {
                            type: 'string',
                            description: "One-line summary from the item's codex file, when it has one.",
                            maxLength: 3000,
                        },
                        tags: tags("Labels from the item's `tags` frontmatter."),
                        status: {
                            type: 'string',
                            description: "Lifecycle of the item within the series, from the registry entry.",
                            maxLength: 64,
                        },
                        firstAppearance: {
                            type: 'string',
                            description: 'Chapter where the item first changes hands, e.g. `book1#ch1`. Derived from the earliest custody event, so it is absent for an item with no custody recorded yet.',
                            maxLength: 256,
                        },
                        sourceFile: {
                            type: 'string',
                            description: "Repository-relative codex path, for an item that has a file of its own.",
                            maxLength: 1024,
                        },
                    },
                },
            },
        },
    };
}
function custodyEvent(ns) {
    return {
        lexicon: 1,
        id: `${ns}.custodyEvent`,
        description: 'A change of custody: an item passing into someone\'s hands at a point in story time.',
        defs: {
            main: {
                type: 'record',
                key: RECORD_KEY,
                description: 'A custody event record.',
                record: {
                    type: 'object',
                    required: ['id', 'item', 'storyDate', 'holder', 'chapterRef', 'sceneRef', 'createdAt', 'sourceFile'],
                    properties: {
                        id: localId('Stable event id, e.g. `custodyEvent.heritage-bottle.book1.ch1`.'),
                        item: localId('Registry id of the item changing hands.'),
                        storyDate: { type: 'string', description: 'In-story date, `YYYY-MM-DD`.', maxLength: 10 },
                        storyDateEnd: { type: 'string', description: 'End of the in-story span.', maxLength: 10 },
                        holder: localId('Registry id of the character who holds the item after this event.'),
                        fromHolder: localId('Registry id of the previous holder. Absent when the item enters the story here, or when the prior holder is deliberately unnamed — never null.'),
                        event: {
                            type: 'string',
                            description: 'One-line description of the hand-off, in the author\'s words.',
                            maxLength: 3000,
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
