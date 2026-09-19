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
        registry: z.string().default('protocol/entities/entities.yaml'),
        nonEntities: z.string().default('protocol/entities/non_entities.yaml'),
        stories: z.string().default('stories'),
        locations: z.string().default('canon library/locations'),
        characters: z.string().default('canon library/characters'),
        output: z.string().default('protocol/records'),
        rules: z.string().optional(),
    }),
    /**
     * `prose-check` configuration. Every field is optional: the defaults are the
     * AI-tells catalogue itself, so the command is useful before a universe
     * configures anything.
     *
     * `signals` replaces the built-in list when given — a universe whose voice
     * legitimately earns a catalogued word ("leverage" in a corporate satire,
     * "symphony" in a lyrical one) should not be made to read that column forever.
     * `carveOuts` names terms the voice guide has already catalogued as designed:
     * they are reported for subtraction, never suppressed, because the judgment
     * pass needs both the raw count and the designed share.
     */
    prose: z
        .object({
        signals: z
            .array(z.object({
            label: z.string(),
            pattern: z.string(),
            note: z.string().optional(),
        }))
            .optional(),
        carveOuts: z
            .array(z.object({
            term: z.string(),
            character: z.string().optional(),
            note: z.string().optional(),
        }))
            .default([]),
        closerMaxWords: z.number().default(12),
    })
        .default({ carveOuts: [], closerMaxWords: 12 }),
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
