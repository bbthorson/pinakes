# 🏛 Pinakes Universe Template

This is the canonical folder structure and configuration boilerplate for a **Pinakes** fictional universe. It comes pre-scaffolded with directories and templates for managing world lore, encyclopedia metadata (codex), stories, and validation rules.

---

## 📂 Folder Layout

*   `lore/` — Tone rules, audience guides, and character voice registers.
*   `codex/` — Canonical data sheets for characters, locations, and items, resolved against `entities.yaml`.
*   `stories/` — Creative drafts and tracking matrices (timeline ledger, subplot threads).
*   `records/` — Compiled, AT Protocol-compliant JSON records (generated automatically on compile).

---

## ⚡ Quick Start

### 1. Initialize Your Universe
To create your own universe from this boilerplate, click the **"Use this template"** button at the top right of this GitHub page, or bootstrap it locally using the CLI:

```sh
npx @bbthorson/pinakes init my-universe
```

### 2. Lint and Validate
Verify continuity, chronology, and physical co-presence constraints:

```sh
npx @bbthorson/pinakes lint
```

### 3. Compile to Database Records
Extract and export narrative events and profiles into portable Lexicon JSON formats:

```sh
npx @bbthorson/pinakes compile
```
