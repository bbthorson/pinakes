/**
 * Keystatic CMS collections for a Pinakes universe: chapters, posts,
 * stretches, and the character, place and item codex files.
 *
 * Keystatic is strict about frontmatter (@keystatic/core 0.5): **an entry
 * whose file has a key the schema does not name will not open** ("Key on object
 * value ... is not allowed"), and a save writes only the schema's keys. The
 * first version of these schemas named keys Pinakes never reads and missed
 * ones it does, so every Supper Club Secrets chapter, post, character and
 * place failed to open, and entries created in the CMS came out wrong: post
 * authors under `character` rather than `author`, a single `register` string
 * rather than the `registers:` map, `did`/`handle` in codex frontmatter (which
 * `lint` rejects), places with no `id`.
 *
 * So each schema here names exactly the keys Pinakes reads, as fields that
 * round-trip them unchanged:
 *
 * - A value Keystatic can edit without reshaping it gets an editable field.
 * - A value it cannot model (a map keyed by character name, a label-or-numbers
 *   union, an object) gets `fields.ignored()`: kept exactly as written, and
 *   edited in the file rather than the CMS.
 * - Keys only a universe uses (its own `clues:`, `day:`, public blurbs) are the
 *   universe's to declare, through `extraFields`. An entry with an undeclared
 *   key will not open, which is Keystatic's behaviour and at least never
 *   silent.
 *
 * The one change a save makes to a value Pinakes reads is cosmetic: an absent
 * list field is written as `[]`.
 *
 * This module must stay free of Node imports: Keystatic bundles its config
 * into the browser.
 */

export type PinakesCollectionName = 'chapters' | 'posts' | 'stretches' | 'characters' | 'places' | 'items';

export interface PinakesKeystaticOptions {
  /** Path to the story directory, relative to keystatic.config.ts (e.g. '../stories/01-missing-hot-sauce'). */
  storyDir: string;
  /** Book URL slug for chapter previews (e.g. 'missing-hot-sauce'). */
  bookSlug?: string;
  /** Path to the codex directory, relative to keystatic.config.ts. Defaults to '../codex'. */
  codexDir?: string;
  /**
   * The chapter frontmatter key naming a chapter's sequence: the universe's
   * `project.sequenceField` in pinakes.yaml. Defaults to `sequence`, as there.
   */
  sequenceField?: string;
  /**
   * Fields for frontmatter keys the universe uses and Pinakes does not read,
   * per collection. Every key an entry's file carries must be named somewhere,
   * or Keystatic will not open the entry; use `fields.ignored()` for one that
   * should be kept but not edited. A key Pinakes already names is rejected,
   * since redefining it could reshape a value Pinakes reads.
   */
  extraFields?: Partial<Record<PinakesCollectionName, Record<string, unknown>>>;
}

const list = (fields: any, label: string, item: string) =>
  fields.array(fields.text({ label: item }), { label, itemLabel: (props: any) => props.value || item });

/** Chapter frontmatter, as `pinakes lint` and `compile` read it. */
export function chapterFields(fields: any, options: { sequenceField?: string } = {}) {
  return {
    title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } }, slug: { label: 'Filename' } }),
    chapter: fields.integer({ label: 'Chapter number', validation: { isRequired: true } }),
    [options.sequenceField ?? 'sequence']: fields.integer({ label: 'Sequence number' }),
    part: fields.integer({ label: 'Part' }),
    date: fields.text({
      label: 'Story date',
      description: 'YYYY-MM-DD, or a range such as "2026-10-12 to 2026-10-14".',
      validation: { isRequired: true },
    }),
    publishDate: fields.text({ label: 'Publish date', description: 'When the chapter drops, e.g. 2026-10-04T22:30:00-04:00.' }),
    location: list(fields, 'Locations', 'Location'),
    pov: fields.text({ label: 'POV character' }),
    characters_present: list(fields, 'Characters present', 'Character'),
    characters_referenced: list(fields, 'Characters referenced', 'Character'),
    // Maps keyed by character name, and `affect` values may be labels or
    // numbers. Keystatic has no field for either, so they are kept as written.
    registers: fields.ignored(),
    affect: fields.ignored(),
    custody: fields.array(
      fields.object({
        item: fields.text({ label: 'Item', validation: { isRequired: true } }),
        holder: fields.text({ label: 'Holder', validation: { isRequired: true } }),
        from: fields.text({ label: 'From' }),
        event: fields.text({ label: 'What happens', multiline: true }),
      }),
      { label: 'Custody hand-offs', itemLabel: (props: any) => props.fields.item.value || 'Hand-off' }
    ),
    beat: fields.text({ label: 'Beat' }),
    beat_purpose: fields.text({ label: 'Beat purpose', multiline: true }),
    tags: list(fields, 'Tags', 'Tag'),
    content: fields.markdoc({ label: 'Prose', extension: 'md' }),
  };
}

