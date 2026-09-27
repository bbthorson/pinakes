/**
 * Parses a chapter's register annotation, such as
 * `under-pressure (hostess hyperdrive) → private (the quiet kitchen confide)`.
 *
 * The compiler and the `stateEvent` custom-rule selector both read these, and
 * they used to parse them differently. The linter kept parentheticals, so
 * `private (curious)` was tested in full against a register vocabulary and
 * failed (86 false positives on Supper Club Secrets Book 1), and it checked only
 * the term left of the arrow. The compiler cut at the first `(`, so the example
 * above compiled with the expression `under-pressure`, dropping the
 * transition. One parser keeps them agreeing.
 */
export interface ParsedRegister {
  /** The register the chapter opens in: the first step. */
  register: string;
  /** The annotation with every parenthetical removed, e.g. `under-pressure → private`. */
  expr: string;
  /** Every register the annotation passes through, in order. */
  steps: string[];
}

export function parseRegister(value: string): ParsedRegister {
  let text = value.trim();
  // Parentheticals are notes, and a note may contain its own arrow
  // (`private (curious → quietly alarmed)` is one register, not a transition).
  // Strip innermost groups until none are left, then anything after an
  // unclosed `(`.
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(/\s*\([^()]*\)/g, '');
  }
  text = text.replace(/\s*\(.*$/, '').trim().replace(/;$/, '').trim();

  const steps = text.split(/\s*(?:->|→)\s*/).map((s) => s.trim()).filter(Boolean);
  return { register: steps[0] ?? '', expr: text, steps };
}
