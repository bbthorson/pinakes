# Pinakes Guides

How to model a character-driven fictional universe with AT Protocol Lexicons,
using a real universe as the worked example.

The root [README](../README.md) is the tour: what Pinakes is, how to install it,
what the two commands do. These guides are the working detail — what the
compiler actually reads, what it actually emits, and what it deliberately
leaves alone.

| Guide | What it covers |
| --- | --- |
| [Record types](record-types.md) | The five record types `compile` emits, the Lexicon documents it generates for them, and how identity works |
| [Prose to records](prose-to-records.md) | The frontmatter contract, the resolution rules, and what never leaves the repo |
| [Continuity and drift](continuity-and-drift.md) | The lint rules, Lexicon validation, the CI drift gate, and the judgment passes that stay outside CI |

## The worked example

Every example in these guides is taken from
[**Supper Club Secrets**](https://github.com/bbthorson/supper_club_secrets), a
six-book cozy-mystery series and the universe Pinakes was built against. Book 1,
*The Case of the Missing Hot Sauce*, is 25 chapters across four meals, and
compiles to 149 records:

```
   25 records -> records/book1/scenes.json
   97 records -> records/book1/character_state_events.json
   14 records -> records/series/places.json
   13 records -> records/series/character_profiles.json
```

Its NSID root is `com.supperclubsecrets`, so its scene records are
`com.supperclubsecrets.scene` and its Lexicon documents land in
`records/lexicons/com.supperclubsecrets.*.json`.

Where these guides describe something the code does not do yet, they say so
rather than describing the intent. The [known gaps](#known-gaps) section below
collects those in one place.

## Why character-driven fiction is the hard case

Plot-driven continuity is mostly bookkeeping: who was where, what happened when,
which object is in whose hands. A linter can check that, and Pinakes does.

Character-driven fiction adds a harder axis. What has to stay continuous is not
just position but *state* — how guarded a character is, what they know and are
not saying, which version of themselves they are performing for whom. That state
changes scene to scene, it is what readers actually follow, and it is the first
thing to break when a book is revised late.

So the central modelling decision in Pinakes is that a character's register is a
**time series, not a field**. A profile record says who a character is; a stream
of `stateEvent` records says where they stood at each point in story time. Book 1
has 13 profiles and 97 state events — the ratio is the point.

That shape is also why AT Protocol is a natural fit rather than a novelty. A
character whose history is an append-only stream of dated events, keyed to a
stable identity, is exactly what a PDS repository holds.

## The Golden Rule

Read [record-types.md](record-types.md) and it is easy to start thinking of the
records as the model and the prose as input to it. It is the other way round.

**Prose is the source of truth.** If a finished chapter contradicts the codex,
the chapter is right and the codex is what gets updated. Records are a
projection taken downstream of the writing; nothing in `records/` ever edits
anything in `stories/`. `records/` is build output and can be deleted at any
time.

Practically, this means the frontmatter contract in
[prose-to-records.md](prose-to-records.md) is a *description* the author keeps
accurate, not a schema the author writes to first.

## Known gaps

Things these guides describe as absent, gathered here so they are easy to find.
None of them block the pipeline; all of them are places where the documented
model and the shipped code disagree.

1. **There is no `item` or `custodyEvent` record type.** The root README
   advertises item custody as a tracked dimension, and Supper Club Secrets has
   `records/book1/items.json` and `records/book1/custody_events.json` committed —
   but no Pinakes command produces them. They predate the migration to Pinakes
   and are now orphans. See [record-types.md](record-types.md#the-two-record-types-that-do-not-exist-yet).
2. **`config.ts` defaults point at pre-migration paths.** Every `paths` default
   (`protocol/entities/entities.yaml`, `canon library/locations`,
   `protocol/records`) describes the layout the README says Pinakes moved away
   from. A project that omits `paths` gets the old layout, so in practice every
   project sets all of it. See [prose-to-records.md](prose-to-records.md#configuration).
3. **`rules/` is documented but not scaffolded.** The root README documents
   custom YAML rules and `paths.rules` supports them, but `pinakes init` creates
   no `rules/` directory and neither the template nor Supper Club Secrets sets
   `paths.rules`. The feature works; nothing leads you to it. See
   [continuity-and-drift.md](continuity-and-drift.md#custom-yaml-rules).
4. **`missing-date` cannot be configured or disabled**, and turning off
   `non-sequential-dates` silently turns it off too. See
   [continuity-and-drift.md](continuity-and-drift.md#the-built-in-rules).
5. **DIDs are described, not implemented.** The compiler emits local registry
   ids and a bare handle string; nothing in the CLI mints, resolves, or writes a
   DID. See [record-types.md](record-types.md#identity-today-and-identity-later).
6. **`pinakes --version` reports `0.2.0`** while `package.json` is at `0.2.1`.
   The string in `cli/src/cli.ts` is hand-maintained and was missed by the
   version bump.
