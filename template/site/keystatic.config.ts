import { config, fields } from '@keystatic/core';
import { createPinakesCollections } from '@bbthorson/pinakes/keystatic';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    ...createPinakesCollections(fields, {
      storyDir: '../stories/_story_template',
      bookSlug: 'book1',
      codexDir: '../codex',
    }),
  },
});
