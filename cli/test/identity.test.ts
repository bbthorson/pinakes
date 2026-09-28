/**
 * Character accounts: a `did` and a `handle`, carried from the registry entry
 * onto the profile record and checked for syntax, never minted or resolved. A
 * value atproto would reject, one two characters share, or one left in a codex
 * file must fail both `lint` and `compile`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, run, withUniverse, type Files } from './helpers.ts';

const PLC = 'did:plc:b4xqf5g2j52z3y7mcnk6jtms';

/**
 * A universe whose registry entries carry the given fields, e.g.
 * `did: "did:plc:…"` (inline YAML, joined into each entry's flow map).
 */
function universe(emma = '', leo = '', { bar = '', emmaCodex = '' } = {}): Files {
  const extra = (fields: string) => (fields ? `, ${fields}` : '');
  return {
    'codex/entities.yaml': `characters:
  - { id: char.emma, type: character, displayName: Emma, sourceFile: codex/characters/emma.md${extra(emma)} }
  - { id: char.leo, type: character, displayName: Leo, status: retired${extra(leo)} }
places:
  - { id: place.bar, type: place, displayName: The Bar${extra(bar)} }
`,
    'codex/characters/emma.md': `---\ntype: Character\n${emmaCodex}---\n# Emma\n`,
  };
}

const profiles = (root: string) => readJson(root, 'records/series/character_profiles.json');

/** Asserts `lint` and `compile` both exit 1 and name `rule`; returns lint's output. */
function failsBoth(root: string, rule: string): string {
  const lint = run(root, 'lint');
  assert.equal(lint.status, 1, lint.output);
  assert.match(lint.output, new RegExp(`\\[${rule}\\] 🔴 ERROR`));
  const compile = run(root, 'compile');
  assert.equal(compile.status, 1, compile.output);
  assert.match(compile.output, new RegExp(`\\[${rule}\\]`));
  return lint.output;
}

describe('a valid account is carried onto the profile', () => {
  for (const did of [PLC, 'did:web:emma.supperclub.site']) {
    test(did, () => {
      withUniverse(universe(`did: "${did}", handle: emmacooks`), (root) => {
        const lint = run(root, 'lint');
        assert.equal(lint.status, 0, lint.output);
        const compile = run(root, 'compile');
        assert.equal(compile.status, 0, compile.output);
        const [emma] = profiles(root);
        assert.equal(emma.did, did);
        assert.equal(emma.handle, 'emmacooks');
      });
    });
  }

  test('a handle loses a leading @', () => {
    withUniverse(universe('handle: "@emmacooks"'), (root) => {
      assert.equal(run(root, 'compile').status, 0);
      assert.equal(profiles(root)[0].handle, 'emmacooks');
    });
  });

  test('both fields are optional', () => {
    withUniverse(universe(), (root) => {
      assert.equal(run(root, 'compile').status, 0);
      assert.equal('did' in profiles(root)[0], false);
      assert.equal('handle' in profiles(root)[0], false);
    });
  });
});

describe('an invalid DID fails lint and compile', () => {
  const cases: [string, string, RegExp][] = [
    ['an upper-case did:plc', `did: "${PLC.toUpperCase().replace('DID:PLC:', 'did:plc:')}"`, /24 lower-case base32/],
    ['a short did:plc', 'did: "did:plc:abc"', /24 lower-case base32/],
    ['a did:web with a path', 'did: "did:web:example.com:emma"', /bare hostname/],
    ['a method atproto does not accept', 'did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"', /only did:plc and did:web/],
    ['a bare identifier', 'did: b4xqf5g2j52z3y7mcnk6jtms', /only did:plc and did:web/],
    // Read as a list, this would be dropped as though no DID were given.
    ['a list', `did: ["${PLC}"]`, /not a string/],
  ];
  for (const [what, line, reason] of cases) {
    test(what, () => {
      withUniverse(universe(line), (root) => {
        const output = failsBoth(root, 'invalid-did');
        assert.match(output, /entities\.yaml[\s\S]*\[invalid-did\] 🔴 ERROR: DID .* for char\.emma is not valid/);
        assert.match(output, reason);
      });
    });
  }
});

