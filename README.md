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

### Initializing a Universe

Bootstrap the standard `lore/`, `codex/`, and `stories/` folders with a default configuration:

```sh
pinakes init my-universe
```

# Or using npx directly:
# npx @bbthorson/pinakes init my-universe

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

#### Custom YAML Rules:
Authors can write custom rules in the `rules/` directory to enforce style guidelines or state transitions:

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
│   └── <nsid>.place.json
├── book1/
│   ├── scenes.json                    # Lexicon: *.scene
│   └── character_state_events.json    # Lexicon: *.character.stateEvent
└── series/
    ├── places.json                    # Lexicon: *.place
    └── character_profiles.json        # Lexicon: *.character.profile
```

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

FAIL — 1 record(s) do not match their Lexicon.
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

## 🦋 AT Protocol & Identity Alignment

Pinakes models fictional universes using decentralized web primitives:

* **Stable IDs & DIDs:** Characters are mapped from local registry IDs (`char.emma`) to **DIDs (Decentralized Identifiers)** (e.g., `did:plc:123...` or sub-domains like `did:web:emma.supperclub.site`).
* **Cryptographic Story Stream:** In collaborative or open-world settings, chapters and state events are cryptographically signed by the character's key. The narrative timeline becomes a verifiable ledger of events.
* **Lexicon Schema Conformity:** Outward records are formatted to match official schema definitions (Lexicons), making them portable across PDS (Personal Data Servers) and readable by custom social client feeds.
