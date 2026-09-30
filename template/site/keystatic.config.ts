import { config, fields } from '@keystatic/core';
import { createPinakesCollections } from '@bbthorson/pinakes/keystatic';

// Keystatic will not open an entry whose frontmatter has a key the schema does
// not name. Pinakes names every key it reads; declare the rest of your own
// here. `fields.ignored()` keeps a value exactly as written without editing it.
export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    ...createPinakesCollections(fields, {
      storyDir: '../stories/_story_template',
      bookSlug: 'book1',
      codexDir: '../codex',
      sequenceField: 'sequence', // project.sequenceField in pinakes.yaml
      extraFields: {
        characters: { type: fields.ignored(), timestamp: fields.ignored(), id: fields.ignored() },
        places: { type: fields.ignored(), timestamp: fields.ignored() },
      },
    }),
  },
});
