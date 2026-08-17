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
  rules: z.record(z.union([z.literal('error'), z.literal('warning'), z.literal('off')])).default({
    'unresolved-entities': 'error',
    'non-sequential-dates': 'error',
    'co-presence-conflict': 'warning',
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(projectRoot: string): { config: Config; configPath: string } {
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
