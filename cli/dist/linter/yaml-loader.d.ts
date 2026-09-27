import { z } from 'zod';
import { Diagnostic, ChapterData } from './engine.js';
/**
 * Each selector accepts only what it can check. Every shape rejected here used
 * to load and then check nothing, so lint passed on a rule that never ran: a
 * stateEvent rule on a field other than `register` (only registers are
 * walked), a stateEvent rule relying on `required` (never read there), and a
 * rule with neither a `pattern` nor `required: true`.
 */
export declare const CustomRuleSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"selector", [z.ZodObject<{
    selector: z.ZodLiteral<"chapter">;
    validate: z.ZodEffects<z.ZodObject<{
        field: z.ZodString;
        pattern: z.ZodOptional<z.ZodString>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    }, {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    }>, {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    }, {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    }>;
    name: z.ZodString;
    description: z.ZodString;
    severity: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"error">, z.ZodLiteral<"warning">]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    selector: "chapter";
    validate: {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    };
    description: string;
    severity: "error" | "warning";
}, {
    name: string;
    selector: "chapter";
    validate: {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    };
    description: string;
    severity?: "error" | "warning" | undefined;
}>, z.ZodObject<{
    selector: z.ZodLiteral<"stateEvent">;
    validate: z.ZodObject<{
        field: z.ZodLiteral<"register">;
        pattern: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        pattern: string;
        field: "register";
    }, {
        pattern: string;
        field: "register";
    }>;
    name: z.ZodString;
    description: z.ZodString;
    severity: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"error">, z.ZodLiteral<"warning">]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    selector: "stateEvent";
    validate: {
        pattern: string;
        field: "register";
    };
    description: string;
    severity: "error" | "warning";
}, {
    name: string;
    selector: "stateEvent";
    validate: {
        pattern: string;
        field: "register";
    };
    description: string;
    severity?: "error" | "warning" | undefined;
}>]>, {
    name: string;
    selector: "chapter";
    validate: {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    };
    description: string;
    severity: "error" | "warning";
} | {
    name: string;
    selector: "stateEvent";
    validate: {
        pattern: string;
        field: "register";
    };
    description: string;
    severity: "error" | "warning";
}, unknown>;
export type CustomRule = z.infer<typeof CustomRuleSchema>;
export declare class YamlRulesLoader {
    private rules;
    private projectRoot;
    constructor(projectRoot: string, rulesGlob?: string);
    private loadRules;
    runCustomRules(chapters: ChapterData[]): Diagnostic[];
}
