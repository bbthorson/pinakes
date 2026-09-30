---
title: "Continuity and drift"
---

Two different failure modes, two different mechanisms.

**Continuity** is the story contradicting itself: a character in two places at
once, a date that runs backwards, a name nobody has heard of. `pinakes lint`
catches the mechanical subset of this.

**Drift** is the records no longer matching the prose they claim to describe.
Nothing in the story is wrong; the projection is just stale. `pinakes compile`
plus a CI gate catches this.

A third category — is the *writing* any good, does the arc hold, does the clue
fire — is judgment, and is deliberately kept out of CI. The last section covers
where it lives instead.

## The built-in rules

These checks run on `pinakes lint`. Severities are configurable in
`pinakes.yaml` under `rules:`, with `error`, `warning`, or `off`. A `rules:`
block is merged over the defaults, so it only needs the rules you change:

| Rule | Default | What it catches |
| --- | --- | --- |
| `unresolved-entities` | `error` | A name in frontmatter that resolves to no registry entity and is not a declared non-entity |
| `non-sequential-dates` | `error` | A chapter whose start date precedes the previous chapter's |
| `missing-date` | `error` | A chapter with no `YYYY-MM-DD` anywhere in its `date` |
| `malformed-frontmatter` | `error` / `warning`, not configurable | A chapter file whose frontmatter is not valid YAML (error), or has no `chapter` key (warning); either way it would otherwise be skipped by every check |
| `ambiguous-alias` | `error`, not configurable | One alias (or display name) claimed by two registry entities of the same type. It resolves to neither, and every reference to it is reported as ambiguous. Different types may share a name |
| `duplicate-id` | `error`, not configurable | One entity id registered twice in `entities.yaml` |
| `invalid-did` | `error`, not configurable | A `did` on an `entities.yaml` entry that atproto would reject: not `did:plc` or `did:web`, a `did:plc` that is not 24 lower-case base32 characters, a `did:web` with a path or a port (other than on localhost), or a value that is not a string. Also a `did` on a place or item, which have no accounts. Syntax only: the DID is never resolved |
| `duplicate-did` | `error`, not configurable | One DID on two characters' registry entries, retired characters included. `did:web` hostnames are compared case-insensitively |
| `invalid-handle` | `error`, not configurable | A `handle` on an `entities.yaml` entry that is not one DNS label: letters, digits and hyphens, at most 63, not starting or ending with a hyphen. A qualified handle (`emmacooks.example.com`) is rejected, since the domain is not part of the record. Also a value that is not a string, and a `handle` on a place or item |
| `duplicate-handle` | `error`, not configurable | One handle on two characters' registry entries, retired characters included, compared case-insensitively |
| `did-in-codex`, `handle-in-codex` | `error`, not configurable | A `did` or `handle` in a character's codex frontmatter. A character's account lives on its registry entry only; the codex value is not read, so move it |
| `invalid-registry-entry` | `error`, not configurable | An `entities.yaml` entry missing a required field (`id`, `type`, `displayName`) or with a field of the wrong type. It is left out of the registry, so nothing resolves to it |
| `duplicate-chapter` | `error`, not configurable | Two chapter files in one story declaring the same `chapter` number, which would compile two scenes under one id |
| `co-presence-conflict` | `warning` | A character present in two chapters with overlapping dates and no shared location |
| `post-register` | `error` | A post anchored to a chapter where its author is in a non-public register |
| `stretch-source-future` | `error` | A stretch citing a source that **ends** after its `asOf`: a character drawing on what has not happened yet |
| `stretch-source-unresolved` | `error` | A stretch source that is not a compiled record id |
| `stretch-dates` | `error` | `asOf` or `since` not a real `YYYY-MM-DD` date, or `since` after `asOf` |
| `stretch-filename` | `error` | A stretch not at `stretches/<character-slug>/<asOf>.md` |
| `stretch-duplicate` | `error` | Two stretches for one character on the same `asOf` |
| `stretch-status` | `error` | `status` other than `draft` or `approved` |
| `stretch-register` | `error` | A register outside `stretches.registers`, or, when that is unset, outside the register first-terms the chapters use |
| `stretch-length` | `warning` | A stretch longer than `stretches.softMaxChars` (default 600) |
| `stretch-affect-unresolved` | `error` | A stretch `affect:` label that is not in the affect vocabulary. A stretch is authored deliberately, so an unknown state is an error; the stretch compiles with no coordinates |
| `affect-label-unresolved` | `warning` | A chapter `affect:` label that is not in the affect vocabulary. That character-chapter emits no affect event |
| `affect-malformed` | `error` | An `affect:` value that is not a label, a transition or `{ v, a, d }`; a single label in a chapter (a chapter records a shift); a transition in a stretch (a stretch is a state) |
| `affect-out-of-range` | `error` | A numeric `affect:` value that is not an integer in [−100, 100] |
| `affect-declared-no-register` | `warning` | A chapter that declares `affect:` for a character with no `registers:` entry in that chapter |

