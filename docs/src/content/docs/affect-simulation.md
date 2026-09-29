---
title: "Affect simulation & mathematical model"
description: "The mathematical dynamical system, two-timescale leaky-integrator, and AT Protocol Lexicon records for character psychological states."
---

To represent and query a character's internal psychological state on the AT Protocol, Pinakes treats the character's Personal Data Server (PDS) as an **append-only affective ledger**.

Rather than storing mutable emotional state in a single profile record (which erases character history and suffers from catastrophic LLM drift), Pinakes structures character interiority across **two complementary timescales**:
1. **High-Frequency Transitions (`character.affect.event`)**: Discrete episodic shocks, conflicts, and register transitions with continuous VAD deltas and Reward Prediction Errors.
2. **Low-Frequency Baselines (`character.stretch`)**: Consolidated psychological checkpoints containing qualitative interiority, continuous VAD coordinates, dynamic attractor basins, unresolved tensions (`carrying`), and prompt-injection behavioral constraints.

This mirrors biological memory consolidation and allows writing pipelines or LLM agents to fetch either the latest snapshot or replay the event stream to understand *why* a character is spiraling, guarded, or resolute.

---

## 1. Mathematical Formulation

### State Variables & Coordinate Space

At any point in story time $\tau_t$, a character's psychological state is represented in 3-dimensional **PAD/VAD space** (Valence, Arousal, Dominance):

* **Immediate Affect Vector** $x_t \in [-1.0, 1.0]^3$:
  $$x_t = \begin{bmatrix} v_t \\ a_t \\ d_t \end{bmatrix}$$
  * $v$ (**Valence**): Hedonic pleasure / positive affect vs. pain / dysphoria $[-1.0, 1.0]$.
  * $a$ (**Arousal**): Autonomic activation / sympathetic nervous arousal vs. hypo-arousal / lethargy $[-1.0, 1.0]$.
  * $d$ (**Dominance**): Subjective agency / perceived control vs. helplessness / submissiveness $[-1.0, 1.0]$.

* **Homeostatic Attractor Baseline** $\mu_t \in [-1.0, 1.0]^3$:
  The character's slow-moving resting equilibrium (temperament, baseline resilience, and accumulated allostatic load).

> [!NOTE]
> **AT Protocol Lexicon Serialization**:
> AT Protocol Lexicon 1 uses deterministic 32-bit signed integers rather than floating-point numbers to ensure consistent hashing across Merkle DAGs. Pinakes normalizes all continuous float coordinates and deltas to integer basis points scaled to $[-100, 100]$, and Reward Prediction Error to $[-200, 200]$.

---

### Fast-Timescale: Continuous Homeostatic Relaxation

Between narrative shocks and across elapsed story time $\Delta\tau$ (measured in days), immediate affect exponentially relaxes toward the character's baseline attractor $\mu_t$:

$$x_{t + \Delta\tau} = \mu_t + (x_t - \mu_t) \cdot e^{-\lambda \Delta\tau}$$

* $\lambda$: Fast relaxation decay rate (default $\lambda = 0.15$, corresponding to a half-life of $\approx 4.6$ narrative days).
* When $\Delta\tau \to \infty$, $x_t \to \mu_t$.
* Immediate agitation or adrenaline dissolves over days unless sustained by fresh narrative stimuli.

---

### Slow-Timescale: Allostatic Baseline Adaptation

When a character remains trapped in an extreme affective state for an extended duration (chronic grief, prolonged siege, unrelenting pressure), their baseline attractor $\mu$ is gradually dragged toward that state:

$$\mu_{t+1} = \operatorname{clip}\left(\mu_t + \alpha (x_t - \mu_t) \Delta\tau, -1.0, 1.0\right)$$

* $\alpha \ll \lambda$: Allostatic drag coefficient (default $\alpha = 0.03$).
* Prolonged stress shifts the character's baseline valence downward and baseline arousal upward, modeling chronic trauma, burnout, or deepened security.

---

### Episodic Shocks & Reward Prediction Error (RPE)

When an episodic narrative event occurs (a revelation, conflict beat, or betrayal), it induces an instantaneous impulse $\Delta x$ modulated by **Reward Prediction Error** $\delta_{\text{rpe}} \in [-2.0, 2.0]$:

$$\delta_{\text{rpe}} = R_{\text{actual}} - R_{\text{expected}}$$

* **$\delta_{\text{rpe}} > 0$**: Unexpected relief, breakthrough, windfall.
* **$\delta_{\text{rpe}} < 0$**: Ambush, betrayal, sudden failure.

The modulated impulse shifts the immediate affect vector:

$$\Delta x_{\text{modulated}} = \Delta x + \begin{bmatrix} \beta_v \cdot \delta_{\text{rpe}} \\ \beta_a \cdot |\delta_{\text{rpe}}| \\ \beta_d \cdot \delta_{\text{rpe}} \end{bmatrix}$$

$$x_t^{\text{post}} = \operatorname{clip}\left( x_t + \Delta x_{\text{modulated}}, -1.0, 1.0 \right)$$

* $\beta = [\beta_v = 0.3, \beta_a = 0.2, \beta_d = 0.25]$.
* Negative RPE crashes valence, elevates autonomic arousal (panic/shock), and suppresses agency/dominance.

---

## 2. Phase-Space Attractor Basins

Non-linear qualitative behavioral modes emerge when the continuous vector $(v, a, d)$ enters specific geometric partitions of phase space:

