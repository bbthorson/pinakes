# 🏛 Pinakes

**Pinakes** is an open-source command-line utility and framework for building, linting, and maintaining fictional universes. It brings the software engineering principles of CI/CD and syntactic linting to creative writing—ensuring semantic continuity (timeline, casting, locations, and item custody) while compiling raw prose markdown into AT Protocol-compliant databases.

---

## 📜 The Historical Inspiration

In the 3rd century BCE, the Great Library of Alexandria was rapidly accumulating the world's knowledge on thousands of unindexed papyrus scrolls. To prevent this vast archive from collapsing into chaos, the scholar and poet **Callimachus of Cyrene** compiled the **Pinakes** (Greek: Πίνακες, meaning "tables" or "charts"). 

The *Pinakes* was a monumental, 120-volume bibliographic catalog. It didn't just list books—it classified authors, indexed chapter metadata, cataloged character details, and verified historical timelines. 

Modern storytellers face the same problem. As a fictional universe grows, the sheer volume of facts, timelines, and character states quickly exceeds one writer's working memory. **Pinakes** is the digital successor to Callimachus's tables: an automated archivist that verifies your universe's continuity as you write.

---

## 🧠 The Core Philosophy

Pinakes is built on two load-bearing creative principles:

### 1. The Golden Rule: The Story Drives the Canon
In many data-driven narrative pipelines, structured world-state tables cage the writing. Pinakes inverts this. **Prose is the source of truth.** 
If a finished chapter conflicts with a previously established fact in your encyclopedia, **the story is correct**, and the encyclopedia must be updated. Pinakes runs downstream of the writing, projecting the narrative's reality into structured records rather than constraining the author.

### 2. Inward vs. Outward Layers
A fictional universe has two opposite directions of information flow:
* **The Inward Layer (Authoring):** A private, static, agent-readable knowledge graph used by the writer. It conforms to the Google **Open Knowledge Format (OKF)**—standardized Markdown files that let LLMs and scripts traverse character and location files without custom parsers.
* **The Outward Layer (Publishing):** A public, time-series stream of records projected onto reader-facing surfaces (like a timeline explorer or social feeds). It conforms to **AT Protocol Lexicons**, where characters are cryptographic identities (DIDs) owning their own history.

---

## 📚 Guides

The working detail behind the tour above — what the compiler reads, what it
emits, and what keeps the two in step — lives in [`docs/`](docs/), worked
through against a real six-book universe:

* **[Record types](docs/record-types.md)** — the eight types `compile` emits, the Lexicon documents generated for them, and how identity works today
* **[Prose to records](docs/prose-to-records.md)** — the frontmatter contract, name resolution, and what never leaves the repo
* **[Continuity and drift](docs/continuity-and-drift.md)** — the lint rules, Lexicon validation, the CI drift gate, and the judgment passes kept out of CI

## 📂 Directory Layout

To keep the repository clean, shell-friendly, and cohesive, we propose a standardized, single-word directory naming convention:

```
my-universe/
├── pinakes.yaml       # Universe configuration
├── rules/             # Custom YAML linter rules
├── lore/              # [NEW] Rules & Patterns (formerly "world building")
│   ├── overview.md    # Target audience, series rules
│   └── voice_guide.md # Character voice registers
├── codex/             # [NEW] Facts & Current State (formerly "canon library")
│   ├── entities.yaml  # Stable ID and alias registry
│   ├── characters/    # One file per active character
│   ├── locations/     # One file per location (operating hours, schedules)
│   └── items/         # Items tracked for custody
├── stories/           # The Narrative Corpus
│   └── book1/         # Flat folder per story
│       ├── chapters/  # Chapter markdown files with YAML frontmatter
│       └── tracking/  # Matrix/timeline ledger files
└── records/           # [NEW] Derived published outputs (formerly "protocol/records")
```

### Folder Rename Rationale:
* **`world building/` → `lore/`:** Eliminates spaces. Fits the cozy, creative tone of storytelling while remaining concise.
* **`canon library/` → `codex/`:** Removes spaces. *Codex* historically refers to bound manuscripts of sheets, evoking a structured, authoritative catalog of characters, places, and objects.
* **`protocol/records/` → `records/`:** Moves build outputs to the root directory, separating disposable compiled outputs from source code.

---

## 🔌 CLI Installation & Setup

Pinakes is built in TypeScript/Node to leverage the `unified`/`remark` Markdown AST parsing ecosystem and the official AT Protocol SDKs.

### Installation

```sh
npm install -g @bbthorson/pinakes
```

Or run directly without installing:

```sh
npx @bbthorson/pinakes <command>
```

### Developing

```sh
cd cli && npm ci && npm test
```

