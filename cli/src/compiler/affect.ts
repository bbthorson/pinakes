/**
 * Mathematical dynamical system for character affective state.
 *
 * Implements a two-timescale leaky-integrator with homeostatic relaxation,
 * allostatic baseline adaptation, reward prediction error (RPE) modulation,
 * and phase-space attractor basin classification.
 *
 * Mathematical Foundations:
 * -------------------------
 * 1. Bounded Continuous PAD/VAD State Space:
 *    At any story time \tau_t, a character's state consists of:
 *      - Fast immediate affect vector: x_t = [v_t, a_t, d_t]^T \in [-1.0, 1.0]^3
 *      - Slow homeostatic attractor:   \mu_t = [\mu_{v,t}, \mu_{a,t}, \mu_{d,t}]^T \in [-1.0, 1.0]^3
 *    Where:
 *      - v (Valence):   Pleasure / positive valence vs. pain / dysphoria
 *      - a (Arousal):   Autonomic activation / adrenaline vs. lethargy / hypo-arousal
 *      - d (Dominance): Agency / perceived control vs. helplessness / submissiveness
 *
 *    Note on AT Protocol Lexicon serialization:
 *    AT Protocol Lexicons enforce determinism using 32-bit signed integers.
 *    Coordinates and deltas are stored as basis-point percentages scaled to [-100, 100],
 *    and RPE is scaled to [-200, 200].
 *
 * 2. Continuous Homeostatic Relaxation (Fast Timescale):
 *    Between narrative shocks, immediate affect exponentially relaxes toward baseline:
 *      x_{t + \Delta\tau} = \mu_t + (x_t - \mu_t) \cdot e^{-\lambda \Delta\tau}
 *    Where \Delta\tau is elapsed narrative time in days, and \lambda is the decay rate.
 *
 * 3. Allostatic Adaptation (Slow Timescale):
 *    Chronic exposure to high-stress or depressed states shifts the baseline:
 *      \mu_{t+1} = \operatorname{clip}(\mu_t + \alpha (x_t - \mu_t) \Delta\tau, -1.0, 1.0)
 *    Where \alpha \ll \lambda is the allostatic drag coefficient.
 *
 * 4. Episodic Shocks & Reward Prediction Error (RPE):
 *    A narrative stimulus induces an instantaneous impulse \Delta x and an RPE \delta_{rpe} \in [-2.0, 2.0]:
 *      \delta_{rpe} = R_{actual} - R_{expected}
 *    Modulation:
 *      \Delta x_{modulated} = \Delta x + [ \beta_v \cdot \delta_{rpe}, \beta_a \cdot |\delta_{rpe}|, \beta_d \cdot \delta_{rpe} ]^T
 *      x_{t}^{post} = \operatorname{clip}(x_t + \Delta x_{modulated}, -1.0, 1.0)
 *
 * 5. Attractor Basins:
 *    Non-linear qualitative behavioral modes partitioned over VAD phase space:
 *      - hyper-vigilant:        a > 0.35 \land v < -0.15
 *      - depressive-exhaustion: a < -0.25 \land v < -0.25 \land d < -0.15
 *      - manic-fixation:        a > 0.45 \land d > 0.25 \land |v| > 0.20
 *      - dissociative-numb:     a < -0.45 \land |v| \le 0.25 \land d < -0.20
 *      - grounded-stoic:        default resting / deliberate agency
 */

export interface VadVector {
  valence: number;   // [-1.0, 1.0]
  arousal: number;   // [-1.0, 1.0]
  dominance: number; // [-1.0, 1.0]
}

export interface ScaledVad {
  valence: number;   // [-100, 100]
  arousal: number;   // [-100, 100]
  dominance: number; // [-100, 100]
}

export interface ScaledAffectCoordinates extends ScaledVad {
  baselineValence: number; // [-100, 100]
}

export type AttractorBasin =
  | 'hyper-vigilant'
  | 'depressive-exhaustion'
  | 'manic-fixation'
  | 'grounded-stoic'
  | 'dissociative-numb';

export interface AffectSimulationParams {
  /** Fast relaxation rate toward baseline (\lambda). Default = 0.15 (~4.6-day half-life). */
  relaxationRate: number;
  /** Slow allostatic baseline drag coefficient (\alpha). Default = 0.03. */
  allostaticRate: number;
  /** RPE modulation coefficients [\beta_v, \beta_a, \beta_d]. */
  rpeSensitivity: {
    valence: number;   // default 0.3
    arousal: number;   // default 0.2
    dominance: number; // default 0.25
  };
}

