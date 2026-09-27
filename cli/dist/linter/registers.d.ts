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
export declare function parseRegister(value: string): ParsedRegister;
