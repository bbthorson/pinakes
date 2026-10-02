---
title: "Keystatic CMS Integration"
---

Pinakes can be paired with [Keystatic](https://keystatic.com/) to provide a visual, distraction-free editing interface for authors while preserving Pinakes' file-based continuity linting and AT Protocol record compilation.

Because Keystatic operates directly against your Git repository (editing local Markdown and YAML files in place without a database), it fits Pinakes' philosophy: **the Markdown files remain the single source of truth**.

---

## Why Keystatic + Pinakes?

* **No database or vendor lock-in**: Changes made in Keystatic write directly to disk as Markdown with YAML frontmatter.
* **Preserves Pinakes continuity checking**: Every time an author saves a chapter or post, `pinakes lint` can validate timeline consistency, character locations, and item custody.
* **Live previews**: Keystatic connects directly to your site's routes (e.g. `/books/missing-hot-sauce/read/{slug}` or `/characters/{slug}`).

---

## Quick Start (with Astro)

Pinakes ships pre-built Keystatic collection definitions and field mappings in `@bbthorson/pinakes/keystatic`.

### 1. Install dependencies

In your Astro reader/frontend site:

```bash
npm install @keystatic/core @keystatic/astro @astrojs/react react react-dom
```

### 2. Create `keystatic.config.ts`

In your site's root directory, create `keystatic.config.ts`:

```ts
import { config, fields } from '@keystatic/core';
import { createPinakesCollections } from '@bbthorson/pinakes/keystatic';

export default config({
  storage: {
    kind: 'github',
    repo: 'OWNER/REPO',
    branchPrefix: 'keystatic/',
  },
  collections: {
    ...createPinakesCollections(fields, {
      storyDir: 'stories/01-missing-hot-sauce',
      bookSlug: 'missing-hot-sauce',
      codexDir: 'codex',
      sequenceField: 'meal',          // project.sequenceField in pinakes.yaml
      extraFields: {                  // your universe's own keys: see below
        chapters: { clues: fields.ignored(), threads: fields.ignored() },
      },
    }),
  },
});
```

Import from **`@bbthorson/pinakes/keystatic`**. Keystatic bundles this config
into its admin page in the browser, so its helpers live apart from the package
root, which carries the Node-side compiler. Earlier versions re-exported them
from the root, and a config importing from there failed to load in the browser
(`Class extends value undefined is not a constructor`).

### Where Keystatic reads: paths are from the repository root

Collection paths (`storyDir`, `codexDir`) are resolved from where Keystatic
reads and writes, and it never reaches above that:

- **GitHub mode** reads the repository from its root. Paths are from the root,
  whatever folder the config is in, and an edit is a commit on a branch
  (`branchPrefix` keeps Keystatic to its own). This is the mode for a site in a
  subfolder, as in the starter template: set `repo`, run the dev server, open
  `/keystatic` and follow **Log in with GitHub** to create the GitHub App, which
  writes its credentials to the site's `.env` (gitignore it).
- **Local mode** reads the folder the dev server runs in. It suits a universe
  whose site is at the repository root. With the site in `site/`, the stories
  and codex are out of its reach, and every collection lists as empty: a
  `../stories` path finds nothing.

`createPinakesCollections` generates collections for:
* **Chapters** (`stories/.../chapters/*`): title, number, sequence, part, dates, locations, POV, cast, custody hand-offs, beat, tags, and the prose.
* **Posts** (`stories/.../posts/*`): author, anchoring chapter, story date and time, publish date, reply, mentions, location, tags, note, and the post body.
* **Stretches** (`stories/.../stretches/<character>/<asOf>.md`): character, dates, register, status, carrying, sources, note, and the stretch itself.
* **Characters** (`codex/characters/*`): title, description, status, tags, `affectHalfLifeScale`, and the codex body.
* **Places** (`codex/locations/*`): title, `id`, description, status, region, neighborhood, first appearance, tags, and the body.
* **Items** (`codex/items/*`): title, description, tags, and the body.

Identity (`id`, `displayName`, `did`, `handle`) lives on the registry entry in
`entities.yaml`, not in codex files, so the character schema has none of it:
`lint` rejects a `did` or `handle` in codex frontmatter.

## Every key must be named

Keystatic is strict about frontmatter. **An entry whose file has a key the
schema does not name will not open** (Keystatic reports `Key on object value
"clues" is not allowed`), and a save writes only the schema's keys.

The Pinakes schemas name exactly the keys Pinakes reads. Your universe
probably uses others (Supper Club Secrets has `clues`, `threads`, `day` and
`time` on chapters, and public blurbs on codex files), so declare them under
`extraFields`, per collection:

```ts
extraFields: {
  chapters: { day: fields.text({ label: 'Day' }), clues: fields.ignored() },
  characters: { personaPublic: fields.text({ label: 'Public persona', multiline: true }) },
},
```

Use an editable field where Keystatic can edit the value as it is, and
`fields.ignored()` to keep it exactly as written. Redefining a key Pinakes
already names is an error, since a different field could reshape a value
Pinakes reads.

### Edited in the file, not the CMS

Some values Pinakes reads have shapes Keystatic has no field for, so they are
kept exactly as written and edited in the Markdown file:

| Collection | Key | Why |
|---|---|---|
| Chapters | `registers`, `affect` | Maps keyed by character name, and `affect` values may be labels or numbers |
| Stretches | `affect` | A label or `{ v, a, d }` |
| Characters | `affectBaseline` | A label or `{ v, a, d }` |
| Places | `schedule` | An object |

A save preserves them. `pinakes lint` still checks them, as always.

### What a save changes

With every key named, saving an entry changes no value Pinakes reads. This
was checked against Supper Club Secrets by running Keystatic's own parse and
serialize over every chapter, post, stretch and codex file, frontmatter and
body, then compiling: `lint` passed and all 228 records came out identical.

A save does make cosmetic changes, so expect them in the diff:

- The whole frontmatter block is rewritten, not just the field you changed:
  keys go into schema order, quotes come off where YAML doesn't need them,
  and long strings fold (`>-`). The first save of a hand-written file shows
  the whole block in its diff.
- An absent list field is written as `[]`.
- The body is reformatted by Keystatic's Markdoc serializer. It adds a blank
  line after a heading that runs straight into text, and escapes some
  punctuation (`~2 hrs` becomes `\~2 hrs`). Both render the same. Because a
  stretch's body is its compiled `state`, review a stretch's diff before
  committing it.

A value in a shape its field does not accept fails loudly rather than being
coerced. Examples are a single location written as a string where the schema
has a list, or an unquoted date that YAML reads as a timestamp. Keystatic will
not open that entry until the file is fixed.

### 3. Configure Astro (`astro.config.mjs`)

Because Keystatic's `/keystatic` UI and API routes are dynamic on-demand endpoints, configure your Astro site to enable Keystatic in development mode while keeping static builds completely serverless:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Only load Keystatic UI in local dev or when explicitly requested
const enableKeystatic = process.argv.includes('dev') || process.env.ENABLE_KEYSTATIC === 'true';

export default defineConfig({
  output: 'static',
  integrations: [
    react(),
    ...(enableKeystatic ? [keystatic()] : []),
  ],
});
```

### 4. Launch the CMS

Run the Astro dev server:

```bash
npm run dev
```

Navigate to `http://localhost:4321/keystatic` to access the authoring UI.

---

## Customizing Fields

`extraFields` covers most universes. To build a collection yourself, the
per-collection field helpers are exported too: `chapterFields`, `postFields`,
`stretchFields`, `characterFields`, `placeFields` and `itemFields`. Use the
same `slugField` as `createPinakesCollections` (`title` for chapters and codex
files, `date` for posts, `asOf` for stretches). Keystatic writes a slug
field's value under its own key, so any other choice adds a key to every file
saved.

```ts
import { fields, collection } from '@keystatic/core';
import { chapterFields } from '@bbthorson/pinakes/keystatic';

export const chapters = collection({
  label: 'Chapters',
  slugField: 'title',
  path: '../stories/01-missing-hot-sauce/chapters/*',
  format: { contentField: 'content' },
  schema: {
    ...chapterFields(fields, { sequenceField: 'meal' }),
    authorNotes: fields.text({ label: 'Author notes', multiline: true }),
  },
});
```

---

## Workflow: Authoring & Continuity

1. **Edit in Keystatic**: Authors draft chapters, update character dossiers, and log custody transfers at `/keystatic`. Registers and affect are edited in the chapter file.
2. **Lint with Pinakes**: Run `pinakes lint` to ensure no character is in two places at once, all timestamps are valid, and custody rules hold.
3. **Compile Records**: Run `pinakes compile` to generate AT Protocol-ready JSON records.
