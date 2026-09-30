---
title: "pinakes context"
---

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
| Affect | Only when the mid-tier stretch declares `affect:` and it falls in a basin: its coordinates and advisory tendencies |
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

**The affect block is advisory and opt-in by declaration.** It appears only for
a stretch that declared its own `affect:`; a register is never turned into one.
It prints under a header saying the voice guide and register win on any
conflict, and lists `SUGGESTED_TENDENCIES`, not constraints. `context: { affect:
off }` turns it off for the whole universe. See [Affect](/pinakes/affect-simulation/).

The bundle is horizon-safe, not knowledge-safe. It guarantees nothing from the
future; it cannot guarantee the included past contains only what the character
knows. That judgment stays with the author.
