import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { z } from 'zod';

export const EntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  displayName: z.string(),
  aliases: z.array(z.string()).default([]),
  sourceFile: z.string().nullable().optional(),
  status: z.string().nullable().optional().default('active'),
  /**
   * A character's account: its DID, and its handle without the domain.
   * Unchecked here: a malformed value must not drop the whole entry and leave
   * the character unresolvable, so it is carried as written and
   * `invalid-did` / `invalid-handle` report it (see `linter/identity.ts`).
   */
  did: z.unknown().optional(),
  handle: z.unknown().optional(),
});

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

export class Registry {
  /**
   * `type -> lowercase(alias) -> entity`. Keyed by type first because every
   * lookup names the type it wants, and a character and a place may
   * legitimately share a name ("Paris").
   */
  private aliasMap = new Map<string, Map<string, ResolvedEntity>>();
  /** `type::alias` -> every id claiming it, for aliases more than one entity claims. */
  private ambiguous = new Map<string, string[]>();
  private nonEntityExact = new Set<string>();
  private nonEntityPrefixes: string[] = [];
  public allEntities: Entity[] = [];
  /** Entries that failed validation, for `lint` and `compile` to report. */
  public readonly invalidEntries: RegistryInvalidEntry[] = [];
  public readonly registryFile: string;

  constructor(projectRoot: string, registryRelPath: string, nonEntitiesRelPath: string) {
    const registryPath = path.resolve(projectRoot, registryRelPath);
    const nonEntitiesPath = path.resolve(projectRoot, nonEntitiesRelPath);
    this.registryFile = path.relative(projectRoot, registryPath);

    this.loadRegistry(registryPath);
    this.loadNonEntities(nonEntitiesPath);
  }

  private loadRegistry(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Registry file not found at ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(raw) || {};

    // entities.yaml groups entities under characters:, places:, items:
    const groups = ['characters', 'places', 'items'];
    for (const group of groups) {
      const items = parsed[group];
      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          const result = EntitySchema.safeParse(item);
          if (!result.success) {
            this.invalidEntries.push({
              group,
              index,
              id: typeof item?.id === 'string' ? item.id : undefined,
              issues: result.error.issues.map((i) => `${i.path.join('.') || '(entry)'}: ${i.message}`),
            });
            return;
          }
          const validated = result.data;
          this.allEntities.push(validated);

          // Add primary displayName and id as aliases
          const aliases = new Set<string>([
            validated.id.toLowerCase(),
            validated.displayName.toLowerCase(),
            ...validated.aliases.map(a => a.toLowerCase())
          ]);

          const byAlias = this.aliasMap.get(validated.type) ?? new Map<string, ResolvedEntity>();
          this.aliasMap.set(validated.type, byAlias);
          for (const alias of aliases) {
            const prior = byAlias.get(alias);
            if (prior && prior.id !== validated.id) {
              const key = `${validated.type}::${alias}`;
              const ids = this.ambiguous.get(key) ?? [prior.id];
              if (!ids.includes(validated.id)) ids.push(validated.id);
              this.ambiguous.set(key, ids);
              continue;
            }
            byAlias.set(alias, { id: validated.id, type: validated.type });
          }
        });
      }
    }
  }

  private loadNonEntities(filePath: string) {
    if (!fs.existsSync(filePath)) {
      return; // non_entities.yaml is optional
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(raw) || {};

    const categories = ['people', 'places', 'montage'];
    for (const cat of categories) {
      const items = parsed[cat];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (typeof item === 'string') {
            this.nonEntityExact.add(item.toLowerCase());
          } else if (item && typeof item === 'object') {
            const pattern = item.pattern || item.id;
            if (typeof pattern === 'string') {
              if (item.prefix === true) {
                this.nonEntityPrefixes.push(pattern.toLowerCase());
              } else {
                this.nonEntityExact.add(pattern.toLowerCase());
              }
            }
          }
        }
      }
    }
  }

  public normalize(raw: string): string {
    let s = raw.trim();
    if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
      s = s.slice(1, -1).trim();
    }
    // strip trailing comment like "Sofia (centerstage)" -> "Sofia"
    s = s.replace(/\s*\([^()]*\)\s*$/, '').trim();
    return s;
  }

  public isNonEntity(name: string): boolean {
    const low = name.toLowerCase();
    if (this.nonEntityExact.has(low)) {
      return true;
    }
    return this.nonEntityPrefixes.some(prefix => low.startsWith(prefix));
  }

  public getEntity(id: string): Entity | undefined {
    return this.allEntities.find((e) => e.id === id);
  }

  public resolve(name: string, expectedType: string): ResolvedEntity | null {
    const norm = this.normalize(name);
    if (!norm) return null;
    const alias = norm.toLowerCase();
    if (this.ambiguous.has(`${expectedType}::${alias}`)) return null;
    return this.aliasMap.get(expectedType)?.get(alias) ?? null;
  }

  /** The ids an alias is ambiguous between for `type`, or `undefined` if it is not. */
  public ambiguity(name: string, type: string): string[] | undefined {
    return this.ambiguous.get(`${type}::${this.normalize(name).toLowerCase()}`);
  }

  /** Ambiguous aliases and duplicated ids, for `lint` and `compile` to report. */
  public conflicts(): RegistryConflict[] {
    const out: RegistryConflict[] = [];
    const seen = new Map<string, Entity>();
    for (const ent of this.allEntities) {
      if (seen.has(ent.id)) out.push({ kind: 'duplicate-id', name: ent.id, type: ent.type, ids: [ent.id] });
      else seen.set(ent.id, ent);
    }
    for (const [key, ids] of this.ambiguous) {
      const [type, ...rest] = key.split('::');
      out.push({ kind: 'ambiguous-alias', name: rest.join('::'), type, ids });
    }
    return out;
  }
}
