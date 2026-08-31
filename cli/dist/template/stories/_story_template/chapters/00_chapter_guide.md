# Chapter Writing Guide

## Chapter Frontmatter (REQUIRED)

Every chapter file begins with a YAML frontmatter block. The frontmatter is the chapter's source of truth for timeline, location, voice register, and threads — it forces you to know what the chapter is doing before you write or edit prose. It is also what makes the story machine-readable: any extraction or continuity tooling reads the frontmatter, not the prose.

### Spec

**Required:** `chapter`, `title`, `part`, `beat`, `date`, `pov`, `characters_present`, `registers`, `threads`, `beat_purpose`. **Optional:** `day`, `time`, `location`, `tags`, `characters_referenced`, `clues`, `audit_notes` (include when they apply).

```yaml
---
chapter: 13
title: "[Chapter Title]"
part: 3
beat: "[Structural beat — e.g., Bad Guys Close In]"
tags: ["[label]"]                         # free-form labels; carried onto the scene record (optional)
day: "Monday → Wednesday"                 # human-readable (optional)
date: "2026-10-12 to 2026-10-14"          # ISO, absolute (required). Spans: "A to B" or ISO interval "A/B" — tooling reads the ISO dates, not the separator.
time: "Mon morning → Wed midday"          # time-of-day or span (optional)
location:                                 # exact canonical names from canon library/locations/index.md
  - "[Location Name]"
  - "[Other Location] (referenced)"
pov: "[Character]"                        # the chapter's viewpoint owner (required)
characters_present:                       # on-page in an active scene (required)
  - "[Character] (centerstage)"
  - "[Character] (phone call, end of chapter)"
characters_referenced:                    # named but not on-page (optional)
  - "[Character] (texted, no reply)"
registers:                                # voice register per PRESENT character (required)
  "[Character]": "private → under-pressure"
  "[Character]": "public"
clues:                                    # optional; powers plant/payoff tracing
  planted: []
  revealed: []
threads:                                  # must cross-reference tracking/subplot_threads.md
  active:
    - "[Thread]: [what moves in this chapter]"
  touched:
    - "[Thread]: [brushed against, not advanced]"
beat_purpose: "[One sentence: what this chapter accomplishes that no other chapter does.]"
audit_notes:                              # optional; continuity/decision notes for this chapter
  - "[Why a date/place/reveal is the way it is — the note your future audit will thank you for]"
---
```

### Rules

1. **`date` is absolute.** Never write `date: "the next day"`. Use ISO format. This is the single biggest defense against timeline drift across chapters.
2. **`location` is canonical.** Use the **exact** display name from [canon library/locations/index.md](../../../canon%20library/locations/index.md) (capitalization included) so tooling can resolve it. The only permitted qualifier is a trailing `(referenced)` when a place is named but isn't the active scene. Settings that genuinely aren't in the registry (a one-off road stop, a public street) are written as plain free text — they simply won't resolve to an entity. Check the index's scheduling/travel rules before assigning a date.
3. **`registers` only lists characters in the active scene.** A character mentioned but not present doesn't get a register. If a character is in the scene but no register is listed, that's a flag — they're probably reduced to set dressing.
4. **`threads` must reference an entry in `tracking/subplot_threads.md`.** If a thread is touched here, it should appear there with this chapter cited.
5. **`beat_purpose` is one sentence.** If you can't answer what this chapter uniquely accomplishes, the chapter probably doesn't need to exist.

---

## Chapter Structure

Each chapter should accomplish **1–2 story beats**. Length follows function:

| Chapter Type | Word Count | Purpose |
|--------------|------------|---------|
| Scene bridge | 800–1,200 | Quick transition, single beat |
| Standard | 2,000–2,500 | One or two beats, moderate pacing |
| Ensemble scene | 2,500–3,500 | Full-cast dialogue, multiple threads |

---

## File Organization

Chapters live in a single flat `chapters/` folder. Each chapter file is prefixed with its part number for at-a-glance arc tracking:

```
chapters/
├── 00_story_outline.md          ← Full chapter-by-chapter breakdown
├── p1_01_chapter_title.md       ← Part 1: Setup
├── p1_02_chapter_title.md
├── ...
├── p2_06_chapter_title.md       ← Part 2: Development
├── ...
├── p3_12_chapter_title.md       ← Part 3: Crisis
├── ...
└── p4_16_chapter_title.md       ← Part 4: Resolution
```

### Naming Convention

`p[part]_[chapter number]_[snake_case_title].md`

- **Part prefix** (`p1_`, `p2_`, …): groups chapters visually by story arc
- **Chapter number**: sequential across the entire story (not per-part)
- **Title**: snake_case version of the chapter title

Adapt the part names and counts to your structure (`series overview` and your writing guide own that decision); keep the flat-folder + prefix convention.

---

## Chapter Checklist

Before moving on from a chapter:

- [ ] Frontmatter complete and consistent with the prose (dates, places, who's present)
- [ ] Clear POV maintained throughout
- [ ] At least one beat accomplished
- [ ] Character voices consistent with the voice guide
- [ ] Sensory details ground the scene
- [ ] Any clues planted are subtle but findable on reread
- [ ] Dialogue tags minimized, actions preferred
- [ ] Chapter ends with forward momentum
- [ ] Tracking files updated (matrix row, ledger entry, threads touched — see `../tracking/README.md`)
