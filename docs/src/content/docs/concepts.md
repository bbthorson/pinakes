---
title: "Concepts"
---

## The historical inspiration

In the 3rd century BCE, the Great Library of Alexandria was rapidly accumulating the world's knowledge on thousands of unindexed papyrus scrolls. To prevent this vast archive from collapsing into chaos, the scholar and poet **Callimachus of Cyrene** compiled the **Pinakes** (Greek: Πίνακες, meaning "tables" or "charts").

The *Pinakes* was a monumental, 120-volume bibliographic catalog. It didn't just list books—it classified authors, indexed chapter metadata, cataloged character details, and verified historical timelines.

Modern storytellers face the same problem. As a fictional universe grows, the sheer volume of facts, timelines, and character states quickly exceeds one writer's working memory. **Pinakes** is the digital successor to Callimachus's tables: an automated archivist that verifies your universe's continuity as you write.

## The core philosophy

Pinakes is built on two load-bearing creative principles:

### The Golden Rule: the story drives the canon
In many data-driven narrative pipelines, structured world-state tables cage the writing. Pinakes inverts this. **Prose is the source of truth.**
If a finished chapter conflicts with a previously established fact in your encyclopedia, **the story is correct**, and the encyclopedia must be updated. Pinakes runs downstream of the writing, projecting the narrative's reality into structured records rather than constraining the author.

### Inward and outward layers
A fictional universe has two opposite directions of information flow:
* **The Inward Layer (Authoring):** A private, static, agent-readable knowledge graph used by the writer. It conforms to the Google **Open Knowledge Format (OKF)**—standardized Markdown files that let LLMs and scripts traverse character and location files without custom parsers.
* **The Outward Layer (Publishing):** A public, time-series stream of records projected onto reader-facing surfaces (like a timeline explorer or social feeds). It conforms to **AT Protocol Lexicons**, where characters are cryptographic identities (DIDs) owning their own history.

## AT Protocol and identity

Pinakes models fictional universes using decentralized web primitives. Only
the first of these ships today:

* **Lexicon schema conformity.** Outward records are formatted to match the
  universe's own Lexicon schema documents and validated against them, making
  them portable across PDS (Personal Data Servers) and readable by custom
  social client feeds. See [Record types](record-types.md).
* **Stable IDs and DIDs** *(partly shipped)*. Characters have permanent local
  registry IDs (`char.emma`), and a character's registry entry can name its
  **DID (Decentralized Identifier)**, such as `did:plc:…` or
  `did:web:emma.supperclub.site`. The compiler carries the DID onto the
  profile and checks its syntax. Nothing mints or resolves a DID yet. See
  [Identity: today, and identity later](record-types.md#identity-today-and-identity-later).
* **Cryptographic story stream** *(planned)*. In collaborative or open-world
  settings, chapters and state events are signed by the character's key, and
  the narrative timeline becomes a verifiable ledger of events.