The stretch rules run against *compiled* records, because
`stretch-source-future` needs every other record's end date. `lint` builds the
record set in memory to get them and writes nothing. "Ends" means
`storyDateEnd` where a record has one: a chapter dated `2026-10-12 to
2026-10-14` has two days still to run on Oct 12, and a stretch written that day
cannot cite it.

The affect rules are computed the same way, by the compiler, which emits
nothing for a declaration it could not resolve. An `affect:` key that names no
registry character is reported under `unresolved-entities`, as a `registers:`
key is. See [Affect](/pinakes/affect-simulation/).

Supper Club Secrets sets no `rules:` block at all, so Book 1 runs on these
defaults and passes clean.

Here is a real failure, produced by introducing an unregistered name into
chapter 11 and moving it onto chapter 12's date:

```
======================================================================
PINAKES CONTINUITY CHECK
======================================================================

📁 stories/01. The Case of the Missing Hot Sauce/chapters/m2_11_the_empty_stall.md:
  :19   [unresolved-entities] 🔴 ERROR: Unresolved reference to character 'Renata Vasquez' in field 'characters_referenced'
        [co-presence-conflict] 🟡 WARNING: Co-presence conflict: Character 'Emma Hartley' is present in Chapter 11 and Chapter 12 (…/m2_12_coming_to_a_boil.md) at the same time in different locations.
        [co-presence-conflict] 🟡 WARNING: Co-presence conflict: Character 'Elijah Miller' is present in Chapter 11 and Chapter 12 (…/m2_12_coming_to_a_boil.md) at the same time in different locations.

FAIL — pinakes found errors.
```

Two things in that output are worth noticing. The entity error carries a line
number, found by searching the frontmatter text for the offending string. The
co-presence warnings do not, because they are a property of a *pair* of files
rather than of a line.

### How co-presence actually reasons

This is the rule that does real narrative work, and its precision comes from two
deliberate choices.

**It compares resolved place ids, not strings.** Two chapters that say
"McGolrick Park Farmers Market" and "McGolrick" both resolve to
`place.mcgolrick-market` and correctly do not conflict.

**A chapter that resolves to no place is skipped entirely.** A distributed
montage, a chapter set in transit, an ensemble group-chat scene — these pin
their characters to no particular location, so they cannot contradict anything.
Before this was fixed, every montage chapter conflicted with every chapter that
overlapped it.

The check also requires the two chapters to share *none* of their places. Book 1
leans on this constantly: chapter 1 is `[McGolrick Park, Emma's Apartment]` and
chapter 2 is `[Emma's Apartment]`, both on 2026-10-04. They share Emma's
apartment, so Emma being in both is not a contradiction — she went to the market
in the morning and hosted dinner that evening.

Which is also why this is a **warning and not an error**. Overlap is computed at
date granularity; the `time:` field (`"morning → afternoon"`, `"evening"`) is
not read. Two genuinely sequential scenes in different places on the same day
will flag. The rule is a prompt to look, not a verdict.

### Custom YAML rules

Beyond the built-ins, you can write rules as YAML in a directory named by
`paths.rules`:

