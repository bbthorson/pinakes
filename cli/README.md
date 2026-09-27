<!-- Generated from the root README.md by cli/scripts/sync-readme.mjs during `npm run build`. Edit the root README, not this file. -->

# 🏛 Pinakes

**Pinakes** is an open-source command-line utility and framework for building, linting, and maintaining fictional universes. It brings the software engineering principles of CI/CD and syntactic linting to creative writing—ensuring semantic continuity (timeline, casting, locations, and item custody) while compiling raw prose markdown into AT Protocol-compliant databases.

Pinakes runs downstream of the writing. **Prose is the source of truth:** when a
finished chapter contradicts the codex, the chapter is right and the codex gets
updated. Pinakes checks that the codex and the chapters still agree, and
projects the story into records a reader-facing surface can use.

**Documentation: [bbthorson.github.io/pinakes](https://bbthorson.github.io/pinakes/)**

## Quick start

```sh
npm install -g @bbthorson/pinakes

pinakes init my-universe
cd my-universe
pinakes lint      # check continuity: timelines, casting, co-presence, item custody
pinakes compile   # write AT Protocol records and their Lexicons to records/
```

```
📁 stories/book1/chapters/ch11_the_empty_stall.md:
  :18   [unresolved-entities] 🔴 ERROR: Unresolved reference to character 'Paolo Ferrante' in field 'characters_referenced'

FAIL — pinakes found errors.
```

## Documentation

* **[Concepts](https://github.com/bbthorson/pinakes/blob/main/docs/concepts.md)**: where the name comes from, the Golden Rule, and the inward and outward layers
* **[Getting started](https://github.com/bbthorson/pinakes/blob/main/docs/getting-started.md)**: installing, `pinakes init`, and the directory layout
* **Commands**: [`lint`](https://github.com/bbthorson/pinakes/blob/main/docs/commands/lint.md), [`compile`](https://github.com/bbthorson/pinakes/blob/main/docs/commands/compile.md), [`prose-check`](https://github.com/bbthorson/pinakes/blob/main/docs/commands/prose-check.md), [`context`](https://github.com/bbthorson/pinakes/blob/main/docs/commands/context.md)
* **[Using Pinakes as a library](https://github.com/bbthorson/pinakes/blob/main/docs/library.md)**: `import { lint } from '@bbthorson/pinakes'`
* **[Guides](https://github.com/bbthorson/pinakes/blob/main/docs/README.md)**: [record types](https://github.com/bbthorson/pinakes/blob/main/docs/record-types.md), [prose to records](https://github.com/bbthorson/pinakes/blob/main/docs/prose-to-records.md), [continuity and drift](https://github.com/bbthorson/pinakes/blob/main/docs/continuity-and-drift.md), and [prose triage](https://github.com/bbthorson/pinakes/blob/main/docs/prose-triage.md), worked through against a real six-book universe

## Developing

```sh
cd cli && npm ci && npm test
```

`npm test` builds from `src/` and runs `cli/test/` with Node's built-in test runner. The tests create throwaway universes in a temp directory and check what `lint`, `compile`, and `context` report and exit with. Commit the rebuilt `cli/dist` along with your change; CI checks that it matches a fresh build.

Edit this README, not `cli/README.md`: the build regenerates that copy (the one npm shows) from this file, with links made absolute. Conventions for working in the code, for people and coding agents alike, are in [`CLAUDE.md`](https://github.com/bbthorson/pinakes/blob/main/CLAUDE.md).

The documentation site is built from `docs/` with VitePress:

```sh
cd docs && npm ci && npm run dev
```
