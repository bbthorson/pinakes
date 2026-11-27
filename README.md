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
pinakes compile   # write AT Protocol records, Lexicons, and entity_first_appearances.json to records/
```

```
📁 stories/book1/chapters/ch11_the_empty_stall.md:
  :18   [unresolved-entities] 🔴 ERROR: Unresolved reference to character 'Paolo Ferrante' in field 'characters_referenced'

FAIL — pinakes found errors.
```

### Probabilistic writing, six-lens review & MCP

On top of the deterministic core, Pinakes includes an optional probabilistic Scene-Mode writing pipeline, an Author-Mode six-lens review board, and a firewall-enforced MCP server (local stdio and hosted Cloudflare Worker):

```sh
pinakes brief -s book2 -c 6 --as-of 2026-10-12 --characters "Emma,Marta"   # firewalled 3-move brief prompts
pinakes sample -b emma_brief.json --scorer clef --log emma_roll.json      # Clef scoring + doNotReveal mask + SHA-256 draw
pinakes compose --pov Emma --moves emma_roll.json marta_roll.json         # POV-locked narrator handoff (strips non-POV interiority)
pinakes review -s book2 -c 6 --lens all                                   # 6-lens temporal review slices
pinakes review -s book2 -c 6 --prepass                                    # Clef-flash -> Clef 27B probabilistic lint pre-pass
pinakes calibrate -d beats.jsonl --scorers clef-flash,clef                # JSONL calibration harness (accuracy, Brier, ECE)
pinakes mcp --mode scene                                                  # local MCP server over stdio (scene or author mode)
```

For remote web clients (Claude.ai, etc.), [`worker/`](worker/) provides a hosted Cloudflare Worker with Streamable HTTP MCP (`/mcp/scene` and `/mcp/author`), GitHub-to-R2 snapshot caching, GitHub OAuth 2.1 + allowlist / Bearer auth, and native Workers AI Clef bindings.

## Documentation

* **[Concepts](docs/src/content/docs/concepts.md)**: where the name comes from, the Golden Rule, and the inward and outward layers
* **[Getting started](docs/src/content/docs/getting-started.md)**: installing, `pinakes init`, and the directory layout
* **Commands**: [`lint`](docs/src/content/docs/commands/lint.md), [`compile`](docs/src/content/docs/commands/compile.md), [`prose-check`](docs/src/content/docs/commands/prose-check.md), [`context`](docs/src/content/docs/commands/context.md)
* **[Using Pinakes as a library](docs/src/content/docs/library.md)**: `import { lint, openMemoryUniverse, PinakesMcpServer } from '@bbthorson/pinakes'`
* **[Guides](docs/src/content/docs/guides.md)**: [record types](docs/src/content/docs/record-types.md), [prose to records](docs/src/content/docs/prose-to-records.md), [continuity and drift](docs/src/content/docs/continuity-and-drift.md), [prose triage](docs/src/content/docs/prose-triage.md), [probabilistic writing & review](docs/src/content/docs/probabilistic-layer.md), and [MCP & Cloudflare Workers](docs/src/content/docs/mcp-and-cloudflare.md)

## Developing

```sh
cd cli && npm ci && npm test
cd worker && npm install && npm run typecheck && npm test
```

`npm test` in `cli/` builds from `src/` and runs `cli/test/` with Node's built-in test runner. Commit the rebuilt `cli/dist` along with your change; CI checks that it matches a fresh build.

Edit this README, not `cli/README.md`: the build regenerates that copy (the one npm shows) from this file, with links made absolute. Conventions for working in the code, for people and coding agents alike, are in [`CLAUDE.md`](CLAUDE.md).

The documentation site is built from `docs/` with Astro Starlight:

```sh
cd docs && npm ci && npm run dev
```