```yaml
# rules/voice-register.yaml
name: "voice-register-transitions"
description: "Verify that character registers only transition to valid states"
severity: error
selector: "stateEvent"
validate:
  field: "register"
  pattern: "^(public|private|under-pressure)$"
```

`selector: chapter` checks a frontmatter field — scalar, list, or map — against
a regex, or asserts it is present with `required: true`. `selector: stateEvent`
is narrower: it only supports `field: register`. It reads each annotation the
way the compiler does: notes in parentheses are dropped, and every step of a
transition is tested, so `private (tired) → under-pressure` checks both
`private` and `under-pressure`. An arrow inside a note, as in
`private (curious → quietly alarmed)`, is part of the note. It needs a `pattern`, and a `stateEvent` rule naming another field or
using `required` fails to load, since neither would ever be checked. A
`chapter` rule needs a `pattern`, `required: true`, or both.

That example looks like a good fit for character-driven work, because a fixed
register vocabulary is exactly the kind of convention that erodes silently
across six books. Supper Club Secrets defines precisely such a three-register
framework in its voice guide.

Run that exact rule against Book 1 and it reports three annotations out of 99,
the three that genuinely leave the vocabulary: `briefly animated` and
`deflating`, both on the right of an arrow, and `active`.

It used to report 86, every one a false positive, while missing those three.
The linter tested `private (sentiment flipping in real time)` in full, note
included, and checked only the term left of an arrow. It now shares the
compiler's parser, so the two cannot drift apart again.

Note that `paths.rules` is a **glob, not a directory**: it needs
`rules/*.yaml`. Setting `rules: "rules"` matches the directory itself. This
used to print a warning, load zero rules, and report `OK — all checks passed
cleanly.` It now fails `lint`, and so does a glob that matches no files at
all, such as `rules/*.yml` when the files end in `.yaml`. A rule file that
cannot be loaded — unreadable, invalid YAML, the wrong shape, or a `pattern`
that is not a valid regex — also fails `lint` outright, because a rule that
silently stops running is worse than no rule.

## Drift: records that no longer match the prose

Two mechanisms, layered.

### Lexicon validation, at compile time

