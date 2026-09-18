# Record types

`pinakes compile` emits six record types and writes a Lexicon document for each
one. This guide covers what they are, why the set is shaped this way, and where
identity fits.

Examples are from [Supper Club Secrets](https://github.com/bbthorson/supper_club_secrets),
whose `project.nsid` is `site.supperclub`.

## The six types

| Record type | Grain | Emitted to | Book 1 count |
| --- | --- | --- | --- |
| `<nsid>.character.profile` | One per active character | `records/series/character_profiles.json` | 13 |
| `<nsid>.character.stateEvent` | One per character per chapter they appear in | `records/<book>/character_state_events.json` | 97 |
| `<nsid>.scene` | One per chapter | `records/<book>/scenes.json` | 25 |
| `<nsid>.place` | One per location | `records/series/places.json` | 14 |
| `<nsid>.item` | One per tracked object | `records/series/items.json` | 1 |
| `<nsid>.custodyEvent` | One per hand-off | `records/<book>/custody_events.json` | 3 |

Three are series-wide and three are per-book. That split is not cosmetic: a
character's identity and a location's description are properties of the
universe, while what happened and how someone felt are properties of a
particular story inside it. Book 2 will add
`records/book2/scenes.json` without touching `records/series/`.

## Why these four

The set decomposes a character-driven narrative along the two axes that actually
have to stay continuous.

**Who and where are stable.** `character.profile` and `place` are the standing
cast and the standing set. They change slowly, between books rather than between
chapters, and they are what a reader-facing surface renders a character page or
a location page from.

**What and how are events.** `scene`, `character.stateEvent`, and
`custodyEvent` are dated, append-only, and ordered by story time. They are the
stream.

The same split runs through objects: `item` is the standing prop, `custodyEvent`
is where it went.

The reason there is a separate `stateEvent` type at all — rather than a
`currentRegister` field on the profile — is the whole modelling argument. In
character-driven fiction, the interesting fact is never "Emma is guarded"; it is
"Emma was guarded in chapter 3 and open by chapter 14, and here is the scene
where it turned." A field holds the former. Only a stream holds the latter.

Book 1's 97 state events against 13 profiles is what that looks like in
practice: roughly four register annotations per chapter, each one a dated point
on some character's line.

### A scene is not a chapter

`scene` records are *projected from* chapters, not equal to them. The record
carries `chapterRefs` as an array and `storyDate`/`storyDateEnd` as a span,
because the intended grain is the dated beat.

Today the compiler emits exactly one scene per chapter, so `chapterRefs` always
has one element — but a reader-facing surface should not assume that. Supper
Club Secrets' site already works around the mismatch by bucketing scenes by
story date at build time, since chapters 1 through 5 all happen on
2026-10-04 and share one dated beat.

## What each record carries

### `character.profile`

The public-facing identity of a character. One is emitted for every registry
entry with `type: character` **and** `status: active` — a character with
`status: referenced` or `status: future` is resolvable in the registry but
never published.

```json
{
  "$type": "site.supperclub.character.profile",
  "id": "profile.emma",
  "subject": "char.emma",
  "displayName": "Emma Hartley",
  "handle": "emmacooks",
  "oneLine": "A grounded and creative chef with a bubbly, optimistic energy, who is learning to trust her intuition.",
  "status": "active",
  "sourceFile": "codex/characters/emma.md"
}
```

`id` is the record's own identity; `subject` is the registry id it describes.
They are separate because other record types point at `subject` — a state event
names `char.emma`, not `profile.emma` — which keeps the character's identity
independent of any one record about them.

`description` and `oneLine` are both one-liners and both optional.
`description` is authored deliberately in the codex file's frontmatter;
`oneLine` is scraped from the first line under the file's `## Overview` heading.
A surface should read `description` and fall back to `oneLine`.

That fallback matters more than it looks. Overview prose is written for the
*author*, and in Supper Club Secrets the supporting cast's Overview lines give
away the ending. Its site deliberately does not render `oneLine` publicly, and
sources reader-facing copy from the codex instead. If you publish character
profiles, decide which of those two fields is the public one before you ship,
not after.

### `character.stateEvent`

One register annotation, at one point in story time.

```json
{
  "$type": "site.supperclub.character.stateEvent",
  "id": "stateEvent.brenda-marquez.book1.ch10",
  "subject": "char.brenda-marquez",
  "storyDate": "2026-10-09",
  "register": "public",
  "registerExpr": "public → private",
  "state": "public → private (recognizes the LLC; warns Jasper)",
  "chapterRef": "book1#ch10",
  "sceneRef": "scene.book1.ch10",
  "createdAt": "2026-10-09T00:00:00.000Z",
  "sourceFile": "stories/01. The Case of the Missing Hot Sauce/chapters/m2_10_loose_lips.md"
}
```

Three fields hold the same annotation at three levels of fidelity, on purpose:

- **`state`** is the author's line, verbatim. Never lossy, never machine-friendly.
- **`registerExpr`** is the annotation with the parenthetical reason stripped —
  present only when it encodes a transition (`public → private`). A chapter
  where the character simply *is* somewhere omits it.
- **`register`** is the first term alone (`public`). This is the queryable one:
  group by it, colour a timeline by it, filter a feed on it.

Records are sorted by subject, then story date, then chapter — so the file reads
as one character's line at a time.

### `scene`

A dated beat, with its cast and its places resolved to ids.

```json
{
  "$type": "site.supperclub.scene",
  "id": "scene.book1.ch1",
  "storyDate": "2026-10-04",
  "chapterRefs": ["book1#ch1"],
  "title": "The Missing Hot Sauce",
  "sequence": 1,
  "beat": "Opening Image / Theme Stated",
  "placeRefs": ["place.mcgolrick-market", "place.emmas-apartment"],
  "pov": "char.emma",
  "participants": ["char.emma", "char.dorothy"],
  "referenced": ["char.hank"],
  "primaryEvent": "Open on the empty stall and Dorothy's 'just in case' bottle — the loss that makes the mystery personal, and the theme that a community protects its own.",
  "createdAt": "2026-10-04T00:00:00.000Z",
  "sourceFile": "stories/01. The Case of the Missing Hot Sauce/chapters/m1_01_the_missing_hot_sauce.md"
}
```

`participants` and `referenced` are kept apart because the distinction is load
bearing for continuity. Present-in-the-room is what the co-presence check reasons
over; mentioned-by-someone is not. Collapsing them would make every character
discussed at a dinner party physically present at it.

`placeRefs` holds resolved registry ids. `placeText` holds location names that
resolved to nothing but are listed in `non_entities.yaml` — a road-stop diner, a
montage descriptor — kept as prose so the information survives without inventing
a place record for a one-off.

`sequence` is the configurable middle tier between book and chapter. Supper Club
Secrets sets `sequenceField: "meal"` in `pinakes.yaml`, so its chapters carry
`meal: 2` and the record carries `sequence: 2`. Another universe names it an
arc, a case, or a session. The record field is always `sequence`, which is what
lets a consumer read any Pinakes universe without knowing its vocabulary.

### `place`

```json
{
  "$type": "site.supperclub.place",
  "id": "place.elijahs-apartment",
  "name": "Elijah's Apartment",
  "description": "Elijah's quiet, orderly one-bedroom in Bed-Stuy; appears in Ch8, but the group has never been inside — a deliberate seed for the Book 6 hosting payoff.",
  "tags": ["location", "brooklyn", "book1", "elijah"],
  "status": "story-specific",
  "firstAppearance": "Book 1, Chapter 8",
  "sourceFile": "codex/locations/elijahs-apartment.md"
}
```

`kind` — what sort of place this is — comes from a `**Type:** Weekly farmers market`
line in the file's *body*, not from frontmatter, because frontmatter `type:` is
already taken by the knowledge-graph document type and is always `Location`.

`schedule` is a nested object (`days`, `hours`, `note`). It is the one piece of
the place model that exists for continuity rather than for display: a location
with a hard operating rule is a constraint on where characters can be. Supper
Club Secrets' McGolrick market is Sunday-only, year-round, and that rule is what
makes a midweek scene there read as an empty green rather than a market. Nothing
in the linter enforces schedules today — it is carried for the surfaces and for
the author.

## The Lexicon documents

Every compile writes the universe's own Lexicon documents alongside its records:

```
records/lexicons/
├── site.supperclub.scene.json
├── site.supperclub.character.stateEvent.json
├── site.supperclub.character.profile.json
├── site.supperclub.place.json
├── site.supperclub.item.json
└── site.supperclub.custodyEvent.json
```

These are ordinary AT Protocol Lexicon JSON documents. They are generated rather
than checked in as fixtures because the NSID authority comes from your
`pinakes.yaml` — one universe publishes `site.supperclub.scene`, another
publishes `com.example.scene`, and the schema is otherwise identical.

**Commit this directory.** It is the portable contract for your universe:
anything that consumes your records can read the schemas without depending on
Pinakes, and `@atproto/lex` can install them directly.

Two properties of the AT Protocol data model are worth internalising before you
write a consumer, because Pinakes enforces both:

- **There is no null.** An optional field with no value is *omitted*. Read
  `record.pov ?? fallback`, never `record.pov !== null`.
- **`createdAt` is story time**, not compile time — midnight UTC on the record's
  `storyDate`. If it were the wall clock, every recompile would reorder the
  stream. Wall-clock authoring time is not a property of the narrative and is
  not recorded anywhere.

Record keys are `any` rather than `tid` for every type, because a record's
identity is its stable story coordinate (`scene.book1.ch1`) rather than its
creation order. Recompiling a book does not renumber anything.

## Identity: today, and identity later

The identity model shipped today is **local ids in a committed registry**.
`codex/entities.yaml` maps every surface form a name appears as onto a permanent
id:

```yaml
- id: char.emma
  type: character
  displayName: Emma Hartley
  aliases: ["Emma", "Emma Hartley"]
  sourceFile: codex/characters/emma.md
  status: active
```

Ids are permanent — `char.emma` survives a rename of the character or the file —
and `aliases` is what makes resolution work, so it has to list every form used
in prose *and* in frontmatter. Supper Club Secrets registers "the mogul" and
"the developer" as aliases of `char.garrett-pike` because both appear as
pre-naming epithets.

The root README also describes characters as DIDs —
`did:plc:…` or `did:web:emma.supperclub.site`, each owning a cryptographically
signed history. **That is a design target, not shipped behaviour.** Nothing in
the CLI mints, resolves, writes, or validates a DID. What exists is:

- local ids (`char.emma`) in every record, and
- an optional `handle` string on the profile, carried from codex frontmatter as
  a bare label (`emmacooks`, with any leading `@` stripped).

The `handle` field is deliberately unqualified. Until a universe is bound to a
domain it controls, `emmacooks` is a label; once it is,
`emmacooks.supperclubsecrets.com` is a handle. Qualifying it is the consumer's
job, which keeps the domain decision out of every compiled record.

This is the right sequencing rather than an omission. Local ids are free,
reversible, and testable; DIDs require a purchased domain, real accounts, and
DNS. Supper Club Secrets is working through exactly that sequence in its own
`protocol/SERIALIZED_PUBLISHING.md`.

## `item` and `custodyEvent`

Tracked objects work the same way characters do: a standing record from the
registry, and a dated stream of what happened to it.

### `item`

One record per registry entry with `type: item` and `status: active` — the same
registry-driven loop that produces character profiles.

```json
{
  "$type": "site.supperclub.item",
  "id": "item.heritage-bottle",
  "displayName": "Heritage Hot Sauce Bottle",
  "status": "active",
  "firstAppearance": "book1#ch1"
}
```

An item usually has no codex file of its own — a registry entry is the whole of
it — so `description`, `tags`, and `sourceFile` are all optional and simply
absent for an item without one. `firstAppearance` is **derived**: it is the
chapter of the earliest custody event recorded for the item, across every book,
so it is absent for an item whose custody nothing has recorded yet.

### `custodyEvent`

One record per hand-off, projected from a chapter's `custody:` block.

```json
{
  "$type": "site.supperclub.custodyEvent",
  "id": "custodyEvent.heritage-bottle.book1.ch17",
  "item": "item.heritage-bottle",
  "storyDate": "2026-10-14",
  "storyDateEnd": "2026-10-16",
  "holder": "char.jasper",
  "fromHolder": "char.emma",
  "event": "Jasper palms the bottle from Emma's counter on his way out, and packs it for the PA journey.",
  "chapterRef": "book1#ch17",
  "sceneRef": "scene.book1.ch17",
  "createdAt": "2026-10-14T00:00:00.000Z",
  "sourceFile": "stories/01. The Case of the Missing Hot Sauce/chapters/m3_17_sharpening_the_knives.md"
}
```

`holder` is who has it *after* the event; `fromHolder` is who had it before, and
is **omitted** — never null — when the item enters the story here or when the
prior holder is deliberately unnamed. Records are sorted by item, then story
date, then chapter, so the file reads as one object's journey at a time.

`sceneRef` ties each hand-off to the scene it happened in, which is what lets a
reader-facing surface put a clue's movement on the same timeline as everything
else.

### Why custody is worth modelling separately

For a mystery, custody *is* the plot. Book 1's single tracked object — the
bottle Dorothy presses on Emma in chapter 1 — moves three times, and each move
is a beat: it is given, it is taken without asking, it is returned with an
apology. Three records carry an arc that no amount of prose parsing would
reliably recover.

It is also the clearest case for deriving records rather than writing them. The
same three hand-offs were once maintained by hand in this file, and the
hand-written version had chapter 17 on 2026-10-15; the chapter itself spans
2026-10-14 to 2026-10-16. The compiler takes the dates from the chapter, so the
record cannot disagree with the prose it describes.

## Where to go next

- [Prose to records](prose-to-records.md) — the frontmatter that produces all of this
- [Continuity and drift](continuity-and-drift.md) — what stops it from rotting
