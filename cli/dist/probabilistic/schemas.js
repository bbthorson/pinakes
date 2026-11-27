/**
 * Typed schemas for the probabilistic Scene-Mode writing layer:
 * - 3-Move Character Brief (A, B, C)
 * - Pre-sampling constraint rules (`doNotReveal` / `heldSecrets`)
 * - Seeded Sampler roll log
 * - POV-locked Narrator Handoff bundle (observable surface vs. POV interiority)
 */
import { z } from 'zod';
export const MoveIdSchema = z.enum(['A', 'B', 'C']);
export const CharacterMoveSchema = z.object({
    id: MoveIdSchema,
    tactic: z.string().min(1),
    notice: z.string(),
    say: z.string(),
    holdBack: z.string(),
    physicalTell: z.string(),
});
export const ReasoningEffortSchema = z.enum(['none', 'low', 'medium', 'high']);
export const CharacterBriefSchema = z
    .object({
    character: z.string().min(1),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'asOf must be YYYY-MM-DD'),
    book: z.string().min(1),
    chapter: z.union([z.number(), z.string()]),
    beatType: z.string().optional(),
    /** Optional audit fields recording which model & reasoning effort generated this brief. */
    briefModel: z.string().optional(),
    reasoningEffort: ReasoningEffortSchema.optional(),
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
