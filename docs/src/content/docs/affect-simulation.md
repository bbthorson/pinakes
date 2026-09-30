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
  Noah: "curious → angry"              # labels; the delta runs first step to last
  Jasper: { v: -40, a: -30, d: -50 }   # or the delta itself
```

Keys resolve like `registers:` keys. Each entry compiles to one
[`character.affect.event`](record-types.md#characteraffectevent) whose `delta`
is the last state minus the first, or the numbers given. A longer transition
(`a → b → c`) keeps the first and last for the delta and records the middle in
`stimulus`. A chapter records a shift, so a single label is `affect-malformed`.

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

It comes from the same stretch as the mid tier, so it looks only backward. For
every other stretch the block is absent. To keep it out of drafting altogether:

```yaml
context:
  affect: off     # default: auto
```

## What is not modelled

Coordinates are what the author declared, no more. Pinakes does not yet decay
affect between events, drift a character's baseline under sustained stress, or
replay events into a state at `--as-of`. Those dynamics need their own design,
and until then no record or bundle claims them.
