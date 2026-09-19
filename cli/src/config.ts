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
  /**
   * Posts are the one authored record type, so they are the one place an author
   * can contradict the prose rather than be derived from it. `publicRegisters`
   * names the register values that permit a character to post at all; every
   * other value means the character is holding something back and should be
   * silent. Which words those are is a property of the universe's own register
   * vocabulary, so it is configured rather than assumed.
   */
  posts: z
    .object({
      publicRegisters: z.array(z.string()).default(['public']),
    })
    .default({ publicRegisters: ['public'] }),
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
        .array(
          z.object({
            label: z.string(),
            pattern: z.string(),
            note: z.string().optional(),
          })
        )
        .optional(),
      carveOuts: z
        .array(
          z.object({
            term: z.string(),
            character: z.string().optional(),
            note: z.string().optional(),
          })
        )
        .default([]),
      closerMaxWords: z.number().default(12),
    })
    .default({ carveOuts: [], closerMaxWords: 12 }),
  rules: z.record(z.union([z.literal('error'), z.literal('warning'), z.literal('off')])).default({
    'unresolved-entities': 'error',
    'non-sequential-dates': 'error',
    'co-presence-conflict': 'warning',
    'post-register': 'error',
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