`npm test` builds from `src/` and runs `cli/test/` with Node's built-in test runner. The tests create throwaway universes in a temp directory and check what `lint`, `compile`, and `context` report and exit with. Commit the rebuilt `cli/dist` along with your change; CI checks that it matches a fresh build.

Edit this README, not `cli/README.md`: the build regenerates that copy (the one npm shows) from this file, with links made absolute. Conventions for working in the code, for people and coding agents alike, are in [`CLAUDE.md`](CLAUDE.md).

### Initializing a Universe

Bootstrap the standard `lore/`, `codex/`, and `stories/` folders with a default configuration:

```sh
pinakes init my-universe

# Or using npx directly:
npx @bbthorson/pinakes init my-universe
```

---

## 🛠 Command-Line Usage

### 1. `pinakes lint`
Scans the creative layers of your project, parses chapter frontmatter, resolves names against the codex registry, and checks for timeline or co-presence violations.

```sh
pinakes lint --root .
```

#### Diagnostic Output Example:
```
======================================================================
PINAKES CONTINUITY CHECK
======================================================================

📁 stories/book1/chapters/ch11_the_empty_stall.md:
  :18   [unresolved-entities] 🔴 ERROR: Unresolved reference to character 'Paolo Ferrante' in field 'characters_referenced'

📁 stories/book1/chapters/ch17_sharpening_the_knives.md:
        [co-presence-conflict] 🟡 WARNING: Co-presence conflict: Character 'Emma' is present in Chapter 17 (Distributed) and Chapter 14 (Emma's Apartment) at the same time.

FAIL — pinakes found errors.
```

#### Built-in Checks:
* **Entity Resolution:** Verifies that every character, location, and item mentioned in chapter frontmatter exists in `entities.yaml` or is explicitly ignored in `non_entities.yaml`.
* **Sequential Timelines:** Ensures start dates do not retrogress across sequential chapters.
* **Co-Presence Conflicts:** Flags physical impossibilities, such as a character being marked as present in two distinct locations at the same time.
* **Custody Resolution:** Verifies that every item and holder named in a chapter's `custody:` block resolves, so a hand-off is never silently dropped.
* **Stretch Horizon:** Verifies that a character stretch cites only records that have ended by its `asOf` date, so a character never draws on what hasn't happened yet.
* **Frontmatter Integrity:** A chapter whose frontmatter is not valid YAML is an error, and a file in `chapters/` with no `chapter` key is a warning. Either would otherwise drop out of every check.
* **Unique Chapters:** Two chapter files in one story with the same `chapter` number are an error, since chapter numbers become record ids.
* **Registry Conflicts:** One alias claimed by two entities of the same type is an error, and the alias resolves to neither until one entry drops it. A character and a place may share a name. An id registered twice is also an error.
* **Registry Validity:** An `entities.yaml` entry that is missing `id`, `type` or `displayName`, or has a field of the wrong type, is an error. It is left out of the registry, and `lint` would otherwise pass with the entity silently missing.

