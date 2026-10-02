import { config, fields } from '@keystatic/core';
import { createPinakesCollections } from '@bbthorson/pinakes/keystatic';

// GitHub mode: this config sits in site/, but the stories and codex sit beside
// it, and local mode only reads below the folder the dev server runs in. GitHub
// mode reads the repository from its root, so the paths below are from there,
// and an edit is a commit. Set `repo`, then visit /keystatic to create the
// GitHub App (docs: Keystatic CMS Integration).
//
// Keystatic will not open an entry whose frontmatter has a key the schema does
// not name. Pinakes names every key it reads; declare the rest of your own
// here. `fields.ignored()` keeps a value exactly as written without editing it.
export default config({
  storage: {
    kind: 'github',
    repo: 'OWNER/REPO', // your universe's GitHub repository
    branchPrefix: 'keystatic/',
  },
  collections: {
    ...createPinakesCollections(fields, {
      storyDir: 'stories/_story_template',
      bookSlug: 'book1',
      codexDir: 'codex',
      sequenceField: 'sequence', // project.sequenceField in pinakes.yaml
      extraFields: {
        characters: { type: fields.ignored(), timestamp: fields.ignored(), id: fields.ignored() },
        places: { type: fields.ignored(), timestamp: fields.ignored() },
      },
    }),
  },
});
