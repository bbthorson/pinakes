import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const REPO = 'https://github.com/bbthorson/pinakes';

export default defineConfig({
  site: 'https://bbthorson.github.io',
  base: '/pinakes',
  integrations: [
    starlight({
      title: 'Pinakes',
      description: 'A continuity linter and AT Protocol record compiler for fiction',
      social: [
        { icon: 'github', label: 'GitHub', href: REPO },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/@bbthorson/pinakes' },
      ],
      sidebar: [
        {
          label: 'Introduction',
          items: [
            { label: 'Concepts', slug: 'concepts' },
            { label: 'Getting started', slug: 'getting-started' },
          ],
        },
        {
          label: 'Commands',
          items: [
            { label: 'lint', slug: 'commands/lint' },
            { label: 'compile', slug: 'commands/compile' },
            { label: 'prose-check', slug: 'commands/prose-check' },
            { label: 'context', slug: 'commands/context' },
          ],
        },
        {
          label: 'Library',
          items: [
            { label: 'Using Pinakes as a library', slug: 'library' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Overview', slug: 'guides' },
            { label: 'Record types', slug: 'record-types' },
            { label: 'Prose to records', slug: 'prose-to-records' },
            { label: 'Continuity and drift', slug: 'continuity-and-drift' },
            { label: 'Prose triage', slug: 'prose-triage' },
            { label: 'Keystatic CMS', slug: 'keystatic' },
            { label: 'Affect simulation', slug: 'affect-simulation' },
          ],
        },
        {
          label: 'Demo',
          items: [
            { label: 'Record browser', slug: 'demo' },
          ],
        },
      ],
      editLink: {
        // Starlight appends the path from the project root (src/content/docs/…),
        // so the base stops at docs/.
        baseUrl: `${REPO}/edit/main/docs/`,
      },
    }),
  ],
});
