import { z } from 'zod';
export declare const EntitySchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    displayName: z.ZodString;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceFile: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    /**
     * A character's account: its DID, and its handle without the domain.
     * Unchecked here: a malformed value must not drop the whole entry and leave
     * the character unresolvable, so it is carried as written and
     * `invalid-did` / `invalid-handle` report it (see `linter/identity.ts`).
     */
    did: z.ZodOptional<z.ZodUnknown>;
    handle: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: string;
    status: string | null;
    id: string;
    displayName: string;
    aliases: string[];
    sourceFile?: string | null | undefined;
    did?: unknown;
    handle?: unknown;
}, {
    type: string;
    id: string;
    displayName: string;
    status?: string | null | undefined;
    aliases?: string[] | undefined;
    sourceFile?: string | null | undefined;
    did?: unknown;
    handle?: unknown;
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
/**
 * A registry entry that failed schema validation. It is left out of the
 * registry, so every name it would have resolved goes unresolved; this used to
 * be a console warning, and `lint` passed with the entity silently missing.
 */
export interface RegistryInvalidEntry {
    /** The group it sits under: characters, places, or items. */
    group: string;
    /** Its position within the group, since a malformed entry may have no id. */
    index: number;
    /** The entry's id, when it has a string one. */
    id?: string;
    /** Each schema issue, as `field: message`. */
    issues: string[];
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
    /** Entries that failed validation, for `lint` and `compile` to report. */
    readonly invalidEntries: RegistryInvalidEntry[];
    readonly registryFile: string;
    constructor(projectRoot: string, registryRelPath: string, nonEntitiesRelPath: string);
    private loadRegistry;
    private loadNonEntities;
    normalize(raw: string): string;
    isNonEntity(name: string): boolean;
    getEntity(id: string): Entity | undefined;
    resolve(name: string, expectedType: string): ResolvedEntity | null;
    /** The ids an alias is ambiguous between for `type`, or `undefined` if it is not. */
    ambiguity(name: string, type: string): string[] | undefined;
    /** Ambiguous aliases and duplicated ids, for `lint` and `compile` to report. */
    conflicts(): RegistryConflict[];
}