| Attractor Basin | Geometric Partition | Narrative Characteristics |
|---|---|---|
| **`hyper-vigilant`** | $a > 0.35 \;\land\; v < -0.15$ | Threat scanning, paranoia, curt speech, assuming deception. |
| **`depressive-exhaustion`** | $a < -0.25 \;\land\; v < -0.25 \;\land\; d < -0.15$ | Psychomotor slowing, fatalism, emotional blunting, low agency. |
| **`manic-fixation`** | $a > 0.45 \;\land\; d > 0.25 \;\land\; |v| > 0.20$ | Obsessive pacing, rapid monologue, tunneling on a single goal. |
| **`grounded-stoic`** | default equilibrium ($\|a\| \le 0.35 \;\land\; v \ge -0.15$) | Measured cadence, high agency, active situational awareness. |
| **`dissociative-numb`** | $a < -0.45 \;\land\; |v| \le 0.25 \;\land\; d < -0.20$ | Flat affect, robotic compliance, detachment from surroundings. |

### Behavioral Constraints

Each attractor basin automatically generates concrete prompt-injection behavioral constraints:

* **`hyper-vigilant`**:
  * *Dialogue cadence must be rapid, guarded, or interrogative.*
  * *Subtext prioritizes scanning environment and tracking signs of deception.*
  * *Hesitates to disclose personal commitments or vulnerable details.*
* **`depressive-exhaustion`**:
  * *Dialogue cadence must be sparse, flat, or delayed.*
  * *Subtext reflects psychomotor exhaustion, fatalism, and reluctance to invest effort.*
  * *Responds primarily in monosyllables or low-effort acquiescence.*
* **`grounded-stoic`**:
  * *Dialogue cadence is measured, steady, and deliberative.*
  * *Subtext exhibits high agency, emotional containment, and active situational awareness.*
  * *Evaluates conflicts pragmatically without panic or despair.*

---

## 3. Authoring Workflow: Text $\to$ Deterministic Math

Authors and writing agents do **not** manually calculate floating-point vectors. Instead, Pinakes deterministically compiles math from intuitive frontmatter annotations:

### Chapter Register Transitions (`chapters/*.md`)

In chapter frontmatter, authors annotate qualitative registers and shifts:

```yaml
registers:
  Emma: "private (curious → quietly alarmed)"
  Dorothy: "public (warm)"
```

When `pinakes compile` runs:
1. `parseAffectTransition` extracts the transition steps: `curious` ($[0.4, 0.3, 0.2]$) to `quietly alarmed` ($[-0.4, 0.4, -0.1]$).
2. `calculateRegisterDelta` computes $\Delta x = [-0.8, 0.1, -0.3]$.
3. Coordinates are scaled to integer basis points: `valence: -80, arousal: 10, dominance: -30`.
4. An `affect.event` record is written to `records/<book>/character_affect_events.json`.

### Checkpoint Stretches (`stretches/*.md`)

Stretches represent periodic observation checkpoints where a character reflects on recent events:

```yaml
---
character: Emma
asOf: "2026-10-02"
since: "2026-08-06"
register: private
status: approved
carrying:
  - "savings that go down and not up"
  - "whether walking out was worth it"
  - "Sunday's menu, revised four times on receipts"
---
Two months ago she was still on the line...
```

When compiled:
1. `resolveRegisterVad` evaluates the baseline register (`private` $\to [0.1, -0.1, 0.1]$).
2. `classifyAttractorBasin` derives `grounded-stoic`.
3. `getBehavioralDirectives` computes actionable prompt constraints.
4. `supersedes` chains to the previous stretch across books.
5. The `character.stretch` record is decorated with `coordinates`, `attractorBasin`, and `behavioralDirectives` and written to `records/<book>/character_stretches.json`.

---

## 4. Prompt Injection with `pinakes context`

Running `pinakes context <Character> --as-of <Date>` automatically resolves the character's active affect snapshot and formats an LLM-ready prompt injection block:

```bash
pinakes context Emma --as-of 2026-10-04
```

Yields:

```markdown
## Affect state (generation prompt injection)

[INTERNAL_AFFECT_STATE]
DIMENSIONS: Valence=0.10 | Arousal=-0.10 | Dominance=0.10 | Baseline=0.10
ATTRACTOR: grounded-stoic
ACTIVE_TENSIONS:
  - "savings that go down and not up"
  - "whether walking out was worth it"
  - "Sunday's menu, revised four times on receipts"
  - "three years of asking about the man at McGolrick's hot sauce"
BEHAVIORAL_CONSTRAINTS:
  - Dialogue cadence is measured, steady, and deliberative.
  - Subtext exhibits high agency, emotional containment, and active situational awareness.
  - Evaluates conflicts pragmatically without panic or despair.
[/INTERNAL_AFFECT_STATE]
```

This block is injected directly into generative agents' system prompts prior to drafting subsequent scenes.

---

## 5. Decentralized Multi-Author Affective Collisions

Because Pinakes records conform to AT Protocol Lexicon standards, multiple authors or autonomous agents can interact across different repositories:

1. **Character A** writes an `affect.event` to its own repo with an AT-URI pointer referencing **Character B**.
2. **Character B**'s agent subscribes to the Firehose (`com.atproto.sync.subscribeRepos`), detects the citation, and evaluates its own psychological filter.
3. Character B updates its own `affect.snapshot` and publishes it to its own Personal Data Server (PDS).

This provides a decentralized, multi-agent affective simulation without requiring a centralized game server.