/** Authored in-character posts. */
export function postFields(fields: any) {
  return {
    // Keystatic writes a slug field's value under its own key, so the slug
    // field is a key the file already has. A separate `filename` field wrote a
    // stray `filename: ""` into every post saved. The filename is edited
    // beside the date; post ids come from the chapter, author and order.
    date: fields.slug({
      name: { label: 'Story date (YYYY-MM-DD)', validation: { isRequired: true } },
      slug: { label: 'Filename', description: 'e.g. 2026-10-04-emma-01' },
    }),
    author: fields.text({ label: 'Author (character name)', validation: { isRequired: true } }),
    chapter: fields.integer({ label: 'Chapter number', description: 'The chapter the post is anchored to.' }),
    time: fields.text({ label: 'Story time (e.g. 19:42)' }),
    publish: fields.text({ label: 'Publish date' }),
    reply_to: fields.text({ label: 'Reply to (post id)' }),
    mentions: list(fields, 'Mentions', 'Character'),
    location: fields.text({ label: 'Location' }),
    tags: list(fields, 'Tags', 'Tag'),
    note: fields.text({ label: 'Note (authoring direction, never compiled)', multiline: true }),
    content: fields.markdoc({ label: 'Post body', extension: 'md' }),
  };
}

/** Character stretches: `stretches/<character-slug>/<asOf>.md`. */
export function stretchFields(fields: any) {
  return {
    asOf: fields.slug({
      name: { label: 'As of (YYYY-MM-DD)', validation: { isRequired: true } },
      // `lint` (stretch-filename) reports a stretch filed anywhere else.
      slug: { label: 'Path', description: 'character-slug/asOf, e.g. emma/2026-10-02' },
    }),
    character: fields.text({ label: 'Character', validation: { isRequired: true } }),
    since: fields.text({ label: 'Since (YYYY-MM-DD)', validation: { isRequired: true } }),
    register: fields.text({ label: 'Register' }),
    status: fields.select({
      label: 'Status',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Approved', value: 'approved' },
      ],
      defaultValue: 'draft',
    }),
    carrying: list(fields, 'Carrying', 'Phrase'),
    sources: list(fields, 'Sources (record ids)', 'Record id'),
    // A label or `{ v, a, d }`.
    affect: fields.ignored(),
    note: fields.text({ label: 'Note (authoring direction, never compiled)', multiline: true }),
    content: fields.markdoc({ label: 'The stretch', extension: 'md' }),
  };
}

/**
 * Character codex files. A character's identity (`id`, `displayName`, `did`,
 * `handle`) lives on their registry entry, not here: `lint` rejects a `did` or
 * `handle` in codex frontmatter.
 */
export function characterFields(fields: any) {
  return {
    title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } }, slug: { label: 'Filename' } }),
    description: fields.text({ label: 'Description', multiline: true }),
    status: fields.text({ label: 'Status' }),
    tags: list(fields, 'Tags', 'Tag'),
    // A label or `{ v, a, d }`.
    affectBaseline: fields.ignored(),
    affectHalfLifeScale: fields.number({ label: 'Affect half-life scale', description: 'Multiplies the universe half-life. Blank for 1.' }),
    content: fields.markdoc({ label: 'Codex', extension: 'md' }),
  };
}

