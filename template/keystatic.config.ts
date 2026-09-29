import { config, fields } from '@keystatic/core';
import { createPinakesCollections } from '@bbthorson/pinakes';

export default config({
  storage: { kind: 'local' },
  collections: createPinakesCollections(fields, {
    storyDir: 'stories/book1',
    bookSlug: 'book1',
    codexDir: 'codex',
  }),
});
