/**
 * Standardized editorial ReviewFinding schema, multi-lens convergence
 * detection, and precedence-ordered merging.
 *
 * Precedence order (highest to lowest):
 * 1. `firewall`      — held-secret firewall & compiled reader surfaces
 * 2. `continuity`    — continuity / canon accuracy / POV lock
 * 3. `arc-fair-play` — arc / setup-to-payoff / fair-play provenance
 * 4. `craft`         — prose craft / AI tells / seam polish
 */
import { z } from 'zod';
import { type TemporalLens } from './slices.js';
export type ReviewLens = TemporalLens | 'probabilistic-lint';
export type FindingSeverity = 'blocker' | 'warn' | 'note';
export type FindingCategory = 'firewall' | 'continuity' | 'arc-fair-play' | 'craft';
export declare const ReviewFindingSchema: z.ZodObject<{
    lens: z.ZodEnum<["backward-short", "backward-mid", "backward-long", "forward-short", "forward-mid", "forward-long", "probabilistic-lint"]>;
    severity: z.ZodEnum<["blocker", "warn", "note"]>;
    category: z.ZodOptional<z.ZodEnum<["firewall", "continuity", "arc-fair-play", "craft"]>>;
    lineRef: z.ZodString;
    issue: z.ZodString;
    fix: z.ZodString;
    confidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    severity: "note" | "blocker" | "warn";
    lens: "backward-short" | "backward-mid" | "backward-long" | "forward-short" | "forward-mid" | "forward-long" | "probabilistic-lint";
    lineRef: string;
    issue: string;
    fix: string;
    category?: "firewall" | "continuity" | "arc-fair-play" | "craft" | undefined;
    confidence?: number | undefined;
}, {
    severity: "note" | "blocker" | "warn";
    lens: "backward-short" | "backward-mid" | "backward-long" | "forward-short" | "forward-mid" | "forward-long" | "probabilistic-lint";
    lineRef: string;
    issue: string;
    fix: string;
    category?: "firewall" | "continuity" | "arc-fair-play" | "craft" | undefined;
    confidence?: number | undefined;
}>;
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export interface MergedReviewFinding extends ReviewFinding {
    category: FindingCategory;
    /** True when 2+ distinct lenses independently flagged overlapping lines. */
    convergent: boolean;
    /** All distinct lenses that converged on this line span. */
    convergentLenses: ReviewLens[];
}
export interface ConvergenceCluster {
    lineSpan: string;
    lenses: ReviewLens[];
    findings: MergedReviewFinding[];
}
export interface MergedReviewReport {
    findings: MergedReviewFinding[];
    convergences: ConvergenceCluster[];
    counts: {
        total: number;
        blocker: number;
        warn: number;
        note: number;
        convergentClusters: number;
    };
}
/** Default precedence category inferred from the lens when not explicitly set. */
export declare function defaultCategoryForLens(lens: ReviewLens): FindingCategory;
export declare function parseLineSpan(lineRef: string): {
    start: number;
    end: number;
} | null;
export declare function mergeReviewFindings(rawFindings: ReviewFinding[]): MergedReviewReport;
export declare function renderMergedFindingsMarkdown(report: MergedReviewReport): string;
