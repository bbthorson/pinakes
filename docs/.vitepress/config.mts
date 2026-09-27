import { defineConfig } from 'vitepress';

const REPO = 'https://github.com/bbthorson/pinakes';

export default defineConfig({
  title: 'Pinakes',
  description: 'A continuity linter and AT Protocol record compiler for fiction',
  // Served from GitHub Pages at bbthorson.github.io/pinakes.
  base: '/pinakes/',
  cleanUrls: true,
  lastUpdated: true,

  // docs/README.md is the guides overview, so GitHub shows it when browsing
  // docs/. On the site it lives at /guides; index.md is the home page.
  rewrites: { 'README.md': 'guides.md' },
  // package.json and node_modules sit in docs/ too; nothing but pages is content.
  srcExclude: ['node_modules/**'],

  themeConfig: {
    nav: [
      { text: 'Get started', link: '/getting-started' },
      { text: 'Commands', link: '/commands/lint' },
      { text: 'Library', link: '/library' },
      { text: 'Guides', link: '/guides' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Concepts', link: '/concepts' },
          { text: 'Getting started', link: '/getting-started' },
        ],
      },
      {
        text: 'Commands',
        items: [
          { text: 'lint', link: '/commands/lint' },
          { text: 'compile', link: '/commands/compile' },
          { text: 'prose-check', link: '/commands/prose-check' },
          { text: 'context', link: '/commands/context' },
        ],
      },
      { text: 'Library', items: [{ text: 'Using Pinakes as a library', link: '/library' }] },
      {
        text: 'Guides',
        items: [
          { text: 'Overview', link: '/guides' },
          { text: 'Record types', link: '/record-types' },
          { text: 'Prose to records', link: '/prose-to-records' },
          { text: 'Continuity and drift', link: '/continuity-and-drift' },
          { text: 'Prose triage', link: '/prose-triage' },
        ],
      },
    ],

    outline: [2, 3],
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: REPO },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@bbthorson/pinakes' },
    ],
    editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
  },
});
