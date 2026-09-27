import { z } from 'zod';
import { Diagnostic, ChapterData } from './engine.js';
export declare const CustomRuleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    severity: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"error">, z.ZodLiteral<"warning">]>>;
    selector: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"chapter">, z.ZodLiteral<"stateEvent">]>>;
    validate: z.ZodObject<{
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
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    severity: "error" | "warning";
    selector: "chapter" | "stateEvent";
    validate: {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    };
}, {
    name: string;
    description: string;
    validate: {
        field: string;
        pattern?: string | undefined;
        required?: boolean | undefined;
    };
    severity?: "error" | "warning" | undefined;
    selector?: "chapter" | "stateEvent" | undefined;
}>;
export type CustomRule = z.infer<typeof CustomRuleSchema>;
export declare class YamlRulesLoader {
    private rules;
    private projectRoot;
    constructor(projectRoot: string, rulesGlob?: string);
    private loadRules;
    runCustomRules(chapters: ChapterData[]): Diagnostic[];
}