Severities are set per rule under `rules:` in `pinakes.yaml`, and a `rules:` block only needs the rules you change: the rest keep their defaults. The full table is in [Continuity and drift](docs/continuity-and-drift.md#the-built-in-rules).

#### Custom YAML Rules:
Authors can write custom rules in the `rules/` directory to enforce style guidelines or state transitions:

`paths.rules` is a **glob, not a directory** — use `rules/*.yaml`. A bare
`rules` matches the directory itself and fails `lint`, as does any rule file
that cannot be loaded: invalid YAML, the wrong shape, or a `pattern` that is not
a valid regex. A rule that silently stopped running would be worse than none.

```yaml
# rules/voice-register.yaml
name: "voice-register-transitions"
description: "Verify that character registers only transition to valid states"
severity: error
selector: "stateEvent"
validate:
  field: "register"
  pattern: "^(public|private|under-pressure)$"
```

---

### 2. `pinakes compile`
Extracts and translates your story files, locations, and character profiles into AT Protocol-compliant JSON records using namespaced Lexicons.

```sh
pinakes compile --root .
```

#### Compiled Output Structure:
```
records/
├── lexicons/                          # The universe's Lexicon schema documents
│   ├── <nsid>.scene.json
│   ├── <nsid>.character.stateEvent.json
│   ├── <nsid>.character.profile.json
│   ├── <nsid>.place.json
│   ├── <nsid>.item.json
│   ├── <nsid>.custodyEvent.json
│   ├── <nsid>.character.post.json
│   └── <nsid>.character.stretch.json
├── book1/
│   ├── scenes.json                    # Lexicon: *.scene
│   ├── character_state_events.json    # Lexicon: *.character.stateEvent
│   ├── custody_events.json            # Lexicon: *.custodyEvent
│   ├── character_posts.json           # Lexicon: *.character.post (only with posts/)
│   └── character_stretches.json       # Lexicon: *.character.stretch (only with stretches/)
└── series/
    ├── places.json                    # Lexicon: *.place
    ├── character_profiles.json        # Lexicon: *.character.profile
    └── items.json                     # Lexicon: *.item
```

`compile` also removes files from a previous run that it no longer produces — a deleted book's directory, a record type a book stopped producing, Lexicon documents for an old NSID — and lists each as `removed stale`. Only the file names above are ever removed.

#### What the codex carries into records

Records are the only thing reader-facing surfaces should have to read, so
`compile` carries the publishable frontmatter across rather than leaving
consumers to re-parse the codex:

| Record | Carried from |
| --- | --- |
| `*.character.profile` | `description`, `tags`, `status`, `handle` from the character file's frontmatter; `oneLine` from its Overview. `status` falls back to the registry entry for a character whose file doesn't state one. |
| `*.place` | `description`, `tags`, `status`, `region`, `first_appearance`, `schedule` from the location file's frontmatter; `kind` from the `**Type:**` line in its body. |
| `*.scene` | `tags` from the chapter's frontmatter, alongside the timeline and casting fields. |
| `*.item` | `displayName` and `status` from the registry's `items:` entry; `description` and `tags` from its codex file when it has one; `firstAppearance` derived from the earliest custody event. |
| `*.custodyEvent` | The chapter's `custody:` list — `item`, `holder`, `from` resolved against the registry, and `event` carried through verbatim. |

`tags` accepts either a YAML sequence (`tags: [main-cast, cook]`) or one
hand-typed line (`tags: main-cast, cook`). A field with no value is omitted from
the record, never written as `null`.

#### Schema Validation

`compile` writes a Lexicon document for every record type it emits, namespaced
under your `project.nsid`, and validates each record against it before the file
is written. Validation uses [`@atproto/lex`](https://www.npmjs.com/package/@atproto/lex),
so records are held to the real AT Protocol data model rather than to a
`$type` string we stamped on ourselves. A record that doesn't match its Lexicon
fails the build:

```
📁 records/book1/scenes.json:
       [lexicon-validation] 🔴 ERROR: scene.book1.ch1: Invalid datetime (got "2026-10-04") at $.createdAt

FAIL — 1 problem(s) in the compiled records.
```

Two consequences worth knowing about, because they are what the data model
actually requires:

* **There is no null.** An optional field with no value is *omitted*, not set
  to `null`. Consumers should read `record.pov ?? fallback`, not `record.pov !== null`.
* **`createdAt` is story time.** It is the RFC3339 datetime for midnight UTC on
  the scene's `storyDate`, not the moment the file compiled — otherwise every
  recompile would reorder the stream.

The `records/lexicons/` directory is meant to be committed. It is the portable
contract for your universe: anything that consumes your records can read the
schemas without reading Pinakes.

---

### 3. `pinakes prose-check`
Mechanical prose triage: the countable half of the AI-tells pre-pass in
`.claude/skills/story-audit/references/ai_tells.md`. Cheap to run, so the
expensive judgment read only has to look where the counts point.

```sh
pinakes prose-check --out .prose/
pinakes prose-check --report closers --story "book one"
```

Two reports:

| Report | What it is |
| --- | --- |
| `tells` | Per-chapter counts for each catalogued signal, plus every hard-signal hit quoted verbatim, plus a six-gram scan for phrases reused across chapters. |
| `closers` | Every chapter's final paragraph in one file, to be read together. |

**This command has no pass/fail.** It exits 0 whatever it finds, and it is not
meant for CI. `ai_tells.md` is explicit that counts are inputs, not verdicts, and
that an AI tell is never a blocking finding — it is a polish call the author
owns. A gate on this output would contradict the taxonomy that defines it.

Two design notes worth knowing before reading the output:

- **Hard-signal hits are quoted, not tallied.** A count of three `corporate-filler`
  hits tells you nothing: one may be a literal door being unlocked, one may sit
  inside a character's catalogued jargon register, and one may be real. The line
  settles it; the number does not.
- **`closers` is an assembly aid, not a detector.** The taxonomy records the
  epiphany-button close as having zero mechanical signal, because the tell is
  sameness of move across chapters. The `SHORT` flag is narration-only and
  deliberately modest — measured against a hand-identified set of buttons it
  agreed on three of seven, and the misses ran up to 54 words. The report says so
  in its own header rather than implying a precision it does not have.

Configure it under `prose:` in `pinakes.yaml` — see
[`docs/prose-triage.md`](docs/prose-triage.md). Everything is optional; the
defaults are the catalogue itself.

### 4. `pinakes context`

Assembles what one character can see on one story date: the input for drafting
anything in their voice, whether the drafter is an author or a model.

```sh
pinakes context Jasper --as-of 2026-10-11
pinakes context Jasper --as-of 2026-10-11 --json -o jasper.json
```

**Every tier looks backward.** A character knows what has happened to them, not
what the author has planned, so everything in the bundle has ended on or before
`--as-of`. The command hands the drafter that horizon instead of trusting them
to keep it.

| Tier | What it shows |
| --- | --- |
| Long | The character's codex file, cut to the headings `context.codex` allows |
| Mid | The latest **approved** `character.stretch` on or before the date |
| Short | State events whose span covers the date: the register expression only, unless `--full-state` |
| History | Their posts, posts they replied to, posts that mention them, and scenes they were in that have ended (titles only) |

Two defaults are deliberately conservative:

- **The codex cut fails closed.** A codex file is written by an author who knows
  the whole series, so nothing in it is shown unless its heading is listed.
  Withheld material is counted, never named, because a heading like "The Online
  Life" is itself a disclosure. A per-character exclusion that no longer matches
  a heading is an error, so renaming a held section cannot quietly un-hold it.
- **Text that names an unended chapter or book is withheld.** Codex prose is
  written with the whole book in view and carries direction like "after Chapter
  15 he must not…". Any shown paragraph, heading, or `frontmatter` value naming
  a chapter that has not ended by `--as-of` is withheld and counted. A heading
  withholds its whole section, subsections included. References are read
  however they are written: `Chapter 15`, `Ch. 15`, `Ch15`, `Chapter Fifteen`,
  `Chapter XV`, `the fifteenth chapter`, lists and ranges like `Chapters 14, 15
  and 16` or `Chs. 14–16`, and explicit `Book 1, Chapter 15`, `Chapter 15 of
  Book Two`, or `book1#ch15`. Chapter numbers repeat across books, so a bare
  reference counts as past only once every book's chapter of that number has
  ended. A whole book (`By Book 3…`) counts as past only once all its chapters
  have ended and a later book has begun. A chapter the records don't know, or
  one named only by position (`the final chapter`), is treated as future.
- **State annotations are off by default.** They are written *about* the
  character and routinely carry things the character does not know ("misses
  her warning text"). `--full-state` includes them with a warning.

```yaml
context:
  codex:
    include: [Overview, Personality, Background, Everyday Life]   # prefix match
    excludeParagraphs: ["**Held"]                                  # held paragraphs inside shown sections
    frontmatter: [personaPublic]
    exclude:
      Oliver: [The Online Life]                                    # per character, by registry name
```

The bundle is horizon-safe, not knowledge-safe. It guarantees nothing from the
future; it cannot guarantee the included past contains only what the character
knows. That judgment stays with the author.

## 📦 Using Pinakes as a Library

The commands are also exported as functions, for editor plugins, sites, and
build scripts. They return what the CLI would print instead of printing it,
and they never exit the process.

```js
import { openUniverse, lint, compile, context, proseCheck, renderContextMarkdown } from '@bbthorson/pinakes';

const universe = openUniverse('./my-universe');   // reads pinakes.yaml and the registry once

const { ok, diagnostics } = lint(universe);        // ok === false exactly when `pinakes lint` exits 1
const { records } = compile(universe);             // in memory; nothing written
compile(universe, { write: true });                // what `pinakes compile` does, pruning included

const { bundle, errors } = context(universe, 'Jasper', '2026-10-11');
if (bundle) console.log(renderContextMarkdown(bundle));

const { tells } = proseCheck(universe, { report: 'tells' });
```

Every function also takes a root path in place of an opened universe.

* **`compile` does not write by default.** This is the one place the library
  differs from the CLI. Writing also prunes stale files from `paths.output`,
  and a caller that only wanted records shouldn't find its directory changed.
* **Bad input throws, findings are returned.** A missing or invalid
  `pinakes.yaml` throws, and so does a `proseCheck` whose `story` filter
  matches nothing. Continuity problems come back as `diagnostics`, and a
  character or date that `context` cannot use comes back in `errors`.

The package is ESM-only and ships TypeScript types.

## 🦋 AT Protocol & Identity Alignment

Pinakes models fictional universes using decentralized web primitives:

* **Stable IDs & DIDs:** Characters are mapped from local registry IDs (`char.emma`) to **DIDs (Decentralized Identifiers)** (e.g., `did:plc:123...` or sub-domains like `did:web:emma.supperclub.site`).
* **Cryptographic Story Stream:** In collaborative or open-world settings, chapters and state events are cryptographically signed by the character's key. The narrative timeline becomes a verifiable ledger of events.
* **Lexicon Schema Conformity:** Outward records are formatted to match official schema definitions (Lexicons), making them portable across PDS (Personal Data Servers) and readable by custom social client feeds.
