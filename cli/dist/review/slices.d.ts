import type { Config } from '../config.js';
import type { Registry } from '../registry/entities.js';
import type { LinterEngine } from '../linter/engine.js';
import { type EntityFirstAppearance } from '../compiler/first-appearances.js';
export declare const TEMPORAL_LENSES: readonly ["backward-short", "backward-mid", "backward-long", "forward-short", "forward-mid", "forward-long"];
export type TemporalLens = (typeof TEMPORAL_LENSES)[number];
export interface SliceDocument {
    label: string;
    path?: string;
    content: string;
}
export interface ReviewSlice {
    lens: TemporalLens;
    purpose: string;
    book: string;
    storyDir: string;
    chapter: number | string;
    chapterFile: string;
    storyDate: string;
    targetChapter: {
        chapterNum: number | string;
        title: string;
        date: string;
        pov: string | null;
        charactersPresent: string[];
        sequence?: number;
        numberedBody: string;
    };
    documents: SliceDocument[];
    /** Present on `backward-mid`: entities named or present strictly before the target chapter. */
    firstAppearancesBeforeChapter?: EntityFirstAppearance[];
    /** Paths configured or expected that were not found on disk (fail-closed transparency). */
    missingInputs: string[];
}
export interface BuildReviewSlicesOptions {
    story: string;
    chapter: number | string;
    lenses?: TemporalLens[];
    priorChapters?: number;
    upcomingChapters?: number;
}
export interface BuildReviewSlicesResult {
    slices: ReviewSlice[];
    errors: string[];
}
/** Numbers prose lines as `L1: ...` so reviewers return exact `lineRef` coordinates. */
export declare function numberLines(text: string): string;
export declare function buildReviewSlices(root: string, config: Config, registry: Registry, engine: LinterEngine, records: any[], options: BuildReviewSlicesOptions): BuildReviewSlicesResult;
export declare function renderReviewSliceMarkdown(slice: ReviewSlice): string;