export const DEFAULT_AFFECT_PARAMS: AffectSimulationParams = {
  relaxationRate: 0.15,
  allostaticRate: 0.03,
  rpeSensitivity: {
    valence: 0.3,
    arousal: 0.2,
    dominance: 0.25,
  },
};

/** Clamps a number to [min, max]. */
export function clip(val: number, min = -1.0, max = 1.0): number {
  return Math.max(min, Math.min(max, val));
}

/** Scales continuous [-1.0, 1.0] float to [-100, 100] integer. */
export function toScaledInt(val: number, min = -100, max = 100): number {
  return Math.round(clip(val * 100, min, max));
}

/** Converts integer scaled value [-100, 100] back to continuous [-1.0, 1.0] float. */
export function fromScaledInt(val: number): number {
  return clip(val / 100, -1.0, 1.0);
}

/** Scales a continuous VadVector to integer ScaledVad. */
export function scaleVad(v: VadVector): ScaledVad {
  return {
    valence: toScaledInt(v.valence),
    arousal: toScaledInt(v.arousal),
    dominance: toScaledInt(v.dominance),
  };
}

/** Unscales an integer ScaledVad to continuous VadVector. */
export function unscaleVad(s: ScaledVad): VadVector {
  return {
    valence: fromScaledInt(s.valence),
    arousal: fromScaledInt(s.arousal),
    dominance: fromScaledInt(s.dominance),
  };
}

/** Computes the continuous exponential relaxation of affect toward baseline across \Delta\tau days. */
export function relaxAffect(
  current: VadVector,
  baseline: VadVector,
  deltaDays: number,
  lambda = DEFAULT_AFFECT_PARAMS.relaxationRate
): VadVector {
  if (deltaDays <= 0) return { ...current };
  const decay = Math.exp(-lambda * deltaDays);
  return {
    valence: clip(baseline.valence + (current.valence - baseline.valence) * decay),
    arousal: clip(baseline.arousal + (current.arousal - baseline.arousal) * decay),
    dominance: clip(baseline.dominance + (current.dominance - baseline.dominance) * decay),
  };
}

/** Computes slow allostatic baseline adaptation under sustained affect. */
export function adaptBaseline(
  current: VadVector,
  baseline: VadVector,
  deltaDays: number,
  alpha = DEFAULT_AFFECT_PARAMS.allostaticRate
): VadVector {
  if (deltaDays <= 0) return { ...baseline };
  // Saturated linear drag with bounds
  const dragFactor = Math.min(1.0, alpha * deltaDays);
  return {
    valence: clip(baseline.valence + (current.valence - baseline.valence) * dragFactor),
    arousal: clip(baseline.arousal + (current.arousal - baseline.arousal) * dragFactor),
    dominance: clip(baseline.dominance + (current.dominance - baseline.dominance) * dragFactor),
  };
}

/**
 * Applies an episodic stimulus impulse and RPE shock to an immediate affect vector.
 */
export function applyEpisodicShock(
  current: VadVector,
  impulse: VadVector,
  rpe = 0.0,
  params = DEFAULT_AFFECT_PARAMS
): VadVector {
  const boundedRpe = clip(rpe, -2.0, 2.0);
  const vShift = impulse.valence + params.rpeSensitivity.valence * boundedRpe;
  const aShift = impulse.arousal + params.rpeSensitivity.arousal * Math.abs(boundedRpe);
  const dShift = impulse.dominance + params.rpeSensitivity.dominance * boundedRpe;

  return {
    valence: clip(current.valence + vShift),
    arousal: clip(current.arousal + aShift),
    dominance: clip(current.dominance + dShift),
  };
}

/**
 * Classifies an affect vector into one of 5 canonical attractor basins.
 */
