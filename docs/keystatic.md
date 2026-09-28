# Keystatic CMS Integration

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
import { config, fields, collection } from '@keystatic/core';
import { createPinakesCollections } from '@bbthorson/pinakes/keystatic';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    ...createPinakesCollections(fields, {
      storyDir: '../stories/01-missing-hot-sauce',
      bookSlug: 'missing-hot-sauce',
      codexDir: '../codex',
    }),
  },
});
```

`createPinakesCollections` generates configured collections for:
* **Chapters** (`stories/.../chapters/*`): Chapter numbers, titles, dates, POV, characters present, custody changes, and prose body.
* **In-Character Posts** (`stories/.../posts/*`): Character entity IDs, timestamps, reply links, and post body.
* **Characters** (`codex/characters/*`): IDs, names, status, handles, blurbs, and dossiers.
* **Places** (`codex/locations/*`): Names, addresses, Foursquare IDs, and location profiles.
* **Items** (`codex/items/*`): IDs, names, statuses, and item history.

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

If your universe uses custom frontmatter or extra codex collections, you can import individual field helpers:

```ts
import { fields, collection } from '@keystatic/core';
import { chapterFields, characterFields } from '@bbthorson/pinakes/keystatic';

export const customChapters = collection({
  label: 'Chapters',
  slugField: 'chapterNumber',
  path: '../stories/01-missing-hot-sauce/chapters/*',
  format: { contentField: 'content' },
  schema: {
    ...chapterFields(fields),
    myCustomField: fields.text({ label: 'Author Notes' }),
  },
});
```

---

## Workflow: Authoring & Continuity

1. **Edit in Keystatic**: Authors draft chapters, update character dossiers, and log custody transfers at `/keystatic`.
2. **Lint with Pinakes**: Run `pinakes lint` to ensure no character is in two places at once, all timestamps are valid, and custody rules hold.
3. **Compile Records**: Run `pinakes compile` to generate AT Protocol-ready JSON records.
