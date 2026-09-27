---
layout: home

hero:
  name: Pinakes
  text: Continuity checking for fiction
  tagline: A linter for the facts of your story, and a compiler from prose to AT Protocol records.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Concepts
      link: /concepts
    - theme: alt
      text: Try the demo
      link: /demo
    - theme: alt
      text: GitHub
      link: https://github.com/bbthorson/pinakes

features:
  - title: Prose is the source of truth
    details: Pinakes runs downstream of the writing. When a finished chapter contradicts the codex, the chapter wins and the codex is what gets updated.
    link: /concepts
  - title: Continuity in CI
    details: "<code>pinakes lint</code> catches retrogressing timelines, a character in two places at once, dropped item hand-offs, and names the codex doesn't know."
    link: /commands/lint
  - title: Records with a contract
    details: "<code>pinakes compile</code> turns chapters and the codex into AT Protocol records, validated against Lexicon schemas it writes for your universe."
    link: /commands/compile
  - title: Context that looks backward
    details: "<code>pinakes context</code> assembles what one character can see on one story date, withholding anything from chapters that haven't happened yet."
    link: /commands/context
---
