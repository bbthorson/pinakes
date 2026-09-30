---
title: "Affect"
description: "Declaring a character's affective state as VAD coordinates, the attractor basins they fall in, and the advisory block pinakes context prints."
---

Pinakes can carry a character's affect, meaning what state they are in, as
coordinates in **VAD space**: valence (pleasant to unpleasant), arousal
(activated to lethargic) and dominance (in control to helpless). Each runs from
−100 to 100 in records, since Lexicon has integers and no floats.

**Affect is declared, never inferred.** It lives in its own `affect:` field. A
chapter or stretch without one gets no coordinates, and a label Pinakes cannot
resolve is reported, never scored as neutral.

## Affect is not a register

A voice register (`public`, `private`, `under-pressure`) says who the character
is talking to and how guarded they are. It describes their speech. Affect says
what state they are in. A character can be in a `public` register and
furious.

The two used to share a field: the first version of this engine gave registers
fixed coordinates and read affect out of the register annotation's
parenthetical. On Supper Club Secrets Book 1, every stretch got its register's
numbers rather than the character's, most chapter events were scored from
labels nothing recognised, and `pinakes context` told the drafter to write a
character in performative chaos as "measured, steady, and deliberative". So
registers have no coordinates, the parenthetical in `registers:` stays a note,
and affect is written where it can be checked.

## Declaring affect

### In a chapter: a shift

```yaml
registers:
  Noah: "under-pressure (asks the right questions, then lashes out)"
affect:
  Noah: "curious → angry"              # labels: he enters curious and ends angry
  Jasper: { v: -40, a: -30, d: -50 }   # or a shift from wherever he was
```

