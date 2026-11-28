/**
 * Witness / off-page knowledge check for `pinakes review --prepass`.
 *
 * Uses compiled `characters_present` (`scene.participants`) from prior chapters
 * in the same book to flag when a character in Chapter N recounts or quotes a
 * specific on-page beat from Chapter N-1 (or earlier) where that character was
 * NOT in `characters_present` and no message/handoff scene or cue bridges them.
 *
 * Findings are emitted as advisory warnings (`severity: 'warn'`) in the
 * `backward-short` lens.
 */
import type { ReviewFinding } from './findings.js';
export interface PriorChapterWitnessInfo {
    chapterNum: number | string;
    title: string;
    /** Canonical character IDs from compiled `characters_present` (`scene.participants`). */
    participants: string[];
    body: string;
    beatPurpose?: string | null;
}
export interface TargetCharacterSurface {
    id: string;
    displayName: string;
    /** Surface forms (displayName + aliases) used to detect attribution in prose. */
    names: string[];
}
export interface WitnessCheckInput {
    targetChapterNum: number | string;
    targetBody: string;
    targetPovId?: string | null;
    targetCharacters: TargetCharacterSurface[];
    /** Prior chapters in the same book, ordered chronologically up to Chapter N-1. */
    priorChapters: PriorChapterWitnessInfo[];
}
/**
 * Flags characters in Chapter N who recount or quote a specific on-page beat
 * from an earlier chapter where they were not in `characters_present` and no
 * intervening message/handoff scene bridges them.
 */
export declare function detectWitnessKnowledgeIssues(input: WitnessCheckInput): ReviewFinding[];
