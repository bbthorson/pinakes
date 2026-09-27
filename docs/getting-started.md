# Getting started

Pinakes is built in TypeScript on Node 22 or later. It uses the
`unified`/`remark` Markdown parser and the official AT Protocol SDKs.

## Installation

```sh
npm install -g @bbthorson/pinakes
```

Or run directly without installing:

```sh
npx @bbthorson/pinakes <command>
```

## Initializing a universe

Bootstrap the standard `lore/`, `codex/`, and `stories/` folders with a default configuration:

```sh
pinakes init my-universe

# Or using npx directly:
npx @bbthorson/pinakes init my-universe
```

Then, from inside the universe:

```sh
pinakes lint      # check continuity
pinakes compile   # write AT Protocol records to records/
```

## Directory layout

A universe uses single-word directory names, so paths stay shell-friendly:

```
my-universe/
├── pinakes.yaml       # Universe configuration
├── rules/             # Custom YAML linter rules (optional; init doesn't create it)
├── lore/              # Rules & Patterns
│   ├── overview.md    # Target audience, series rules
│   └── voice_guide.md # Character voice registers
├── codex/             # Facts & Current State
│   ├── entities.yaml  # Stable ID and alias registry
│   ├── characters/    # One file per active character
│   ├── locations/     # One file per location (operating hours, schedules)
│   └── items/         # Items tracked for custody
├── stories/           # The Narrative Corpus
│   └── book1/         # Flat folder per story
│       ├── chapters/  # Chapter markdown files with YAML frontmatter
│       └── tracking/  # Matrix/timeline ledger files
└── records/           # Derived published outputs
```

### Why these names

* **`lore/`** holds rules and patterns: how the world works and how its
  characters sound.
* **`codex/`** holds facts and current state. A *codex* is a bound manuscript,
  which suits a structured, authoritative catalog of characters, places, and
  objects.
* **`records/`** is build output, kept at the root and apart from the source.
  It can be deleted at any time; `pinakes compile` rebuilds it.

## Next steps

* [`pinakes lint`](commands/lint.md) for the checks and how to configure them.
* [`pinakes compile`](commands/compile.md) for the records it writes.
* [Prose to records](prose-to-records.md) for the frontmatter a chapter needs.
