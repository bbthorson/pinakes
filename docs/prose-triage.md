# Prose triage

`pinakes prose-check` is the mechanical half of the AI-tells pass. It counts
things. It does not decide anything.

That division is the whole design, and it comes from the taxonomy itself
(`.claude/skills/story-audit/references/ai_tells.md`), which states it twice:
**flag repetition and formula, not presence**, and **counts are inputs, not
verdicts**. Almost every tell in the catalogue is also a legitimate craft tool.
Em-dashes, the rule of three, a character's physical reaction to fear — these are
how prose works. The tell is not that they appear; it is that they appear on a
schedule. No regex can tell those apart, so the tool does not try.

## Why it exists

The taxonomy already specified this pre-pass. What was missing was a way to run
it without spending a full `story-audit`: "feels em-dash-heavy" is worthless,
"41 em-dashes across 12 chapters, 9 of them in Ch. 7" is a finding, and getting
the second one used to mean a whole audit. Making the counts free means the
judgment read starts already pointed somewhere.

## Not a gate

`prose-check` exits 0 whatever it finds. Do not wire it into CI.

This is not an oversight to be corrected later. The taxonomy puts AI tells at the
bottom of its severity ladder — never red, never Tier 1 — and says every finding
is "a *suggestion with a location*, not a mandate," because it is a polish call
the author owns. A failing build is a mandate. Gating on this output would
contradict the document that defines it.

`pinakes lint` is the gate. That one fails, on purpose, because a continuity
contradiction is a fact about the story being wrong. A short chapter ending is
not.

## The two reports

### `tells`

A per-chapter table of counts, em-dash density per 1000 words, and book totals.

Three things in it are deliberately not plain counts:

**Hard-signal hits are quoted verbatim.** The `corporate-filler` and
`here's-the-kicker` signals are rare enough that every hit fits on the page, and
a bare count of them invites the wrong call in both directions. In the reference
universe all three filler hits needed the line to judge: one was a literal door
being unlocked, one was inside a character's catalogued jargon-for-laughs
register (designed voice, not a tell), and one was real. "3" would have been
wrong three ways.

**Negative parallelism reports two numbers that are never added.** The classified
count matches the corrective form (`not X — it's Y`). The unclassified count is
every sentence-initial `Not `, which over-counts badly: it sweeps in participials
("Not wanting to hear them argue"), conditionals ("Not unless you had a plan")
and dialogue punchlines ("Not after the Debacle"). A real pass once reported 42
from the bare grep when the hand-classified figure was about 31, and concluded
the book had a tic it did not have. Both numbers are printed, labelled, and kept
apart so that cannot be repeated by reading one as the other.

**Declared carve-outs are counted, not suppressed.** A term the voice guide has
catalogued as a character's register is designed and must not be flagged — but
silently subtracting it hides how much of the total is designed. The report
prints the carved-out share beside the raw count and tells you to subtract it
yourself.

### `closers`

Every chapter's final paragraph, in order, in one file.

The assembly is the value, not the flag. The taxonomy records the
epiphany-button close as the highest-yield finding of its first real audit *and*
as having zero mechanical signal, for the same reason: the tell is sameness of
move across chapters, which does not exist at the level of any single chapter. It
can only be caught by reading all of them in one sitting — which is exactly what
gets skipped under time pressure.

There is a `SHORT` flag, and it is deliberately modest. It marks closers that are
narration-only and under the word limit: a button is the narrator summarising what
a scene meant, so a closer ending on a line of speech is not one, whatever its
length. Measured against a hand-identified set of seven buttons in a locked
manuscript it agreed on three, and the four it missed ran 19, 19, 38 and 54 words
— the human pass called a 54-word closer a button. Length is not the axis the
tell lives on and no threshold repairs that, so the report states the miss rate
instead of leading with a count that would read as a verdict.

## Configuration

Everything under `prose:` is optional. The defaults are the catalogue, so the
command is useful before you configure anything.

```yaml
prose:
  # Replaces the built-in signal list when present. Give it your own when your
  # universe legitimately earns a catalogued word — "leverage" in a corporate
  # satire, "symphony" in a lyrical one — rather than reading a column of
  # false positives forever.
  signals:
    - label: corporate-filler
      pattern: '\b(delve|unlock|elevate|tapestry|ecosystem)\b'
      note: "dropped 'leverage': the CFO character is supposed to talk like that"

  # Terms your voice guide has already catalogued as designed. Reported for
  # subtraction, never hidden. `character` scopes the count to paragraphs naming
  # that character, which is how you separate one character's registered tic
  # from the same word used generically everywhere else.
  carveOuts:
    - term: quietly
      character: Oliver
      note: "Oliver's catalogued quiet register."

  # Word ceiling for the SHORT closer flag.
  closerMaxWords: 12
```

## What it does not do

**It does not read prose for meaning.** Every signal is a surface pattern.

**It does not collect dialogue per character.** That report exists in the
reference universe but is held back from Pinakes deliberately: it resolves
speaker names by title-casing a slug, which fails on `Jean-Luc van der Berg`, and
it assumes dialogue is marked with quote marks, which makes dash-led speech
(`— Like this.`) invisible rather than merely unattributed. Both want the entity
registry's resolver and a configured dialogue convention before they can be
called general.

**It does not edit.** It reports. Prose is the author's.