Keys resolve like `registers:` keys. Each entry compiles to one
[`character.affect.event`](/pinakes/record-types/#characteraffectevent).

- **A label transition is an endpoint.** The character ends the chapter in its
  last step, whatever they entered with. The first step is your claim about
  how they entered, which the [continuity check](#the-continuity-check) tests.
  The event records both (`from`, `to`) and `delta`, the last minus the first.
- **Numbers are a shift**, added to whatever state the character was in.

A longer transition (`a → b → c`) keeps the first and last and records the
middle in `stimulus`. A chapter records a change, so a single label is
`affect-malformed`.

### In a stretch: a state

```yaml
---
character: Emma
asOf: "2026-10-02"
register: private
affect: subdued            # or { v: -20, a: -30, d: -30 }
---
```

A stretch that declares `affect:` compiles with `coordinates` and, when they
fall in a basin, an `attractorBasin` and `behavioralDirectives`. Without
`affect:` it has none of them. A stretch is authored deliberately, so an
unresolved label there is an error (`stretch-affect-unresolved`).

Affect in a stretch follows the stretch rules: character knowledge only, and
never a state that names something the character cannot know yet.

## The vocabulary belongs to the universe

Pinakes ships a small core of labels: `alarmed`, `quietly alarmed`, `panic`,
`paralyzed`, `guarded`, `curious`, `warm`, `elated`, `defiant`, `deflating`,
`exhausted`, `stoic`, `skeptical`, `animated`, `conflicted`, `softening`.
`pinakes.yaml` adds to it or overrides it, with integers in [−100, 100]:

```yaml
affect:
  labels:
    angry:    { v: -60, a: 60, d: 40 }
    relieved: { v: 40, a: -50, d: 10, aliases: [relief] }
```

Matching is exact after lower-casing and collapsing whitespace, and nothing
looser: `not warm` does not resolve to `warm`. An alias that collides with
another label or alias is a config error, because the label would otherwise
resolve to whichever entry was read last.

## Attractor basins

A coordinate may fall in a basin, a named region with drafting tendencies.
The built-in five are tried in this order (values on the −1 to 1 scale):

| Basin | Region |
|---|---|
| `hyper-vigilant` | `a > 0.35` and `v < -0.15` |
| `depressive-exhaustion` | `a < -0.25`, `v < -0.25` and `d < -0.15` |
| `manic-fixation` | `a > 0.45`, `d > 0.25` and `\|v\| > 0.20` |
| `dissociative-numb` | `a < -0.45`, `\|v\| <= 0.25` and `d < -0.20` |
| `grounded-stoic` | `\|a\| <= 0.35` and `v >= -0.15` |

A coordinate none of them claims has **no basin**, and the record carries no
basin and no directives. `grounded-stoic` is a band, not a leftover: high
arousal with positive valence is not measured and steady.

A universe can phrase the built-in basins' tendencies in its own voice-guide
terms, and add basins for regions the built-ins leave. An added basin needs
inclusive integer bounds (`when`, any of `v`, `a`, `d`) and directives, and is
tried after the built-ins, in the order listed:

```yaml
affect:
  basins:
    grounded-stoic:
      directives: ["Says less than they know."]
    buoyant:
      when: { v: [20, 100], a: [36, 100] }
      directives: ["Talks fast and laughs at their own jokes."]
```

## In `pinakes context`

When the latest approved stretch on or before `--as-of` declared its affect and
landed in a basin, the bundle includes:

```markdown
## Affect state (advisory — the voice guide and register win on any conflict)

[INTERNAL_AFFECT_STATE]
DIMENSIONS: Valence=-0.20 | Arousal=-0.30 | Dominance=-0.30
ATTRACTOR: ...
SUGGESTED_TENDENCIES:
  - ...
[/INTERNAL_AFFECT_STATE]
```

Without [dynamics](#between-declarations-dynamics) it is the mid-tier
stretch's declared affect, so it looks only backward. For every other stretch
the block is absent. To keep it out of drafting altogether:

```yaml
context:
  affect: off     # default: auto
```

## Between declarations: dynamics

Declarations are sparse: a stretch every few weeks, and a chapter only where
something moves. Dynamics carry a character's state between them, so the
bundle can answer "how is he a week after the shock?"

They are off until a universe chooses a rate. There is no default, because a
rate nobody chose would be a number that looks like data:

```yaml
affect:
  dynamics:
    halfLifeDays: 4        # required: turns dynamics on
    discontinuity: 60      # optional: turns on the continuity check
```

Each character's temperament goes in their codex frontmatter:

```yaml
# codex/characters/noah.md
affectBaseline: { v: 0, a: 10, d: 20 }   # or a label; the state they relax toward
affectHalfLifeScale: 2                   # optional: holds a grudge twice as long
```

`affectHalfLifeScale` multiplies the universe's half-life, so retuning the
universe moves everyone and keeps their differences. A value that is not a
positive number, or a baseline that is not one resolvable label or triple, is
`affect-malformed`, and that character is not replayed at all. These fields
are checked even with dynamics off, so a bad value fails when it is written.

### How the state is computed

For a character on a date:

1. **Start** from their latest *approved* stretch on or before the date that
   declares `affect:`. If there is none, there is **no state**. Pinakes never
   gives a character a state nobody declared.
2. **Replay** their affect events that ended after that stretch's `asOf` and
   on or before the date, in order. An event ending on the stretch's own date
   is already in it, since a stretch looks back over its day. A chapter still
   running on the date has not happened yet.
3. **Between events**, the state relaxes toward the baseline:
   `x = b + (x₀ − b) · 0.5^(days / halfLife)`, counting whole days from each
   chapter's last date. With no `affectBaseline`, nothing decays: the state
   holds, and the block says `not decaying: no baseline`.
4. **Classify** the result into a basin, as for a stretch.

A new stretch re-anchors the replay: the author wins. The baseline itself
never drifts; to say a character's temperament has changed, change
`affectBaseline`.

With dynamics on, the `context` block shows its working:

```
[INTERNAL_AFFECT_STATE]
DIMENSIONS: Valence=-0.36 | Arousal=0.36 | Dominance=0.28
ATTRACTOR: hyper-vigilant
ANCHOR: stretch.jasper.book1.2026-10-02
EVENT: affect.event.jasper.book1.ch14 (ended 2026-10-05, 3 days before)
DECAY: half-life 4 days toward baseline
SUGGESTED_TENDENCIES:
  - ...
[/INTERNAL_AFFECT_STATE]
```

The state is computed when asked for, never compiled into records: it changes
whenever a chapter or the rate is edited, and record ids are permanent. The
library returns it from `affectStateAt(universe, character, asOf)`.

### The continuity check

With `discontinuity` set, `lint` checks your declarations against each other:

- **Entering a chapter.** A transition's first step is compared with the
  state the replay has the character in going into it.
- **At a stretch.** A stretch's declared affect is compared with the state
  replayed from the stretch before it.

Where the two are further apart than `discontinuity` (straight-line distance
in the −100 to 100 units), `affect-discontinuity` warns. It is never an error:
the jump may be meant, and off-page events happen. The stretch still
re-anchors either way; the warning only asks the question.
