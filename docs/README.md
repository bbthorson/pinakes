# Pinakes Guides

How to model a character-driven fictional universe with AT Protocol Lexicons,
using a real universe as the worked example.

[Getting started](getting-started.md) and the command pages are the tour:
how to install Pinakes and what each command does. These guides are the
working detail — what the compiler actually reads, what it actually emits, and
what it deliberately leaves alone.

| Guide | What it covers |
| --- | --- |
| [Record types](record-types.md) | The eight record types `compile` emits, the Lexicon documents it generates for them, and how identity works |
| [Prose to records](prose-to-records.md) | The frontmatter contract, the resolution rules, and what never leaves the repo |
| [Continuity and drift](continuity-and-drift.md) | The lint rules, Lexicon validation, the CI drift gate, and the judgment passes that stay outside CI |
| [Prose triage](prose-triage.md) | `prose-check`: the countable half of the AI-tells pass, why its counts are inputs rather than verdicts, and why it is deliberately not a gate |

## The worked example

Every example in these guides is taken from
[**Supper Club Secrets**](https://github.com/bbthorson/supper_club_secrets), a
six-book cozy-mystery series and the universe Pinakes was built against. Book 1,
*The Case of the Missing Hot Sauce*, is 25 chapters across four meals, and
compiles to 149 records:

```
   25 records -> records/book1/scenes.json
   97 records -> records/book1/character_state_events.json
    3 records -> records/book1/custody_events.json
   14 records -> records/series/places.json
   13 records -> records/series/character_profiles.json
    1 records -> records/series/items.json
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

1. **DIDs are carried, not resolved.** A character's `did` is checked for
   syntax and uniqueness and carried onto its profile, but nothing in the CLI
   mints a DID or confirms that one resolves to the account the codex means.
   That is left to the publishing layer. See
   [record-types.md](record-types.md#identity-today-and-identity-later).

### Closed since these guides were written

- **A character's DID reaches its profile record.** `did` in codex
  frontmatter used to be ignored, so a consumer that needed it had to re-read
  the codex. It is now carried onto `character.profile`, and a DID atproto
  would reject (`invalid-did`) or two characters share (`duplicate-did`) fails
  both `lint` and `compile`.
- **A custom rule that would never run fails `lint`.** Each of these used to
  load nothing, or load a rule that checked nothing, and report `OK — all
  checks passed cleanly`. Now each is an error: `paths.rules` set to a
  directory (`rules` rather than `rules/*.yaml`), a glob that matches no files,
  a rule file with invalid YAML, the wrong shape, or an invalid regex, a
  `stateEvent` rule on a field other than `register` or using `required`, and
  a rule with neither a `pattern` nor `required: true`. `pinakes init` still
  creates no `rules/` directory, since custom rules are optional.
- **`stateEvent` rules can express a register vocabulary.** They used to test
  each annotation with its parenthetical note included and check only the term
  left of an arrow, so the example rule on the
  [`pinakes lint`](commands/lint.md#custom-yaml-rules) page reported 86 false
  positives on Book 1 and missed the three real off-vocabulary values. It now
  reports exactly those three; see
  [continuity-and-drift.md](continuity-and-drift.md#custom-yaml-rules).
- **`missing-date` is its own configurable rule.** It used to be hardcoded to
  `error` and evaluated inside `non-sequential-dates`, so turning the ordering
  check off silently stopped reporting undated chapters.
- **A registry entry that fails validation fails `lint`.** It used to be
  skipped with only a console warning. It is now an `invalid-registry-entry`
  error; see
  [continuity-and-drift.md](continuity-and-drift.md#the-built-in-rules).
- **`item` and `custodyEvent` now exist.** Both are compiled and validated; see
  [record-types.md](record-types.md#item-and-custodyevent). A universe carrying
  hand-written `items.json` or `custody_events.json` from before this should
  delete them and let `compile` produce them. Items now land in
  `records/series/`; `compile` removes a leftover `records/<book>/items.json`
  as stale (see below).
- **`compile` removes stale record files.** A record file it no longer
  produces — a deleted or renamed book, a record type a book stopped
  producing, Lexicon documents for an old NSID — is deleted and reported as
  `removed stale`. Only pinakes' own file names are candidates; see
  [continuity-and-drift.md](continuity-and-drift.md#the-drift-gate-in-ci).
- **`config.ts` path defaults** now match the documented `codex/` and `records/`
  layout.
- **`pinakes --version`** reads the version from `package.json`, so it cannot
  drift from the package again.
