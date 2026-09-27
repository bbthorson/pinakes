# Pinakes

A continuity linter and AT Protocol record compiler for fiction, published to
npm as `@bbthorson/pinakes`. The docs site (`docs/`) covers what it does for
authors; this file covers working on the code.

## Layout

- `cli/src/` — the TypeScript source. `index.ts` is the public library API
  (the package's `main`); `cli.ts` wires the commands on top of it and only
  formats output and sets exit codes. `linter/`, `compiler/`, `context/`,
  `lexicons/`, `registry/` and `prose/` hold the logic.
- `cli/dist/` — **committed** build output. Never edit it by hand.
- `cli/test/` — tests, in TypeScript, run with Node's built-in runner. Node
  strips the types itself, so they are never compiled; `test/tsconfig.json`
  only type-checks them.
- `template/` — the starter universe `pinakes init` copies. The build copies it
  into `cli/dist/template/`; edit `template/`, not the copy.
- `docs/` — the documentation site (VitePress, deployed to GitHub Pages by
  `docs.yml`): getting started, one page per command in `docs/commands/`, the
  library API, and the long-form guides. `.claude/skills/` holds the story-authoring
  skills (canon-check, plot-suggest, story-audit) for use inside a universe.

## Commands

Run from `cli/` (Node 22 or later):

```sh
npm ci          # install
npm run build   # tsc, copy template/ into dist/, regenerate cli/README.md
npm test        # build, type-check the tests, then run cli/test/**/*.test.ts
```

## Before you commit

- **Rebuild and commit `cli/dist` with every source change.** CI
  (`build-check.yml`) rebuilds and fails if `cli/dist` or `cli/README.md`
  differs from what is committed.
- **Edit the root `README.md`, never `cli/README.md`.** The build generates the
  npm copy from it (`cli/scripts/sync-readme.mjs`), making links absolute.
- **The build copies `template/` but never deletes from `dist/template/`.** If
  you remove a template file, remove its copy under `cli/dist/template/` too.
- **A new or changed rule is documented in two places:** the rules table in
  `docs/continuity-and-drift.md` and "Built-in checks" in `docs/commands/lint.md`.
- **The record browser demo (`docs/demo.md`) reads committed data.** After a
  change to what `compile` emits, rebuild the CLI and run
  `cd docs && npm run sync-demo -- <path-to-supper_club_secrets>` to regenerate
  `docs/public/demo/records.json`, and commit it.
- **Keep the docs site building.** `cd docs && npm ci && npm run build` fails
  on a dead link. A new page also needs an entry in the sidebar in
  `docs/.vitepress/config.mts`.
- Publishing is manual (the `Publish` workflow). Bump the version in
  `cli/package.json` first; the workflow refuses to republish a version.

## Principles the code depends on

- **Fail closed.** A check that silently skips something is a bug, not a
  feature: if `lint` cannot read a chapter, a rule file, or a registry entry, it
  reports a diagnostic rather than passing. `pinakes context` withholds codex
  text whenever it cannot prove a reference is in the past. Most past bugs here
  were silent passes, so when in doubt, fail loudly.
- **Record ids are permanent.** Once published, an id never changes format.
  When two records would collide, keep the first id and suffix the rest
  (`custodyEvent.key.book1.ch1`, then `.2`), as custody ids do.
- **Lint judges continuity; compile judges structure.** `compile` fails on
  resolution, Lexicon validation and id collisions; `lint` fails on continuity.
  `lint` and `context` call `compileProject(..., { write: false })` and must
  never write or delete anything.
- **Only delete what pinakes named.** `compile` prunes stale files from the
  output directory, but only names listed in `compiler/prune.ts`. A new record
  file name goes into `RECORD_FILES` there.
- **Registry lookups always name a type.** `registry.resolve(name, type)`:
  aliases are indexed per type, so a character and a place may share a name.
- **`index.ts` exports are public API.** Removing or changing one is a breaking
  change for importers. Put a command's logic there, not in `cli.ts`, so the
  library and the CLI can't reach different verdicts. `package.json`'s
  `exports` map blocks deep imports, so nothing else is public.
- Severity defaults for configurable rules live in `DEFAULT_RULES` in
  `config.ts`. A universe's `rules:` block is merged over them.

## Adding a record type

It touches five places: its Lexicon in `lexicons/docs.ts`, its emitter in
`compiler/atproto.ts`, its file name in `RECORD_FILES` in `compiler/prune.ts`,
its section in `docs/record-types.md`, and the output tree in
`docs/commands/compile.md`.

## Tests

Running the tests needs Node 22.18 or later, the first 22.x that strips types
without a flag. Because Node only erases types, tests may not use syntax that
needs compiling (enums, parameter properties); `erasableSyntaxOnly` in
`test/tsconfig.json` rejects it. Import helpers as `./helpers.ts`, with the
extension.

Tests drive the built CLI end to end. `test/helpers.ts` provides
`makeUniverse(files)`, which writes a minimal universe that lints clean to a temp
directory, with `files` overriding or adding paths (`null` removes a default), and
`withUniverse(files, fn)`, which builds one, runs `fn` and always removes it.
It also provides `run(root, command, ...args)`, which returns the exit code and
output. Assert on both: the exit code is the verdict CI sees.

A regression test must fail without its fix. To check, run it against the
previous build:

```sh
mkdir -p /tmp/old && git archive <old-commit> cli/dist cli/package.json | tar -x -C /tmp/old
cp -R cli/test /tmp/old/cli/ && ln -s "$PWD/cli/node_modules" /tmp/old/cli/node_modules
node --test /tmp/old/cli/test/<file>.test.ts
```

## Style

Comments explain *why*, often with the failure that motivated the code; match
that density rather than narrating what a line does. Commit messages do the
same: say what was broken and why the change fixes it.