/** Location codex files. */
export function placeFields(fields: any) {
  return {
    title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } }, slug: { label: 'Filename' } }),
    id: fields.text({
      label: 'Place id',
      description: 'e.g. place.the-diner. A file without a place. id is not compiled.',
      validation: { isRequired: true, pattern: { regex: /^place\./, message: 'Must start with place.' } },
    }),
    description: fields.text({ label: 'Description', multiline: true }),
    status: fields.text({ label: 'Status' }),
    region: fields.text({ label: 'Region' }),
    neighborhood: fields.text({ label: 'Neighborhood' }),
    first_appearance: fields.text({ label: 'First appearance' }),
    tags: list(fields, 'Tags', 'Tag'),
    // Opening hours, an object.
    schedule: fields.ignored(),
    content: fields.markdoc({ label: 'Location', extension: 'md' }),
  };
}

/** Item codex files. An item's identity lives on its registry entry. */
export function itemFields(fields: any) {
  return {
    title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } }, slug: { label: 'Filename' } }),
    description: fields.text({ label: 'Description', multiline: true }),
    tags: list(fields, 'Tags', 'Tag'),
    content: fields.markdoc({ label: 'Item', extension: 'md' }),
  };
}

function withExtras<S extends Record<string, unknown>>(
  name: PinakesCollectionName,
  schema: S,
  extra: Record<string, unknown> = {}
): S & Record<string, unknown> {
  for (const key of Object.keys(extra)) {
    if (key in schema) {
      throw new Error(
        `extraFields.${name}.${key}: Pinakes already defines '${key}' for ${name}. Redefining it could reshape a value Pinakes reads.`
      );
    }
  }
  // `content` stays last so the body editor sits below the frontmatter.
  const { content, ...rest } = schema;
  return { ...rest, ...extra, content } as unknown as S & Record<string, unknown>;
}

/**
 * Keystatic collections for a Pinakes universe.
 *
 * @param fields The `fields` export from `@keystatic/core`
 * @param options Universe paths, the sequence key, and the universe's own fields
 */
export function createPinakesCollections(fields: any, options: PinakesKeystaticOptions) {
  const { storyDir, bookSlug = 'book1', codexDir = '../codex', extraFields = {} } = options;
  const entry = { format: { contentField: 'content' }, entryLayout: 'content' as const };

  return {
    chapters: {
      label: 'Chapters',
      slugField: 'title',
      path: `${storyDir}/chapters/*`,
      ...entry,
      previewUrl: `/books/${bookSlug}/read/{slug}`,
      schema: withExtras('chapters', chapterFields(fields, options), extraFields.chapters),
    },
    posts: {
      label: 'In-character posts',
      slugField: 'date',
      path: `${storyDir}/posts/*`,
      ...entry,
      schema: withExtras('posts', postFields(fields), extraFields.posts),
    },
    stretches: {
      label: 'Stretches',
      slugField: 'asOf',
      path: `${storyDir}/stretches/**`,
      ...entry,
      schema: withExtras('stretches', stretchFields(fields), extraFields.stretches),
    },
    characters: {
      label: 'Characters',
      slugField: 'title',
      path: `${codexDir}/characters/*`,
      ...entry,
      previewUrl: '/characters/{slug}',
      schema: withExtras('characters', characterFields(fields), extraFields.characters),
    },
    places: {
      label: 'Places',
      slugField: 'title',
      path: `${codexDir}/locations/*`,
      ...entry,
      previewUrl: '/places/{slug}',
      schema: withExtras('places', placeFields(fields), extraFields.places),
    },
    items: {
      label: 'Items',
      slugField: 'title',
      path: `${codexDir}/items/*`,
      ...entry,
      schema: withExtras('items', itemFields(fields), extraFields.items),
    },
  };
}
