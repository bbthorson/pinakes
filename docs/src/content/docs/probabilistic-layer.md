---
title: Probabilistic writing & six-lens review
description: Scene-Mode 3-move character briefs, Clef decision scoring, seeded sampling, POV-locked narrator handoff, and the six-lens temporal review board.
---

Pinakes includes an optional **probabilistic writing and editorial layer** built on top of the deterministic core (`lint`, `compile`, `context`, affect replay, and `prose-check`). Every existing command and record schema remains 100% backward-compatible.

## 1. Guest / book-scoped character stubs in `context`

Minor or guest characters registered in `codex/entities.yaml` without a full series codex file can carry a lightweight book-scoped card at `stories/<story>/characters/<slug>.md`.

`pinakes context` falls back to book-scoped stubs automatically and applies the exact same `context.codex` include/exclude/paragraph and chapter-horizon withholding rules as series codex files. Use `--story <name>` to disambiguate when two books define stubs for the same character:

```sh
pinakes context "Marta Diaz" --as-of 2026-10-12 --story book2
```

## 2. Scene-Mode 3-Move Character Brief (`pinakes brief`)

`pinakes brief` enforces the **Scene-Mode information firewall in code**: each character receives strictly their own `pinakes context <Name> --as-of <date>` with `fullState: false` (never `--full-state`, never `interiority/`, never other characters' private state, never future chapters) plus the immediate scene setup.

```sh
pinakes brief -s book2 -c 6 --as-of 2026-10-12 \
  --characters "Emma,Marta" \
  --setup scene_setup.md \
  -o scratch/briefs/
```

Each character produces a **3-Move Character Brief** (`A`, `B`, `C`) matching `{ id, tactic, notice, say, holdBack, physicalTell }`.

### Cognitive-State Brief Routing (`probabilistic.briefRouting`)

You can optionally configure `probabilistic.briefRouting` in `pinakes.yaml` to map a character's current affect attractor basin (`depressive-exhaustion`, `hyper-vigilant`, `grounded-stoic`, etc.), scene `beatType` (`--beat-type`), scope (`main` vs. `guest`), or character name to a recommended `model` and `reasoningEffort` (`none` | `low` | `medium` | `high`). Each prompt bundle carries its resolved `route`, and `briefModel` / `reasoningEffort` are preserved in `SampleRollLog` for auditing A/B runs.

## 3. Clef Scoring, Pre-Sampling Mask & Seeded Sampler (`pinakes sample`)

Because generative LLMs are poorly calibrated when scoring their own options, `pinakes sample` supports a pluggable `DecisionScorer` with a first-class **Cloudflare Clef** adapter (`@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash`, or any Jev-API endpoint) plus local `mock` and generic LLM fallbacks.

Before sampling, Pinakes evaluates active `doNotReveal` and `heldSecrets` rules (`holdUntil` aware) both deterministically and (when using a scorer) via binary semantic gates in the same batched pass, zeroing out moves that prematurely reveal held beats.

The sampler draws deterministically using `sha256("<book>:<chapter>:<date>:<character>[:reroll]")`, applies a plausibility `floor` (default `0.08`) and `temperature` (default `0.85`, configurable per `beatType`), and emits a structured roll log:

```sh
pinakes sample -b emma_brief.json --scorer clef --beat-type plot-pivot --log emma_roll.json
```

## 4. Single Narrator Pen Handoff (`pinakes compose`)

`pinakes compose` assembles a POV-locked Narrator input bundle from winning moves:
- The **POV character** receives their full winning move (`tactic`, `notice`, `say`, `holdBack`, `physicalTell`).
- Every **non-POV character** has `notice`, `holdBack`, and `tactic` **stripped in code**, exposing only their observable surface (`say` + `physicalTell`).

```sh
pinakes compose --pov Emma --moves emma_roll.json marta_roll.json --setup scene_setup.md
```

## 5. Six-Lens Temporal Review Board (`pinakes review`)

`pinakes review` assembles exact, non-overlapping Author-Mode temporal slices for six distinct lenses:

1. `backward-short`: target chapter + `N` prior chapters + writing guide.
2. `backward-mid`: target chapter + book bible + voice guide + latest stretches + compiled **First-Appearance Entity Ledger** (`records/series/entity_first_appearances.json`, filtered strictly to `<= ch - 1`).
3. `backward-long`: target chapter + compiled records summary + series codex + held-secret policy.
4. `forward-short`: target chapter + upcoming outline beats (next 1–4 chapters).
5. `forward-mid`: target chapter + full book outline + subplot threads + scene-relevant `interiority/` maps.
6. `forward-long`: target chapter + `series_arcs` + `series_plan`.

```sh
pinakes review -s book2 -c 6 --lens all -o scratch/review/
pinakes review -s book2 -c 6 --prepass
```

`--prepass` runs a single batched Clef call (up to 64 typed binary/enum/scale questions: held-secret leaks, POV slips, tone ceiling, clue telegraphing, and ambiguous `prose-check` + `craftVocabulary` triage) with `clef-flash` → `clef` 27B → full-LLM escalation and precedence merging (`firewall > continuity > arc-fair-play > craft`) highlighting multi-lens convergence.

## 6. Calibration (`pinakes calibrate`) & `pinakes.yaml`

Configure the layer under the optional `probabilistic:` block in `pinakes.yaml` (see `template/pinakes.yaml` for all defaults), and verify threshold calibration against a JSONL dataset of labeled beats:

```sh
pinakes calibrate -d calibration_beats.jsonl --scorers clef-flash,clef
```
