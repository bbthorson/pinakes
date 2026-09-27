# Pinakes

A continuity linter and AT Protocol record compiler for fiction, published to
npm as `@bbthorson/pinakes`. The README covers what it does for authors; this
file covers working on the code.

## Layout

- `cli/src/` — the TypeScript source. `cli.ts` wires the commands; `linter/`,
  `compiler/`, `context/`, `lexicons/`, `registry/` and `prose/` hold the logic.
- `cli/dist/` — **committed** build output. Never edit it by hand.
- `cli/test/` — tests, run with Node's built-in runner.
- `template/` — the starter universe `pinakes init` copies. The build copies it
  into `cli/dist/template/`; edit `template/`, not the copy.
- `docs/` — the long-form guides. `.claude/skills/` holds the story-authoring
  skills (canon-check, plot-suggest, story-audit) for use inside a universe.

## Commands

Run from `cli/` (Node 22 or later):

```sh
npm ci          # install
npm run build   # tsc, copy template/ into dist/, regenerate cli/README.md
npm test        # build, then run cli/test/**/*.test.mjs
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
  `docs/continuity-and-drift.md` and "Built-in Checks" in the README.
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
- Severity defaults for configurable rules live in `DEFAULT_RULES` in
  `config.ts`. A universe's `rules:` block is merged over them.

## Adding a record type

It touches five places: its Lexicon in `lexicons/docs.ts`, its emitter in
`compiler/atproto.ts`, its file name in `RECORD_FILES` in `compiler/prune.ts`,
its section in `docs/record-types.md`, and the output tree in the README.

## Tests

Tests drive the built CLI end to end. `test/helpers.mjs` provides
`makeUniverse(files)`, which writes a minimal universe that lints clean to a temp
directory, with `files` overriding or adding paths (`null` removes a default).
It also provides `run(root, command, ...args)`, which returns the exit code and
output. Assert on both: the exit code is the verdict CI sees.

A regression test must fail without its fix. To check, run it against the
previous build:

```sh
mkdir -p /tmp/old && git archive <old-commit> cli/dist cli/package.json | tar -x -C /tmp/old
cp -R cli/test /tmp/old/cli/ && ln -s "$PWD/cli/node_modules" /tmp/old/cli/node_modules
node --test /tmp/old/cli/test/<file>.test.mjs
```

## Style

Comments explain *why*, often with the failure that motivated the code; match
that density rather than narrating what a line does. Commit messages do the
same: say what was broken and why the change fixes it.
