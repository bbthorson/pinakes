/**
 * Typed schemas for the probabilistic Scene-Mode writing layer:
 * - 3-Move Character Brief (A, B, C)
 * - Pre-sampling constraint rules (`doNotReveal` / `heldSecrets`)
 * - Seeded Sampler roll log
 * - POV-locked Narrator Handoff bundle (observable surface vs. POV interiority)
 */
import { z } from 'zod';
export declare const MoveIdSchema: z.ZodEnum<["A", "B", "C"]>;
export type MoveId = z.infer<typeof MoveIdSchema>;
export declare const CharacterMoveSchema: z.ZodObject<{
    id: z.ZodEnum<["A", "B", "C"]>;
    tactic: z.ZodString;
    notice: z.ZodString;
    say: z.ZodString;
    holdBack: z.ZodString;
    physicalTell: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: "A" | "B" | "C";
    tactic: string;
    notice: string;
    say: string;
    holdBack: string;
    physicalTell: string;
}, {
    id: "A" | "B" | "C";
    tactic: string;
    notice: string;
    say: string;
    holdBack: string;
    physicalTell: string;
}>;
export type CharacterMove = z.infer<typeof CharacterMoveSchema>;
export declare const CharacterBriefSchema: z.ZodEffects<z.ZodObject<{
    character: z.ZodString;
    asOf: z.ZodString;
    book: z.ZodString;
    chapter: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    beatType: z.ZodOptional<z.ZodString>;
    moves: z.ZodTuple<[z.ZodObject<{
        id: z.ZodEnum<["A", "B", "C"]>;
        tactic: z.ZodString;
        notice: z.ZodString;
        say: z.ZodString;
        holdBack: z.ZodString;
        physicalTell: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }>, z.ZodObject<{
        id: z.ZodEnum<["A", "B", "C"]>;
        tactic: z.ZodString;
        notice: z.ZodString;
        say: z.ZodString;
        holdBack: z.ZodString;
        physicalTell: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }>, z.ZodObject<{
        id: z.ZodEnum<["A", "B", "C"]>;
        tactic: z.ZodString;
        notice: z.ZodString;
        say: z.ZodString;
        holdBack: z.ZodString;
        physicalTell: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }>], null>;
}, "strip", z.ZodTypeAny, {
    character: string;
    book: string;
    chapter: string | number;
    asOf: string;
    moves: [{
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }];
    beatType?: string | undefined;
}, {
    character: string;
    book: string;
    chapter: string | number;
    asOf: string;
    moves: [{
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }];
    beatType?: string | undefined;
}>, {
    character: string;
    book: string;
    chapter: string | number;
    asOf: string;
    moves: [{
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }];
    beatType?: string | undefined;
}, {
    character: string;
    book: string;
    chapter: string | number;
    asOf: string;
    moves: [{
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }, {
        id: "A" | "B" | "C";
        tactic: string;
        notice: string;
        say: string;
        holdBack: string;
        physicalTell: string;
    }];
    beatType?: string | undefined;
}>;
export type CharacterBrief = z.infer<typeof CharacterBriefSchema>;
export interface HoldUntil {
    book?: string;
    chapter?: number;
    date?: string;
}
export interface SecretConstraintRule {
    id: string;
    description: string;
    terms: string[];
    patterns: string[];
    holdUntil?: HoldUntil;
    checkFields: ('tactic' | 'notice' | 'say' | 'holdBack' | 'physicalTell')[];
}
export interface MoveMaskResult {
    moveId: MoveId;
    masked: boolean;
    reasons: string[];
}
export interface SampleRollLog {
    seedInput: string;
    seedHash: string;
    u: number;
    floor: number;
    temperature: number;
    beatType?: string;
    reroll?: string | number;
    scorer: string;
    rawProbs: Record<MoveId, number>;
    maskedMoves: MoveId[];
    maskReasons: Partial<Record<MoveId, string[]>>;
    floorDroppedMoves: MoveId[];
    adjustedProbs: Record<MoveId, number>;
    chosenMoveId: MoveId;
    chosenMove: CharacterMove;
}
/**
 * The observable surface of a non-POV character's winning move.
 * `notice`, `holdBack`, and `tactic` are structurally absent so third-person-limited
 * head-hopping is prevented in code.
 */
export interface ObservableCharacterMove {
    character: string;
    characterId?: string;
    say: string;
    physicalTell: string;
}
export interface PovCharacterMove {
    character: string;
    characterId?: string;
    id: MoveId;
    tactic: string;
    notice: string;
    say: string;
    holdBack: string;
    physicalTell: string;
}
export interface NarratorHandoffBundle {
    book?: string;
    chapter?: number | string;
    asOf?: string;
    sceneSetup: string;
    pov: PovCharacterMove;
    others: ObservableCharacterMove[];
    writingGuide?: {
        path: string;
        content: string;
    };
    narratorGuidance: string[];
}
