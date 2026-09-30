---
title: Affect dynamics — a character's state between declarations
status: proposed
date: 2026-09-30
driver: Supper Club Secrets, drafting stretches and posts after Oct 2
depends_on: bbthorson/pinakes#34 (declared affect)
---

# Affect dynamics: a character's state between declarations

## Decisions

**Only the first item below is decided.** The rest is a proposal. It builds on #34, which made
affect something the author declares (`affect:` in chapters and stretches) and
removed the dynamics code that nothing called. The recommendations are marked
as such, and §13 lists the questions for the author.

- **2026-09-30. `rpe` is removed from `character.affect.event`** (§7), in #34,
  before 1.0.0. It was one chapter-wide number applied to every character in
  the chapter, and removing a field after release would be a breaking change.
- **Proposed: `delta` keeps meaning "last declared step minus first"** (§3).
  The model below adds fields beside it rather than changing what it means,
  so everything else here adds to what exists and can land in any 1.x release.

## 1. The gap

After #34, `pinakes context <character> --as-of <date>` shows affect exactly as
the latest approved stretch on or before that date declared it. Chapter affect
events are compiled into records, but nothing reads them.

The drafting question the tiers exist for is "how is this character a week
after the shock?" Today there are only two answers: whatever the last stretch
said, or nothing. For example:

- Jasper's Oct 2 stretch declares `subdued`.
- His Oct 5 chapter declares `curious → angry`.
- On Oct 8 the bundle still says `subdued`. On Oct 15 it still says `subdued`.

Neither is right, and the author has already written down everything needed to
do better: where he started, what happened, and when.

The proposal is to replay a character's declared affect forward to `--as-of`.
It starts from their latest declared stretch, applies each chapter event in
order, and relaxes toward a resting point between events. The result is shown
in the bundle, and it is also checked against what the author declares next.
The check (§10) is where the continuity value is.

## 2. Principles carried over

- **The author wins.** A declared stretch is ground truth for its date. The
  simulation fills in the time between declarations and never overrides one.
- **Every tier looks backward.** Replay uses only events that have *ended* by
  `--as-of`, as the stretch rules do. A chapter still running on that date has
  not happened yet.