export function classifyAttractorBasin(vad: VadVector): AttractorBasin {
  const { valence: v, arousal: a, dominance: d } = vad;

  // 1. Hyper-vigilant: elevated autonomic arousal with dysphoric/fear valence
  if (a > 0.35 && v < -0.15) {
    return 'hyper-vigilant';
  }

  // 2. Depressive-exhaustion: collapsed arousal, dysphoria, and low agency
  if (a < -0.25 && v < -0.25 && d < -0.15) {
    return 'depressive-exhaustion';
  }

  // 3. Manic-fixation: surging arousal, elevated agency, obsessive charge
  if (a > 0.45 && d > 0.25 && Math.abs(v) > 0.2) {
    return 'manic-fixation';
  }

  // 4. Dissociative-numb: severe hypo-arousal with flat affect and suppressed dominance
  if (a < -0.45 && Math.abs(v) <= 0.25 && d < -0.2) {
    return 'dissociative-numb';
  }

  // 5. Grounded-stoic: homeostatic equilibrium, high/moderate agency, deliberate
  return 'grounded-stoic';
}

/**
 * Generates prompt-injection behavioral constraints tailored to an attractor basin.
 */
export function getBehavioralDirectives(basin: AttractorBasin): string[] {
  switch (basin) {
    case 'hyper-vigilant':
      return [
        'Dialogue cadence must be rapid, guarded, or interrogative.',
        'Subtext prioritizes scanning environment and tracking signs of deception.',
        'Hesitates to disclose personal commitments or vulnerable details.',
      ];
    case 'depressive-exhaustion':
      return [
        'Dialogue cadence must be sparse, flat, or delayed.',
        'Subtext reflects psychomotor exhaustion, fatalism, and reluctance to invest effort.',
        'Responds primarily in monosyllables or low-effort acquiescence.',
      ];
    case 'manic-fixation':
      return [
        'Dialogue cadence is intense, rapid-fire, and prone to monologue bursts.',
        'Subtext tunnels aggressively on the active objective to the exclusion of other cues.',
        'Dismisses risks and overestimates personal control.',
      ];
    case 'dissociative-numb':
      return [
        'Dialogue cadence is mechanical, compliant, or flatly detached.',
        'Subtext exhibits blunted affect and physical disconnection from surroundings.',
        'Observes high-stakes developments with eerie neutrality.',
      ];
    case 'grounded-stoic':
    default:
      return [
        'Dialogue cadence is measured, steady, and deliberative.',
        'Subtext exhibits high agency, emotional containment, and active situational awareness.',
        'Evaluates conflicts pragmatically without panic or despair.',
      ];
  }
}

/**
 * Standard register vocabulary mappings to canonical VAD coordinates.
 * Allows authors to write qualitative register tags while Pinakes compiles
 * deterministic mathematical coordinates.
 */
export const STANDARD_REGISTER_VAD: Record<string, VadVector> = {
  // Baseline social modes
  private: { valence: 0.1, arousal: -0.1, dominance: 0.1 },
  public: { valence: 0.2, arousal: 0.2, dominance: 0.2 },
  under_pressure: { valence: -0.3, arousal: 0.6, dominance: 0.1 },
  'under-pressure': { valence: -0.3, arousal: 0.6, dominance: 0.1 },

  // Acute affective states
  alarmed: { valence: -0.6, arousal: 0.7, dominance: -0.3 },
  'quietly alarmed': { valence: -0.4, arousal: 0.4, dominance: -0.1 },
  panic: { valence: -0.8, arousal: 0.9, dominance: -0.6 },
  paralyzed: { valence: -0.7, arousal: 0.5, dominance: -0.8 },
  guarded: { valence: -0.2, arousal: 0.3, dominance: 0.1 },
  curious: { valence: 0.4, arousal: 0.3, dominance: 0.2 },
  warm: { valence: 0.6, arousal: 0.1, dominance: 0.3 },
  elated: { valence: 0.8, arousal: 0.6, dominance: 0.5 },
  defiant: { valence: -0.1, arousal: 0.6, dominance: 0.6 },
  deflating: { valence: -0.5, arousal: -0.3, dominance: -0.4 },
  exhausted: { valence: -0.4, arousal: -0.6, dominance: -0.5 },
  stoic: { valence: 0.0, arousal: -0.2, dominance: 0.4 },
  skeptical: { valence: -0.1, arousal: 0.2, dominance: 0.3 },
  animated: { valence: 0.5, arousal: 0.5, dominance: 0.3 },
  conflicted: { valence: -0.3, arousal: 0.4, dominance: -0.1 },
  softening: { valence: 0.3, arousal: -0.2, dominance: 0.1 },
};

/**
 * Resolves a register string or qualitative label to a base VadVector.
 * Falls back to neutral resting state if unknown.
 */
