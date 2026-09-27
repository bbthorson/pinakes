# `pinakes lint`

Scans the creative layers of your project, parses chapter frontmatter, resolves names against the codex registry, and checks for timeline or co-presence violations.

```sh
pinakes lint --root .
```

## Diagnostic output example
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

## Built-in checks
* **Entity Resolution:** Verifies that every character, location, and item mentioned in chapter frontmatter exists in `entities.yaml` or is explicitly ignored in `non_entities.yaml`.
* **Sequential Timelines:** Ensures start dates do not retrogress across sequential chapters.
* **Co-Presence Conflicts:** Flags physical impossibilities, such as a character being marked as present in two distinct locations at the same time.
* **Custody Resolution:** Verifies that every item and holder named in a chapter's `custody:` block resolves, so a hand-off is never silently dropped.
* **Stretch Horizon:** Verifies that a character stretch cites only records that have ended by its `asOf` date, so a character never draws on what hasn't happened yet.
* **Frontmatter Integrity:** A chapter whose frontmatter is not valid YAML is an error, and a file in `chapters/` with no `chapter` key is a warning. Either would otherwise drop out of every check.
* **Unique Chapters:** Two chapter files in one story with the same `chapter` number are an error, since chapter numbers become record ids.
* **Registry Conflicts:** One alias claimed by two entities of the same type is an error, and the alias resolves to neither until one entry drops it. A character and a place may share a name. An id registered twice is also an error.
* **Registry Validity:** An `entities.yaml` entry that is missing `id`, `type` or `displayName`, or has a field of the wrong type, is an error. It is left out of the registry, and `lint` would otherwise pass with the entity silently missing.

Severities are set per rule under `rules:` in `pinakes.yaml`, and a `rules:` block only needs the rules you change: the rest keep their defaults. The full table is in [Continuity and drift](../continuity-and-drift.md#the-built-in-rules).

## Custom YAML rules
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
