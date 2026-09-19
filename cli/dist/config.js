import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { z } from 'zod';
export const ConfigSchema = z.object({
    spec: z.number().default(0.1),
    project: z.object({
        name: z.string(),
        nsid: z.string(),
        /**
         * Chapter frontmatter key naming the sequence a chapter belongs to — the
         * grouping between "book" and "chapter". Universes name this differently
         * (a meal, an arc, a case, a session), so the key is configurable and the
         * compiled records carry it under the neutral name `sequence`.
         */
        sequenceField: z.string().default('sequence'),
    }),
    paths: z.object({
        registry: z.string().default('codex/entities.yaml'),
        nonEntities: z.string().default('codex/non_entities.yaml'),
        stories: z.string().default('stories'),
        locations: z.string().default('codex/locations'),
        characters: z.string().default('codex/characters'),
        output: z.string().default('records'),
        /**
         * Glob matching the custom rule files, e.g. `rules/*.yaml`. This is a
         * glob, not a directory: a bare `rules` matches the directory itself and
         * loads nothing.
         */
        rules: z.string().optional(),
    }),
    rules: z.record(z.union([z.literal('error'), z.literal('warning'), z.literal('off')])).default({
        'unresolved-entities': 'error',
        'non-sequential-dates': 'error',
        'co-presence-conflict': 'warning',
    }),
});
export function loadConfig(projectRoot) {
    const possiblePaths = [
        path.join(projectRoot, 'pinakes.yaml'),
        path.join(projectRoot, 'pinakes.yml'),
        path.join(projectRoot, '.pinakes.yaml'),
        path.join(projectRoot, '.pinakes.yml'),
    ];
    let configPath = '';
    let rawContent = '';
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            configPath = p;
            rawContent = fs.readFileSync(p, 'utf-8');
            break;
        }
    }
    if (!configPath) {
        throw new Error(`Could not find pinakes.yaml in ${projectRoot}`);
    }
    const parsed = YAML.parse(rawContent);
    const validated = ConfigSchema.parse(parsed);
    return { config: validated, configPath };
}