export function resolveRegisterVad(registerName: string): VadVector {
  const norm = registerName.trim().toLowerCase().replace(/\s+/g, ' ');
  if (STANDARD_REGISTER_VAD[norm]) return STANDARD_REGISTER_VAD[norm];

  // Try substring matching
  for (const [key, vad] of Object.entries(STANDARD_REGISTER_VAD)) {
    if (norm.includes(key)) return vad;
  }

  // Default neutral
  return { valence: 0.0, arousal: 0.0, dominance: 0.0 };
}

/**
 * Calculates the delta between two register names or steps.
 */
export function calculateRegisterDelta(fromRegister: string, toRegister: string): VadVector {
  const fromVad = resolveRegisterVad(fromRegister);
  const toVad = resolveRegisterVad(toRegister);
  return {
    valence: clip(toVad.valence - fromVad.valence),
    arousal: clip(toVad.arousal - fromVad.arousal),
    dominance: clip(toVad.dominance - fromVad.dominance),
  };
}

/**
 * Formats an LLM system prompt injection block from an affect snapshot.
 */
export function formatAffectPromptInjection(snapshot: {
  coordinates: ScaledAffectCoordinates;
  attractorBasin: string;
  openTensions?: string[];
  behavioralDirectives?: string[];
}): string {
  const coords = snapshot.coordinates;
  const v = (coords.valence / 100).toFixed(2);
  const a = (coords.arousal / 100).toFixed(2);
  const d = (coords.dominance / 100).toFixed(2);
  const b = (coords.baselineValence / 100).toFixed(2);

  const lines: string[] = [
    '[INTERNAL_AFFECT_STATE]',
    `DIMENSIONS: Valence=${v} | Arousal=${a} | Dominance=${d} | Baseline=${b}`,
    `ATTRACTOR: ${snapshot.attractorBasin}`,
  ];

  if (snapshot.openTensions && snapshot.openTensions.length > 0) {
    lines.push('ACTIVE_TENSIONS:');
    for (const tension of snapshot.openTensions) {
      lines.push(`  - "${tension.replace(/"/g, '\\"')}"`);
    }
  }

  if (snapshot.behavioralDirectives && snapshot.behavioralDirectives.length > 0) {
    lines.push('BEHAVIORAL_CONSTRAINTS:');
    for (const directive of snapshot.behavioralDirectives) {
      lines.push(`  - ${directive}`);
    }
  }

  lines.push('[/INTERNAL_AFFECT_STATE]');
  return lines.join('\n');
}

export interface AffectTransition {
  fromRegister: string;
  toRegister: string;
  note?: string;
}

/**
 * Extracts the starting and ending qualitative registers from an author's register string,
 * handling transitions inside or outside parentheticals (e.g. "private (curious -> quietly alarmed)"
 * or "public -> private (hostess softening)").
 */
export function parseAffectTransition(val: string): AffectTransition {
  const raw = val.trim();
  const arrowMatch = raw.match(/(?:->|→)/);
  if (arrowMatch) {
    // Check if transition is inside parentheses: e.g. "private (curious → quietly alarmed)"
    const parenMatch = raw.match(/\(([^()]+)\)/);
    if (parenMatch && /(?:->|→)/.test(parenMatch[1])) {
      const innerSteps = parenMatch[1].split(/\s*(?:->|→)\s*/).map((s) => s.trim()).filter(Boolean);
      return {
        fromRegister: innerSteps[0],
        toRegister: innerSteps[innerSteps.length - 1],
        note: parenMatch[1],
      };
    }
    // Arrow outside parentheses: e.g. "public → private (hostess persona softening)"
    const cleaned = raw.replace(/\s*\([^()]*\)/g, '').trim();
    const outerSteps = cleaned.split(/\s*(?:->|→)\s*/).map((s) => s.trim()).filter(Boolean);
    const parenNote = parenMatch ? parenMatch[1] : undefined;
    return {
      fromRegister: outerSteps[0] ?? 'private',
      toRegister: outerSteps[outerSteps.length - 1] ?? outerSteps[0] ?? 'private',
      note: parenNote,
    };
  }

  // No arrow: e.g. "private (curious)" or "public"
  const parenMatch = raw.match(/\(([^()]+)\)/);
  const base = raw.replace(/\s*\([^()]*\)/g, '').trim();
  if (parenMatch) {
    return {
      fromRegister: base || 'private',
      toRegister: parenMatch[1].trim(),
      note: parenMatch[1].trim(),
    };
  }
  return {
    fromRegister: base,
    toRegister: base,
  };
}

