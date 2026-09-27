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
});
export class Registry {
    /**
     * `type -> lowercase(alias) -> entity`. Keyed by type first because every
     * lookup names the type it wants, and a character and a place may
     * legitimately share a name ("Paris").
     */
    aliasMap = new Map();
    /** `type::alias` -> every id claiming it, for aliases more than one entity claims. */
    ambiguous = new Map();
    nonEntityExact = new Set();
    nonEntityPrefixes = [];
    allEntities = [];
    /** Entries that failed validation, for `lint` and `compile` to report. */
    invalidEntries = [];
    registryFile;
    constructor(projectRoot, registryRelPath, nonEntitiesRelPath) {
        const registryPath = path.resolve(projectRoot, registryRelPath);
        const nonEntitiesPath = path.resolve(projectRoot, nonEntitiesRelPath);
        this.registryFile = path.relative(projectRoot, registryPath);
        this.loadRegistry(registryPath);
        this.loadNonEntities(nonEntitiesPath);
    }
    loadRegistry(filePath) {
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
                    const aliases = new Set([
                        validated.id.toLowerCase(),
                        validated.displayName.toLowerCase(),
                        ...validated.aliases.map(a => a.toLowerCase())
                    ]);
                    const byAlias = this.aliasMap.get(validated.type) ?? new Map();
                    this.aliasMap.set(validated.type, byAlias);
                    for (const alias of aliases) {
                        const prior = byAlias.get(alias);
                        if (prior && prior.id !== validated.id) {
                            const key = `${validated.type}::${alias}`;
                            const ids = this.ambiguous.get(key) ?? [prior.id];
                            if (!ids.includes(validated.id))
                                ids.push(validated.id);
                            this.ambiguous.set(key, ids);
                            continue;
                        }
                        byAlias.set(alias, { id: validated.id, type: validated.type });
                    }
                });
            }
        }
    }
    loadNonEntities(filePath) {
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
                    }
                    else if (item && typeof item === 'object') {
                        const pattern = item.pattern || item.id;
                        if (typeof pattern === 'string') {
                            if (item.prefix === true) {
                                this.nonEntityPrefixes.push(pattern.toLowerCase());
                            }
                            else {
                                this.nonEntityExact.add(pattern.toLowerCase());
                            }
                        }
                    }
                }
            }
        }
    }
    normalize(raw) {
        let s = raw.trim();
        if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
            s = s.slice(1, -1).trim();
        }
        // strip trailing comment like "Sofia (centerstage)" -> "Sofia"
        s = s.replace(/\s*\([^()]*\)\s*$/, '').trim();
        return s;
    }
    isNonEntity(name) {
        const low = name.toLowerCase();
        if (this.nonEntityExact.has(low)) {
            return true;
        }
        return this.nonEntityPrefixes.some(prefix => low.startsWith(prefix));
    }
    resolve(name, expectedType) {
        const norm = this.normalize(name);
        if (!norm)
            return null;
        const alias = norm.toLowerCase();
        if (this.ambiguous.has(`${expectedType}::${alias}`))
            return null;
        return this.aliasMap.get(expectedType)?.get(alias) ?? null;
    }
    /** The ids an alias is ambiguous between for `type`, or `undefined` if it is not. */
    ambiguity(name, type) {
        return this.ambiguous.get(`${type}::${this.normalize(name).toLowerCase()}`);
    }
    /** Ambiguous aliases and duplicated ids, for `lint` and `compile` to report. */
    conflicts() {
        const out = [];
        const seen = new Map();
        for (const ent of this.allEntities) {
            if (seen.has(ent.id))
                out.push({ kind: 'duplicate-id', name: ent.id, type: ent.type, ids: [ent.id] });
            else
                seen.set(ent.id, ent);
        }
        for (const [key, ids] of this.ambiguous) {
            const [type, ...rest] = key.split('::');
            out.push({ kind: 'ambiguous-alias', name: rest.join('::'), type, ids });
        }
        return out;
    }
}
