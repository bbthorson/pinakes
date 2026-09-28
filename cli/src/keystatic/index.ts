/**
 * Keystatic CMS integration for Pinakes universes.
 *
 * Provides schema and collection generators that map Pinakes' creative layer
 * (chapters, posts, stretches, characters, places, items) directly into
 * Keystatic collections.
 */

export interface PinakesKeystaticOptions {
  /** Path to story directory relative to keystatic.config.ts (e.g. '../stories/01-missing-hot-sauce') */
  storyDir: string;
  /** Book URL slug (e.g. 'missing-hot-sauce') */
  bookSlug?: string;
  /** Path to codex directory relative to keystatic.config.ts (defaults to '../codex') */
  codexDir?: string;
}

/**
 * Field definitions for a Pinakes narrative chapter.
 */
export function chapterFields(fields: any) {
  return {
    chapterNumber: fields.slug({
      name: { label: 'Chapter Number (e.g. 01)' },
    }),
    title: fields.text({
      label: 'Title',
      validation: { isRequired: true },
    }),
    chapter: fields.integer({
      label: 'Chapter Number (Integer)',
      validation: { isRequired: true },
    }),
    meal: fields.integer({
      label: 'Sequence / Meal Number',
      validation: { isRequired: false },
    }),
    date: fields.text({
      label: 'Story Date (YYYY-MM-DD or range)',
    }),
    day: fields.text({
      label: 'Calendar Day (e.g. "Sunday, Oct 4")',
    }),
    time: fields.text({
      label: 'Time of Day',
    }),
    pov: fields.text({
      label: 'POV Character (Entity ID or Name)',
    }),
    location: fields.array(fields.text({ label: 'Location' }), {
      label: 'Locations Present',
      itemLabel: (props: any) => props.value || 'Location',
    }),
    characters_present: fields.array(fields.text({ label: 'Character' }), {
      label: 'Characters Present',
      itemLabel: (props: any) => props.value || 'Character',
    }),
    characters_referenced: fields.array(fields.text({ label: 'Referenced' }), {
      label: 'Characters Referenced',
      itemLabel: (props: any) => props.value || 'Referenced',
    }),
    items_present: fields.array(fields.text({ label: 'Item ID' }), {
      label: 'Items Present',
      itemLabel: (props: any) => props.value || 'Item',
    }),
    custody: fields.array(fields.text({ label: 'Custody Expression' }), {
      label: 'Item Custody Changes',
      itemLabel: (props: any) => props.value || 'Custody',
    }),
    beat: fields.text({
      label: 'Beat (Plot Function)',
    }),
    register: fields.text({
      label: 'Character Register Expression',
    }),
    publishDate: fields.date({
      label: 'Publish Release Date (Drip Gate)',
    }),
    content: fields.markdoc({
      label: 'Prose',
      extension: 'md',
    }),
  };
}

/**
 * Field definitions for in-universe character posts.
 */
export function postFields(fields: any) {
  return {
    filename: fields.slug({
      name: { label: 'Filename (e.g. 2026-10-04-emma-01)' },
    }),
    character: fields.text({
      label: 'Character Entity ID (e.g. char.emma)',
      validation: { isRequired: true },
    }),
    date: fields.text({
      label: 'Post Date (YYYY-MM-DD)',
      validation: { isRequired: true },
    }),
    time: fields.text({
      label: 'Post Time (e.g. 19:42)',
    }),
    replyTo: fields.text({
      label: 'Reply To (Post ID or Filename)',
    }),
    tags: fields.array(fields.text({ label: 'Tag' }), {
      label: 'Tags (e.g. lane-public, lane-club)',
      itemLabel: (props: any) => props.value || 'Tag',
    }),
    content: fields.markdoc({
      label: 'Post Body',
      extension: 'md',
    }),
  };
}

/**
 * Field definitions for character dossiers.
 */
