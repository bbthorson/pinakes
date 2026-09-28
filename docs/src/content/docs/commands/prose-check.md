---
title: "pinakes prose-check"
---

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
[Prose triage](../prose-triage.md). Everything is optional; the
defaults are the catalogue itself.
