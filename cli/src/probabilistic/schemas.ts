/**
 * Typed schemas for the probabilistic Scene-Mode writing layer:
 * - 3-Move Character Brief (A, B, C)
 * - Pre-sampling constraint rules (`doNotReveal` / `heldSecrets`)
 * - Seeded Sampler roll log
 * - POV-locked Narrator Handoff bundle (observable surface vs. POV interiority)
 */
import { z } from 'zod';

export const MoveIdSchema = z.enum(['A', 'B', 'C']);
export type MoveId = z.infer<typeof MoveIdSchema>;

export const CharacterMoveSchema = z.object({
  id: MoveIdSchema,
  tactic: z.string().min(1),
  notice: z.string(),
  say: z.string(),
  holdBack: z.string(),
  physicalTell: z.string(),
});
export type CharacterMove = z.infer<typeof CharacterMoveSchema>;

export const CharacterBriefSchema = z
  .object({
    character: z.string().min(1),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'asOf must be YYYY-MM-DD'),
    book: z.string().min(1),
    chapter: z.union([z.number(), z.string()]),
    beatType: z.string().optional(),
    moves: z.tuple([CharacterMoveSchema, CharacterMoveSchema, CharacterMoveSchema]),
  })
  .superRefine((brief, ctx) => {
    const ids = new Set(brief.moves.map((m) => m.id));
    if (!ids.has('A') || !ids.has('B') || !ids.has('C')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['moves'],
        message: 'A 3-Move Character Brief must contain exactly one move each with id "A", "B", and "C".',
      });
    }
  });
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
  writingGuide?: { path: string; content: string };
  narratorGuidance: string[];
}