export function characterFields(fields: any) {
  return {
    id: fields.slug({
      name: { label: 'Entity ID (e.g. char.emma)' },
    }),
    name: fields.text({
      label: 'Character Display Name',
      validation: { isRequired: true },
    }),
    status: fields.select({
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Retired', value: 'retired' },
        { label: 'Referenced Only', value: 'referenced' },
      ],
      defaultValue: 'active',
    }),
    did: fields.text({
      label: 'Decentralized Identifier (did:plc:... or did:web:...)',
    }),
    handle: fields.text({
      label: 'AT Protocol Handle (e.g. emma.supperclubsecrets.com)',
    }),
    blurbPublic: fields.text({
      label: 'Public Blurb / Bio',
      multiline: true,
    }),
    personaPublic: fields.text({
      label: 'Public Persona Summary',
      multiline: true,
    }),
    content: fields.markdoc({
      label: 'Dossier Body (Overview, Personality, Arc)',
      extension: 'md',
    }),
  };
}

/**
 * Field definitions for places and locations.
 */
export function placeFields(fields: any) {
  return {
    id: fields.slug({
      name: { label: 'Place ID (e.g. place.the-diner)' },
    }),
    name: fields.text({
      label: 'Place Name',
      validation: { isRequired: true },
    }),
    status: fields.select({
      label: 'Status',
      options: [
        { label: 'Recurring', value: 'recurring' },
        { label: 'Story Specific', value: 'story-specific' },
        { label: 'Retired', value: 'retired' },
      ],
      defaultValue: 'recurring',
    }),
    location: fields.text({
      label: 'Address / Neighborhood',
    }),
    foursquare: fields.text({
      label: 'Foursquare ID (if real public venue)',
    }),
    hoursPublic: fields.text({
      label: 'Public Hours',
    }),
    content: fields.markdoc({
      label: 'Location Details',
      extension: 'md',
    }),
  };
}

/**
 * Field definitions for story items.
 */
export function itemFields(fields: any) {
  return {
    id: fields.slug({
      name: { label: 'Item ID (e.g. item.heritage-bottle)' },
    }),
    name: fields.text({
      label: 'Item Name',
      validation: { isRequired: true },
    }),
    status: fields.select({
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Destroyed / Retired', value: 'retired' },
      ],
      defaultValue: 'active',
    }),
    content: fields.markdoc({
      label: 'Item History & Description',
      extension: 'md',
    }),
  };
}

/**
 * Creates Keystatic collection configurations for a Pinakes universe.
 *
 * @param fields The `fields` export from `@keystatic/core`
 * @param options Universe paths and slugs
 */
export function createPinakesCollections(fields: any, options: PinakesKeystaticOptions) {
  const { storyDir, bookSlug = 'book1', codexDir = '../codex' } = options;

  return {
    chapters: {
      label: 'Chapters',
      slugField: 'chapterNumber',
      path: `${storyDir}/chapters/*`,
      format: { contentField: 'content' },
      entryLayout: 'content' as const,
      previewUrl: `/books/${bookSlug}/read/{slug}`,
      schema: chapterFields(fields),
    },
    posts: {
      label: 'In-Character Posts',
      slugField: 'filename',
      path: `${storyDir}/posts/*`,
      format: { contentField: 'content' },
      entryLayout: 'content' as const,
      schema: postFields(fields),
    },
    characters: {
      label: 'Characters',
      slugField: 'id',
      path: `${codexDir}/characters/*`,
      format: { contentField: 'content' },
      entryLayout: 'content' as const,
      previewUrl: '/characters/{slug}',
      schema: characterFields(fields),
    },
    places: {
      label: 'Places',
      slugField: 'id',
      path: `${codexDir}/locations/*`,
      format: { contentField: 'content' },
      entryLayout: 'content' as const,
      previewUrl: '/places/{slug}',
      schema: placeFields(fields),
    },
    items: {
      label: 'Items',
      slugField: 'id',
      path: `${codexDir}/items/*`,
      format: { contentField: 'content' },
      schema: itemFields(fields),
    },
  };
}
