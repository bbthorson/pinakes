import { z } from 'zod';
export declare const EntitySchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    displayName: z.ZodString;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceFile: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    status: string | null;
    id: string;
    displayName: string;
    aliases: string[];
    sourceFile?: string | null | undefined;
}, {
    type: string;
    id: string;
    displayName: string;
    status?: string | null | undefined;
    aliases?: string[] | undefined;
    sourceFile?: string | null | undefined;
}>;
export type Entity = z.infer<typeof EntitySchema>;
export interface ResolvedEntity {
    id: string;
    type: string;
}
/**
 * One surface form claimed by more than one entity of the same type, or one id
 * registered twice. Either makes resolution a guess, so the alias resolves to
 * nothing and the conflict is reported instead.
 */
export interface RegistryConflict {
    kind: 'ambiguous-alias' | 'duplicate-id';
    /** The lowercased alias, or the duplicated id. */
    name: string;
    type: string;
    ids: string[];
}
export declare class Registry {
    /**
     * `type -> lowercase(alias) -> entity`. Keyed by type first because every
     * lookup names the type it wants, and a character and a place may
     * legitimately share a name ("Paris").
     */
    private aliasMap;
    /** `type::alias` -> every id claiming it, for aliases more than one entity claims. */
    private ambiguous;
    private nonEntityExact;
    private nonEntityPrefixes;
    allEntities: Entity[];
    readonly registryFile: string;
    constructor(projectRoot: string, registryRelPath: string, nonEntitiesRelPath: string);
    private loadRegistry;
    private loadNonEntities;
    normalize(raw: string): string;
    isNonEntity(name: string): boolean;
    resolve(name: string, expectedType: string): ResolvedEntity | null;
    /** The ids an alias is ambiguous between for `type`, or `undefined` if it is not. */
    ambiguity(name: string, type: string): string[] | undefined;
    /** Ambiguous aliases and duplicated ids, for `lint` and `compile` to report. */
    conflicts(): RegistryConflict[];
}
