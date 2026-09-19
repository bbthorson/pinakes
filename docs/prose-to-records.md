# Prose to records

What `pinakes compile` reads, how it resolves names, and what it deliberately
never touches.

The short version: **chapter frontmatter is the whole contract.** The prose body
is not parsed. The tracking files are not read. Everything in a compiled record
came from a YAML block at the top of a chapter, from a codex file's frontmatter,
or from the entity registry.

## Configuration

`pinakes.yaml` at the project root is the contract between your repository
layout and the compiler. Supper Club Secrets' file in full:

```yaml
spec: 0.1
project:
  name: "Supper Club Secrets"
  nsid: "com.supperclubsecrets"
  # A "meal" is this series' sequence unit: several chapters share one dinner.
  sequenceField: "meal"
paths:
  registry: "codex/entities.yaml"
  nonEntities: "codex/non_entities.yaml"
  stories: "stories"
  locations: "codex/locations"
  characters: "codex/characters"
  output: "records"
```

`project.nsid` is the namespace root for every record type and every generated
Lexicon. It must eventually be a domain you control, since that is what an NSID
asserts — but it is pinned in this one place, so the swap to a real domain stays
a one-line change followed by a recompile.

`sequenceField` names the grouping between book and chapter in *your*
vocabulary. Records always carry it as `sequence`.

**Set every `paths` key explicitly.** The defaults in `cli/src/config.ts` still
describe the pre-migration layout (`protocol/entities/entities.yaml`,
`canon library/locations`, `protocol/records`) rather than the `codex/` and
`records/` layout the README documents, so omitting a key gets you a path that
no current project uses.

## The chapter frontmatter contract

A chapter is compiled only if its frontmatter has a `chapter:` key. Files under
`stories/<story>/chapters/` beginning with `_` or `00_` are skipped, which is
how outlines and guides live in the same directory as the prose.

Here is a complete chapter head from Book 1:

```yaml
---
chapter: 11
title: "The Empty Stall"
meal: 2
beat: "Fun and Games"
day: "Saturday"
date: "2026-10-10"
time: "morning"
location:
  - "McCarren Park Greenmarket"
  - "Sofia's Cheese Shop"
pov: "Emma"
characters_present:
  - "Emma"
  - "Sofia (cheese shop)"
characters_referenced:
  - "Hank (his Saturday stall — already replaced by a jarred-salsa vendor)"
  - "Paolo Ferrante (the pickle vendor sued out — Sofia's precedent)"
registers:
  Emma: "private (pursues her instinct alone; notices the stall already replaced — escalating erasure)"
  Sofia: "public (warm, then guarded — notes people have been asking about Hank)"
clues:
  planted: []
  revealed:
    - "Hank got 'a big offer to go legit' (Connective)"
    - "The Paolo precedent — same playbook, a vendor sued out over his grandmother's recipe (Confirmation)"
threads:
  active:
    - "Main mystery: the pattern emerges (offer + litigation playbook)"
  touched:
    - "Sofia's shop vulnerability (seeded — the playbook applies to all small vendors)"
beat_purpose: "The empty Saturday stall plus the Paolo precedent turn one disappearance into a pattern — someone is doing this on purpose."
---
```

### What the compiler reads

| Frontmatter | Becomes | Notes |
| --- | --- | --- |
| `chapter` | `scene.id`, `chapterRefs` | Required. Its absence skips the file entirely |
| `title` | `scene.title` | |
| `date` | `storyDate`, `storyDateEnd`, `createdAt` | Every `YYYY-MM-DD` in the value is extracted by regex; first is the start, last is the end |
| `<sequenceField>` (`meal`) | `scene.sequence` | Coerced to an integer; `2` and `"2"` both work |
| `beat` | `scene.beat` | |
| `part` | `scene.part` | Unused in Supper Club Secrets |
| `location` | `placeRefs` / `placeText` | String or list; each entry resolved against the registry |
| `pov` | `scene.pov` | Resolved to a character id |
| `characters_present` | `scene.participants` | Resolved; this is what co-presence reasons over |
| `characters_referenced` | `scene.referenced` | Resolved; mentioned, not present |
| `registers` | one `character.stateEvent` each | The map's keys are character names |
| `beat_purpose` | `scene.primaryEvent` | |
| `tags` | `scene.tags` | Accepts `[a, b]` or a hand-typed `a, b` |

### What the compiler ignores

`day`, `time`, `clues`, `threads`, and `audit_notes` are read by nobody. They
are authoring apparatus — `clues` tracks fair-play mystery construction,
`threads` tracks subplot coverage — and they are the reason a chapter's
frontmatter is longer than its record.

This is worth stating plainly because it is the single most common
misunderstanding of a pipeline like this: **frontmatter is not a schema you fill
in for the compiler.** It is the author's own bookkeeping, and the compiler
takes the subset it can project. Adding a key to a chapter never breaks a
compile.

### What is never read at all

