# `pinakes compile`

Extracts and translates your story files, locations, and character profiles into AT Protocol-compliant JSON records using namespaced Lexicons.

```sh
pinakes compile --root .
```

## Compiled output structure
```
records/
├── lexicons/                          # The universe's Lexicon schema documents
│   ├── <nsid>.scene.json
│   ├── <nsid>.character.stateEvent.json
│   ├── <nsid>.character.profile.json
│   ├── <nsid>.place.json
│   ├── <nsid>.item.json
│   ├── <nsid>.custodyEvent.json
│   ├── <nsid>.character.post.json
│   └── <nsid>.character.stretch.json
├── book1/
│   ├── scenes.json                    # Lexicon: *.scene
│   ├── character_state_events.json    # Lexicon: *.character.stateEvent
│   ├── custody_events.json            # Lexicon: *.custodyEvent
│   ├── character_posts.json           # Lexicon: *.character.post (only with posts/)
│   └── character_stretches.json       # Lexicon: *.character.stretch (only with stretches/)
└── series/
    ├── places.json                    # Lexicon: *.place
    ├── character_profiles.json        # Lexicon: *.character.profile
    └── items.json                     # Lexicon: *.item
```

`compile` also removes files from a previous run that it no longer produces — a deleted book's directory, a record type a book stopped producing, Lexicon documents for an old NSID — and lists each as `removed stale`. Only the file names above are ever removed.

## What the codex carries into records

Records are the only thing reader-facing surfaces should have to read, so
`compile` carries the publishable frontmatter across rather than leaving
consumers to re-parse the codex:

| Record | Carried from |
| --- | --- |
| `*.character.profile` | `description`, `tags`, `status`, `handle` from the character file's frontmatter; `oneLine` from its Overview; `did` from the registry entry. `status` falls back to the registry entry for a character whose file doesn't state one. A `did` that atproto would reject, that two characters share, or that sits in the codex file instead of the registry fails `compile` (`invalid-did`, `duplicate-did`, `did-in-codex`). |
| `*.place` | `description`, `tags`, `status`, `region`, `first_appearance`, `schedule` from the location file's frontmatter; `kind` from the `**Type:**` line in its body. |
| `*.scene` | `tags` from the chapter's frontmatter, alongside the timeline and casting fields. |
| `*.item` | `displayName` and `status` from the registry's `items:` entry; `description` and `tags` from its codex file when it has one; `firstAppearance` derived from the earliest custody event. |
| `*.custodyEvent` | The chapter's `custody:` list — `item`, `holder`, `from` resolved against the registry, and `event` carried through verbatim. |

`tags` accepts either a YAML sequence (`tags: [main-cast, cook]`) or one
hand-typed line (`tags: main-cast, cook`). A field with no value is omitted from
the record, never written as `null`.

## Schema validation

`compile` writes a Lexicon document for every record type it emits, namespaced
under your `project.nsid`, and validates each record against it before the file
is written. Validation uses [`@atproto/lex`](https://www.npmjs.com/package/@atproto/lex),
so records are held to the real AT Protocol data model rather than to a
`$type` string we stamped on ourselves. A record that doesn't match its Lexicon
fails the build:

```
📁 records/book1/scenes.json:
       [lexicon-validation] 🔴 ERROR: scene.book1.ch1: Invalid datetime (got "2026-10-04") at $.createdAt

FAIL — 1 problem(s) in the compiled records.
```

Two consequences worth knowing about, because they are what the data model
actually requires:

* **There is no null.** An optional field with no value is *omitted*, not set
  to `null`. Consumers should read `record.pov ?? fallback`, not `record.pov !== null`.
* **`createdAt` is story time.** It is the RFC3339 datetime for midnight UTC on
  the scene's `storyDate`, not the moment the file compiled — otherwise every
  recompile would reorder the stream.

The `records/lexicons/` directory is meant to be committed. It is the portable
contract for your universe: anything that consumes your records can read the
schemas without reading Pinakes.