describe('an invalid handle fails lint and compile', () => {
  const cases: [string, string, RegExp][] = [
    // The domain is a publishing decision, so the record never carries it.
    ['a qualified handle', 'handle: emmacooks.supperclubsecrets.com', /the first label only, without the domain/],
    ['a space', 'handle: "emma cooks"', /letters, digits and hyphens/],
    ['a leading hyphen', 'handle: "-emma"', /letters, digits and hyphens/],
    ['an underscore', 'handle: emma_cooks', /letters, digits and hyphens/],
    ['a label over 63 characters', `handle: ${'e'.repeat(64)}`, /at most 63/],
    // YAML reads this as a number; carrying `1234` would change its type.
    ['an unquoted number', 'handle: 1234', /not a string \(quote it in YAML\)/],
  ];
  for (const [what, line, reason] of cases) {
    test(what, () => {
      withUniverse(universe(line), (root) => {
        const output = failsBoth(root, 'invalid-handle');
        assert.match(output, /Handle .* for char\.emma is not valid/);
        assert.match(output, reason);
      });
    });
  }
});

describe('an account two characters claim', () => {
  test('a shared DID fails lint and compile, even when one character is retired', () => {
    withUniverse(universe(`did: "${PLC}"`, `did: "${PLC}"`), (root) => {
      const output = failsBoth(root, 'duplicate-did');
      assert.match(output, /DID 'did:plc:b4xqf5g2j52z3y7mcnk6jtms' for char\.leo is also claimed by char\.emma/);
    });
  });

  test('a did:web matches whatever its case', () => {
    withUniverse(universe('did: "did:web:Emma.SupperClub.site"', 'did: "did:web:emma.supperclub.site"'), (root) => {
      failsBoth(root, 'duplicate-did');
    });
  });

  test('a shared handle fails lint and compile, whatever its case', () => {
    withUniverse(universe('handle: EmmaCooks', 'handle: emmacooks'), (root) => {
      const output = failsBoth(root, 'duplicate-handle');
      assert.match(output, /Handle 'emmacooks' for char\.leo is also claimed by char\.emma/);
    });
  });
});

describe('only characters have accounts', () => {
  for (const [name, line] of [['did', `did: "${PLC}"`], ['handle', 'handle: thebar']]) {
    test(`a ${name} on a place is an error`, () => {
      withUniverse(universe('', '', { bar: line }), (root) => {
        const output = failsBoth(root, `invalid-${name}`);
        assert.match(output, new RegExp(`place\\.bar has a ${name}, but only characters have accounts`));
      });
    });
  }
});

describe('an account field left in codex frontmatter', () => {
  // Reading it as a fallback would give a universe two sources that can
  // disagree; ignoring it would drop it silently.
  for (const [name, line] of [['did', `did: ${PLC}\n`], ['handle', 'handle: emmacooks\n']]) {
    test(`a ${name} fails lint and compile, and the codex value is not carried`, () => {
      withUniverse(universe('', '', { emmaCodex: line }), (root) => {
        const output = failsBoth(root, `${name}-in-codex`);
        assert.match(
          output,
          new RegExp(`emma\\.md[\\s\\S]*\`${name}\` belongs on char\\.emma's entry in codex/entities\\.yaml, not in its codex file`)
        );
        assert.equal(name in profiles(root)[0], false);
      });
    });
  }

  test('is an error even beside the registry value', () => {
    withUniverse(universe('handle: emmacooks', '', { emmaCodex: 'handle: emmacooks\n' }), (root) => {
      failsBoth(root, 'handle-in-codex');
    });
  });
});
