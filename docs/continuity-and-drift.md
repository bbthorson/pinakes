# Continuity and drift

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

Four checks run on `pinakes lint`. Severities are configurable in
`pinakes.yaml` under `rules:`, with `error`, `warning`, or `off`:

| Rule | Default | What it catches |
| --- | --- | --- |
| `unresolved-entities` | `error` | A name in frontmatter that resolves to no registry entity and is not a declared non-entity |
| `non-sequential-dates` | `error` | A chapter whose start date precedes the previous chapter's |
| `missing-date` | `error`, not configurable | A chapter with no `YYYY-MM-DD` anywhere in its `date` |
| `co-presence-conflict` | `warning` | A character present in two chapters with overlapping dates and no shared location |

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

**One caveat on `missing-date`:** it is not listed in the configurable `rules`
map, its severity is hardcoded to `error`, and it is evaluated inside the
`non-sequential-dates` block — so setting `non-sequential-dates: off` silently
disables missing-date detection too. If you want dates unenforced that is
convenient; if you wanted only the ordering check relaxed, it is a trap.

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
is narrower: it only supports `field: register`, and it tests the base register
with any transition arrow stripped, so `private → under-pressure` is checked as
`private`.

That example looks like a good fit for character-driven work, because a fixed
register vocabulary is exactly the kind of convention that erodes silently
across six books. Supper Club Secrets defines precisely such a three-register
framework in its voice guide.

**As written, it does not work.** Run that exact rule against Book 1 and it
reports 86 failures out of 99 register annotations, every one of them a false
positive, while the three genuinely off-vocabulary values pass clean. Two
separate limits cause that:

- **The parenthetical is never stripped.** The compiler's `splitRegister` strips
  `(...)` before recording a register; the linter's `stateEvent` path only
  splits on the arrow. So `private (sentiment flipping in real time)` is tested
  in full against `^(public|private|under-pressure)$` and fails.
- **Only the term left of the arrow is checked.** `private → briefly animated`
  passes, because the check never looks at `briefly animated`.

There is also a configuration trap. `paths.rules` is a **glob, not a
directory**. Setting `rules: "rules"` matches the directory itself, throws
`EISDIR` internally, prints a warning, loads zero rules — and then reports:

```
OK — all checks passed cleanly.
```

You would reasonably believe the rule was enforcing. It needs `rules/*.yaml`.

So custom rules are usable today for `selector: chapter` checks on frontmatter
fields, which is where the feature is sound. Treat `selector: stateEvent` as
unfinished until the linter strips parentheticals and walks the whole
transition.

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

FAIL — 1 record(s) do not match their Lexicon.
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

**The gate only sees paths `compile` writes.** A file sitting in `records/`
that no Pinakes command produces is invisible to it — it never changes, so it
never diffs, and it sails through a check whose entire purpose is catching stale
records.

This is not hypothetical. Supper Club Secrets carried hand-written
`records/book1/items.json` and `custody_events.json` for months in exactly that
state: unvalidated, schema-less, consumed by the site at build time, and green
on every run. Both are compiled records now, but the lesson generalises — if you
hand-write anything into `records/`, the gate is not protecting it. The check to
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

- [Record types](record-types.md) — what is being validated
- [Prose to records](prose-to-records.md) — what feeds it
