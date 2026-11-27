import { z } from 'zod';
import type { DecisionScorer } from './scorer.js';
export declare const CalibrationExampleSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodString;
    context: z.ZodString;
    question: z.ZodObject<{
        type: z.ZodEnum<["binary", "enum", "scale", "move-choice"]>;
        prompt: z.ZodString;
        options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        scale: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, "strip", z.ZodTypeAny, {
        type: "binary" | "enum" | "scale" | "move-choice";
        prompt: string;
        options?: string[] | undefined;
        scale?: [number, number] | undefined;
    }, {
        type: "binary" | "enum" | "scale" | "move-choice";
        prompt: string;
        options?: string[] | undefined;
        scale?: [number, number] | undefined;
    }>;
    expectedLabel: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    context: string;
    id: string;
    category: string;
    question: {
        type: "binary" | "enum" | "scale" | "move-choice";
        prompt: string;
        options?: string[] | undefined;
        scale?: [number, number] | undefined;
    };
    expectedLabel: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    context: string;
    id: string;
    category: string;
    question: {
        type: "binary" | "enum" | "scale" | "move-choice";
        prompt: string;
        options?: string[] | undefined;
        scale?: [number, number] | undefined;
    };
    expectedLabel: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export type CalibrationExample = z.infer<typeof CalibrationExampleSchema>;
export interface CalibrationBucket {
    range: string;
    count: number;
    avgConfidence: number;
    empiricalAccuracy: number;
    gap: number;
}
export interface ScorerCalibrationMetrics {
    scorer: string;
    total: number;
    correct: number;
    accuracy: number;
    brierScore: number;
    ece: number;
    buckets: CalibrationBucket[];
    byCategory: Record<string, {
        total: number;
        correct: number;
        accuracy: number;
        brierScore: number;
    }>;
    predictions: {
        id: string;
        category: string;
        expectedLabel: string;
        predictedLabel: string;
        expectedProb: number;
        topProb: number;
        correct: boolean;
    }[];
}
export interface CalibrationReport {
    datasetSize: number;
    scorers: ScorerCalibrationMetrics[];
    /** Pairwise top-label agreement rate when 2+ scorers are compared (e.g. clef-flash vs clef). */
    pairwiseAgreement: {
        scorerA: string;
        scorerB: string;
        agreementRate: number;
        total: number;
    }[];
}
export declare function parseCalibrationJsonl(content: string): {
    examples: CalibrationExample[];
    errors: string[];
};
export declare function loadCalibrationJsonl(filePath: string): {
    examples: CalibrationExample[];
    errors: string[];
};
export declare function runCalibration(examples: CalibrationExample[], scorers: DecisionScorer[]): Promise<CalibrationReport>;
export declare function renderCalibrationMarkdown(report: CalibrationReport): string;
