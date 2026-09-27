/**
 * Writes cli/README.md, the README npm shows, from the repository's root
 * README.
 *
 * The two used to be maintained by hand and drifted: the npm page lost whole
 * sections (`pinakes context`, schema validation) and kept a stale count of
 * record types. Now the root README is the only one anyone edits, and this
 * runs as part of `npm run build`, so build-check fails if the copy is stale.
 *
 * The one real difference is links. npm renders the README away from the
 * repository, so relative links to `docs/` would break there; they are
 * rewritten to absolute GitHub URLs.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/bbthorson/pinakes';
const source = fileURLToPath(new URL('../../README.md', import.meta.url));
const target = fileURLToPath(new URL('../README.md', import.meta.url));

/** A link target left alone: absolute URLs, in-page anchors, mail links, site-root paths. */
const isAbsolute = (href) => /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(href);

const readme = fs
  .readFileSync(source, 'utf-8')
  .replace(/\]\(([^)\s]+)\)/g, (match, href) => {
    if (isAbsolute(href)) return match;
    const [pathPart, anchor = ''] = href.split(/(?=#)/);
    const clean = pathPart.replace(/^\.\//, '');
    // A trailing slash is a directory, which GitHub serves under `tree`.
    const kind = clean.endsWith('/') ? 'tree' : 'blob';
    return `](${REPO}/${kind}/main/${clean.replace(/\/$/, '')}${anchor})`;
  });

const banner =
  '<!-- Generated from the root README.md by cli/scripts/sync-readme.mjs during `npm run build`. ' +
  'Edit the root README, not this file. -->\n\n';

fs.writeFileSync(target, banner + readme, 'utf-8');