- **Fail closed.** No declared starting point means no state. No declared
  resting point means no decay (§4). An event that did not resolve was already
  never emitted (#34).
- **Numbers are the author's.** Pinakes supplies the arithmetic, not the
  temperament. The rates have no defaults a universe did not choose (§5).
- **Advisory.** The output goes into the same advisory block, under the header
  that says the voice guide and the register win.
- **Deterministic.** The same records and the same date always give the same
  state. Arithmetic is done in floats and rounded only on output.

## 3. What a chapter event means

This is the decision the rest depends on. `Noah: "curious → angry"` can be read
two ways:

| Reading | After the chapter, Noah is… | Problem |
|---|---|---|
| **Impulse**: add `delta` to his current state | wherever he was, shifted by `angry − curious` | If he entered already agitated, the sum overshoots, and the chapter no longer says where he ends up |
| **Endpoint**: he ends the chapter `angry` | `angry` | None. That is what the author wrote |

**Recommendation: labels are endpoints, and numbers are impulses.**

- A label transition sets the state to its **last step**. The first step is
  the author's claim about where he *entered* the chapter, and §10 checks that
  claim against the replay.
- A numeric chapter value `{ v, a, d }` is already defined as a shift (#34), so
  it is added to the current state and clipped to [−100, 100].

The record keeps `delta` as it is and gains two optional fields for label
transitions, `from` and `to`: the coordinates of the first and last step. That
change only adds fields, and it lets any consumer replay the stream without
also needing the universe's vocabulary.

## 4. The resting point

Decay needs somewhere to decay *to*. Options:

1. **Declared in the character's codex frontmatter**, as `affectBaseline:`
   (a label or `{ v, a, d }`). It is temperament, which is long-tier
   material, and it sits beside the rest of who they are.
2. **On the registry entry.** The registry holds identity (`did`, `handle`),
   not personality, so this would be a category error.
3. **Inferred from their stretches**, for example their mean. This is exactly
   the kind of inference #34 removed.

**Recommendation: (1).** A character without `affectBaseline` is still
replayed through their events, but nothing decays: the state after their last
event holds until the next one. The block says so (`not decaying: no
baseline`), so a held state is never mistaken for a settled one.

## 5. Decay

Between events, the state relaxes exponentially toward the baseline:

```
x(t) = b + (x₀ − b) · 0.5^(Δdays / halfLife)
```

- `Δdays` is whole story days from the event's **end date** (`storyDateEnd`,
  else `storyDate`) to `--as-of`. Chapters have no time of day, so a day is the
  finest resolution.
- The half-life is configured, with no default:

```yaml
affect:
  dynamics:
    halfLifeDays: 4          # required to turn dynamics on
```

A universe that sets no `affect.dynamics` gets #34's behaviour unchanged:
the stretch's affect as declared, with events ignored. The deleted code
defaulted to a half-life of about 4.6 days, a figure nobody had checked against
prose. A default would be a number that looks like data.

**Open (§13 q3):** a per-character half-life (`affectHalfLifeDays` in the
codex). Some people stay angry for a month. Start with one global rate, and
add this only if drafting shows the need.

## 6. Baseline drift: recommend not building it

The removed model also moved the baseline itself under sustained stress
("allostatic load"). **Recommendation: do not build this.**

- **It cannot be checked.** Book 1 runs about three weeks. At the old rate
  (3% a day) the drift is a few points, well below what an author could
  confirm or dispute on the page.
- **It makes every state depend on the whole history**, so one edited early
  chapter moves the output everywhere after it, with no obvious cause.
- **The author already has the mechanism.** A new stretch re-anchors the
  character (§8), and a changed `affectBaseline` says the temperament moved.
  Both are declarations, and both are visible in a diff.

Revisit it only if stretches turn out to be too sparse to keep long runs honest.

## 7. Reward prediction error: removed

`rpe:` was chapter frontmatter, so one surprise value was stamped on every
character with affect in that chapter. The ambush that floors Emma is exactly
what Noah planned. The author's endpoint (`→ blindsided`) already carries the
surprise, and in an impulse model `rpe` would be a second, hidden multiplier on
top of it.

**Removed from the event Lexicon and the compiler in #34, before 1.0.0.** If it
is ever wanted, it belongs per character inside the `affect:` entry. That would be an addition, and additions are safe to make after release.

## 8. Replay

For character C at date D:

1. **Anchor.** Take the latest approved stretch for C with `asOf ≤ D` that
   declares `affect:`. If there is none, **stop: no state**. Replaying from
   the baseline alone would give a character a state nobody declared.
2. **Events.** Take C's affect events that end after the anchor's `asOf` and
   on or before D. An event ending on the anchor date is excluded, because the
   stretch was written looking back over it. Order them by end date, then book,
   then chapter number.
3. **Step.** Start at the anchor's coordinates on its `asOf`. For each event,
   decay to its end date (§5), then apply it: set the state to `to` (labels)
   or add `delta` (numbers) (§3).
4. **Finish.** Decay to D. Classify the basin with the universe's basins, as
   #34 does.

Draft stretches are ignored, the same as in the mid tier. Two events on one
day decay by zero days between them, and are applied in chapter order.

## 9. Where the result lives: `context`, not a record

**Recommendation: compute it on demand. Do not compile it into records.**

- A state at an arbitrary date is a query, not an event. Records are the
  append-only stream (`scene`, `stateEvent`, `custodyEvent`, `affect.event`),
  and a snapshot per day per character would be derived bulk that duplicates
  them.
- Record ids are permanent. A snapshot type would mint ids for numbers that
  change whenever a chapter or the half-life is edited.
- It keeps the change out of the five places a new record type touches.

It is exposed in two ways:

- **In `pinakes context`**, where the affect block shows its working, so the
  author can audit it:

```
[INTERNAL_AFFECT_STATE]
DIMENSIONS: Valence=-0.36 | Arousal=0.36 | Dominance=0.28
ATTRACTOR: hyper-vigilant
ANCHOR: stretch.jasper.book1.2026-10-02 (subdued)
EVENTS: affect.event.jasper.book1.ch14 (→ angry, 3 days ago)
DECAY: half-life 4 days toward baseline
SUGGESTED_TENDENCIES:
  - ...
[/INTERNAL_AFFECT_STATE]
```

- **In the library**, as `affectStateAt(universe, character, asOf)`, which
  returns the coordinates, the basin, the anchor id, the event ids and the mode
  (`replayed`, `held`, or none). The JSON bundle carries the same object under
  `affect.state`.

## 10. The continuity check: the reason to build this

Replay gives `lint` something new to judge: whether the author's own
declarations agree with each other.

- **Entering a chapter.** For each label transition, compare the replayed
  state just before the chapter with its **first** step. If Noah's chapter
  says `curious → angry` but the replay has him hyper-vigilant going in, then
  either the chapter or an earlier one is wrong.
- **At a stretch.** Compare a new stretch's declared affect with the state
  replayed up to its `asOf` from the stretch before it. A stretch that declares
  `settled` two days after a rage, with no event in between, is worth a second
  look.

This would be a new rule, `affect-discontinuity` (default `warning`), which
fires when the distance between the two exceeds
`affect.dynamics.discontinuity` (Euclidean distance in scaled units; no
default, and the rule is off until it is set). It runs only when dynamics are
on, and like the other affect findings it is computed by the compiler and
reported by `lint`.

It is a warning, never an error. The author may intend the jump (off-page
events happen), and the check exists to put the question in front of them.

## 11. Worked example

Jasper's baseline is `{ v: 0, a: 0, d: 10 }`, the half-life is 4 days, the
Oct 2 stretch declares `subdued` `{ v: -20, a: -30, d: -30 }`, and his Oct 5
chapter declares `curious → angry`, with `angry` at `{ v: -60, a: 60, d: 40 }`.

| As of | Working | State | Basin |
|---|---|---|---|
| Oct 2 | Anchor | −20 / −30 / −30 | none (valence below the stoic band) |
| Oct 5, entering the chapter | 3 days of decay from subdued | −12 / −18 / −14 | grounded-stoic. Declared entry: `curious` (40 / 30 / 20), a distance of about 78, so `affect-discontinuity` fires at a threshold of 60 |
| Oct 5, after | Set to `angry` | −60 / 60 / 40 | hyper-vigilant |
| Oct 8 | 3 days: factor 0.595 | −36 / 36 / 28 | hyper-vigilant |
| Oct 15 | 10 days: factor 0.177 | −11 / 11 / 15 | grounded-stoic |

The Oct 5 warning is the kind of finding intended. Either Jasper was not
curious going in, or something between Oct 2 and Oct 5 lifted him that no
chapter records.

## 12. What changes

| Where | Change |
|---|---|
| `compiler/affect.ts` | `decay`, `replayAffect` (pure functions over events, an anchor, a baseline and rates) |
| `compiler/atproto.ts` | `from` and `to` on label events. Compute `affect-discontinuity` findings |
| `lexicons/docs.ts` | `affect.event`: add optional `from` and `to` |
| `config.ts` | `affect.dynamics: { halfLifeDays, discontinuity }`. `affect-discontinuity` in `DEFAULT_RULES` |
| Codex parsing | `affectBaseline` read from the character file's frontmatter |
| `context/bundle.ts` | The replayed block (§9). `affect.state` in the JSON bundle |
| `index.ts` | Export `affectStateAt` |
| Docs | `affect-simulation.md`, `commands/context.md`, the rules table in `continuity-and-drift.md`, "Built-in checks" in `commands/lint.md`, and `record-types.md` for the event fields |

No new record type, so there is no `RECORD_FILES` change.

### Acceptance

- **Without `affect.dynamics`**, output is byte-identical to #34 for every
  fixture.
- **§11 as a fixture:** the table's states and basins at each date, and the
  Oct 5 warning.
- **No anchoring stretch:** no state, even with events and a baseline.
- **No baseline:** the state holds after the last event, and the block says
  `not decaying`.
- **A chapter spanning Oct 12–14, with `--as-of` Oct 13:** its event is not
  applied.
- **An event on the anchor's `asOf`:** not applied.
- **A draft stretch:** neither anchors nor is checked.
- **`context.affect: off`:** no block, and replay is not computed.

### Supper Club Secrets

Nothing changes until chapters declare `affect:` and the universe sets
`affect.dynamics`. Book 1 declares none today, so this can ship without
touching its records.

## 13. Open questions (for the author)

1. **§3:** Are label transitions endpoints (recommended) or impulses?
2. **§4:** Should the baseline go in codex frontmatter (recommended), or
   somewhere else?
3. **§5:** One global half-life, or one per character?
4. **§6:** Leave baseline drift out (recommended)?
5. **§10:** Should `affect-discontinuity` also compare a stretch against the
   replay, or only chapter entries?