The tracking layer — `character_matrix.md`, `timeline_ledger.md`,
`subplot_threads.md` — is not read by any Pinakes command. This surprises people
reading Supper Club Secrets' own `protocol/ARCHITECTURE.md`, whose §6 table maps
`character_matrix.md` onto `character.stateEvent`. That was the pre-Pinakes
extraction design. Today the same information is authored twice: as a
chapter × character grid for the author to read, and as a `registers:` block in
each chapter for the compiler. The grid is richer, and keeping the two in step
is a manual editorial job (see
[continuity-and-drift.md](continuity-and-drift.md#the-passes-that-stay-out-of-ci)).

And `stories/*/tracking/interiority/` — per-character interior monologue, the
private brain of the book — is never published, by any path, ever. There is no
record type it could become.

## Name resolution

Every character and place name in frontmatter goes through the registry. The
resolver is deliberately forgiving about how authors actually type, and
deliberately strict about the result.

**Normalisation** happens first: surrounding quotes are stripped, then a
trailing parenthetical. So `"Sofia (cheese shop)"` normalises to `Sofia`. This
is what lets the author annotate a cast list inline — the annotation is for the
human reading the file, and `characters_referenced` entries in Book 1 are
frequently a full sentence of context wrapped in parentheses.

**Lookup** is then case-insensitive against a map built from each entity's id,
its `displayName`, and every string in its `aliases`. A hit must also match the
expected type: a name in `location:` will not resolve to a character even if
some character shares the name.

**A miss is checked against `non_entities.yaml`** before it becomes a
diagnostic. That file is how you say "this is deliberately not an entity"
rather than leaving the linter to nag:

```yaml
people:
  - "Murph"                      # one-off bartender at Murph's dive (Ch22)
  - "Unknown out-of-place man"   # the deliberately anonymous "Pike seed" (Ch1);
                                 # narrative withholds his identity here, so we do
                                 # NOT resolve it to char.garrett-pike.
places:
  - "The Ridgeline Diner"        # road stop
```

That second entry is the one to study. The man in chapter 1 *is* Garrett Pike,
and the registry could resolve him — but the narrative withholds it, so
resolving him would leak the reveal into every derived surface. Declaring him a
non-entity is a **craft decision expressed in configuration**, and it is the
clearest example of why the non-entity list is not just a linter suppression
file.

Entries can also be prefix matches (`prefix: true`), used for montage
descriptors that carry a trailing em-dash and a description.

A name that resolves to nothing and is not a declared non-entity produces an
`unresolved-entities` diagnostic. A location in that state is still not lost:
it is carried into the scene record as `placeText`.

## Where the codex comes in

Scenes and state events come from chapters. Profiles and places come from the
codex, and they read frontmatter plus one convention from the body.

**Characters.** The registry drives the loop — one profile per `type: character`
entry with `status: active` — and each entry's `sourceFile` is opened for the
publishable surface:

```yaml
---
type: Character
title: "Emma Hartley"
id: char.emma
status: active
handle: emmacooks
---

# Emma Hartley

## Overview
A grounded and creative chef with a bubbly, optimistic energy, who is learning to trust her intuition.
```

`handle` loses a leading `@`. `oneLine` is the first non-empty line within five
lines of the `## Overview` heading, with leading `-` and wrapping `*` stripped.
`status` from the file wins over `status` from the registry, since the file is
the finer-grained statement; a character with no file falls back to the registry
entry.

**Places.** The loop is over `.md` files in `paths.locations`, skipping
`index.md` and anything starting with `_`. A file is compiled only if its
frontmatter `id` starts with `place.`, which is how an index or a note can live
in the same directory. `kind` comes from the body's `**Type:**` line;
`region` accepts either `region` or `neighborhood`; `status` defaults to
`active` when absent.

## Two data-model rules that will bite you

Both come from the AT Protocol data model, and Pinakes enforces both at compile
time rather than letting them reach consumers.

**Absence is omission, not null.** `compact()` drops every key whose value is
`null` or `undefined`, and `present()` drops empty arrays. A scene with no
referenced characters has no `referenced` key. Consumers read
`record.pov ?? fallback`.

**`createdAt` is derived from `storyDate`,** as midnight UTC on that date. A
malformed date is passed through untouched rather than coerced, so Lexicon
validation reports it against the record instead of the compiler silently
minting a plausible timestamp.

## Running it

```sh
pinakes compile --root .
```

```
====================================================================
PINAKES COMPILATION — repo -> records
====================================================================
    25 records -> records/book1/scenes.json
    97 records -> records/book1/character_state_events.json
    14 records -> records/series/places.json
    13 records -> records/series/character_profiles.json
       lexicon -> records/lexicons/com.supperclubsecrets.scene.json
       lexicon -> records/lexicons/com.supperclubsecrets.character.stateEvent.json
       lexicon -> records/lexicons/com.supperclubsecrets.character.profile.json
       lexicon -> records/lexicons/com.supperclubsecrets.place.json

OK — compilation complete, all records match their Lexicons.
```

The book key comes from the story directory name: a leading number becomes
`book<n>`, so `stories/01. The Case of the Missing Hot Sauce/` compiles to
`records/book1/`. A directory with no leading number is slugified instead.

Records that fail Lexicon validation are **still written**, then reported — so
you can open the offending file and look at the record rather than guessing from
an error message. The command exits non-zero.

## Where to go next

- [Record types](record-types.md) — what comes out the other end
- [Continuity and drift](continuity-and-drift.md) — keeping it honest over six books