Every record is validated against the universe's own generated Lexicon document
before the file is written, using [`@atproto/lex`](https://www.npmjs.com/package/@atproto/lex).
Records are held to the real AT Protocol data model rather than to a `$type`
string the compiler stamped on itself.

A genuine failure, from lengthening a location's `status` past its 64-character
limit:

```
📁 records/series/places.json:
        [lexicon-validation] 🔴 ERROR: place.the-gilded-fern: string too big (maximum 64, got 82) at $.status

FAIL — 1 problem(s) in the compiled records.
```

The invalid record is still written to disk, then reported. That is deliberate:
you can open `records/series/places.json` and look at the thing that failed.

This catches the class of bug that used to reach consumers silently — a renamed
field, a date where a datetime belongs, a value that outgrew its schema.

### The drift gate, in CI

Validation proves each record is well-formed. It says nothing about whether the
committed records reflect the *current* prose. That is what the drift gate is
for, and it is the single highest-value piece of automation in this pipeline.

Supper Club Secrets runs it on every pull request
(`.github/workflows/continuity-lint.yml`):

```yaml
      - name: Continuity lint
        run: npx -y @bbthorson/pinakes@${{ env.PINAKES_VERSION }} lint

      - name: Records drift gate
        run: |
          npx -y @bbthorson/pinakes@${{ env.PINAKES_VERSION }} compile
          if ! git diff --exit-code -- records/; then
            echo '::error::records/ is stale — run `pinakes compile` locally and commit the regenerated records.'
            exit 1
          fi
```

The mechanism is just: recompile, and require the working tree to be unchanged.
Because `createdAt` is derived from story time rather than wall-clock time, a
recompile of unchanged prose is byte-identical — which is what makes
`git diff --exit-code` a usable gate at all. Had `createdAt` been the compile
timestamp, every run would diff and the check would be worthless.

Stale records were a recurring finding in that project's own audits. This makes
them unmergeable.

Two practical notes:

**Pin the version.** The workflow pins `PINAKES_VERSION: 0.2.1`, because an
unpinned `npx @bbthorson/pinakes` would let a new Pinakes release change the
compiled output and fail the gate on a pull request that touched nothing.
Upgrading is a deliberate act: bump the variable, recompile locally, commit the
regenerated records in the same pull request.

**Stale files are removed, and the removal diffs.** `compile` deletes any
record file it did not produce this run: `scenes.json`,
`character_state_events.json`, `custody_events.json`, `character_posts.json`,
`character_stretches.json`, `places.json`, `character_profiles.json`, or
`items.json` one level below `records/`, and `*.<type>.json` Lexicon documents
in `records/lexicons/`. A book that was renamed or deleted, a record type a book
stopped producing, or an NSID change therefore shows up as a deletion, and the
gate fails until it is committed. Before this, those files stayed forever and
never diffed.

Nothing else in `records/` is touched. The gate still cannot see a file under
some other name that no Pinakes command produces: it never changes, so it
never diffs. If `paths.output` is the project root (or above it), `compile`
skips removal entirely and says so, because those file names one level down
could be the author's own.

This is not hypothetical. Supper Club Secrets carried hand-written
`records/book1/items.json` and `custody_events.json` for months in exactly that
state: unvalidated, schema-less, consumed by the site at build time, and green
on every run. Both are compiled records now, but the lesson generalises — if you
hand-write anything into `records/`, the gate is not protecting it, and under
one of the file names above `compile` will delete it. The check to
add, if you want one, is for files under `records/` that a fresh `compile` into
an empty directory does not produce.

## The passes that stay out of CI

Everything above is deterministic. It answers "does this contradict itself?" and
never "is this good?"

Supper Club Secrets draws that line explicitly, in a comment at the top of its
own workflow:

> What this deliberately does NOT do: prose-level checks (canon-check,
> story-audit) are judgment passes, not deterministic lints — they stay in the
> editorial workflow, not CI.

Those judgment passes live in the story repository as agent skills, not in
Pinakes, and the split is worth copying:

`prose-check` sits on the seam between the two halves, and is the one case where
Pinakes ships something that feeds a judgment pass without being a gate. It
counts the countable signals and assembles the chapter closers, then exits 0
whatever it finds — the counting is deterministic, so it belongs in the tool, but
the verdict is not, so it stays with the author. See
[Prose triage](/pinakes/prose-triage/). Do not add it to CI; the taxonomy it
implements puts AI tells at the bottom of its severity ladder and frames every
finding as a suggestion, and a failing build is not a suggestion.

- **`canon-check`** verifies one chapter or scene against canon — register
  continuity, voice tics used once per scene rather than every line, established
  facts, who canonically knows what at this point in the timeline. Read-only.
- **`story-audit`** audits a whole book in parallel passes: per-sequence
  continuity, story structure, tracking fidelity, and a records-layer pass that
  regenerates with Pinakes and treats any unexplained diff as a finding.

The reason the split holds is that the two halves catch structurally different
things. A whole-book pass on Book 1 — already reviewed chapter by chapter —
found 6 contradictions, 28 slips, and 19 nits, because doubled beats, dropped
characters, and arcs that hollow out when a twist is layered in late are
invisible to any per-chapter check *and* to any linter.

There is one asymmetry the judgment layer has to carry, because no lint can. The
tracking files are the author's richer record — `character_matrix.md` is a
chapter × character grid with register *and* a one-line emotional state for
every cell — while the compiler reads only the `registers:` block in chapter
frontmatter. The two are maintained by hand and nothing checks that they agree.
`story-audit`'s tracking-fidelity pass is what stands in for that check, and it
treats stale tracking as a finding even when the prose is fine.

Which points at the honest summary of this whole layer: **Pinakes makes the
mechanical half of continuity unmergeable, so that editorial attention is spent
on the half that needs a reader.**

## Where to go next

- [Record types](/pinakes/record-types/) — what is being validated
- [Prose to records](/pinakes/prose-to-records/) — what feeds it
