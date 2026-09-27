/**
 * Character DIDs: carried from the registry entry onto the profile record and
 * checked for syntax, never minted or resolved. A DID atproto would reject, one
 * two characters share, or one left in a codex file must fail both `lint` and
 * `compile`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, run, withUniverse, type Files } from './helpers.ts';

const PLC = 'did:plc:b4xqf5g2j52z3y7mcnk6jtms';

/**
 * A universe whose registry entries carry the given fields, e.g.
 * `did: did:plc:…` (inline YAML, joined into each entry's flow map).
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
    'codex/characters/emma.md': `---\nhandle: emmacooks\n${emmaCodex}---\n# Emma\n`,
  };
}

const profiles = (root: string) => readJson(root, 'records/series/character_profiles.json');

describe('a valid DID', () => {
  for (const did of [PLC, 'did:web:emma.supperclub.site']) {
    test(`${did} is carried onto the profile`, () => {
      withUniverse(universe(`did: "${did}"`), (root) => {
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

  test('is optional', () => {
    withUniverse(universe(), (root) => {
      assert.equal(run(root, 'compile').status, 0);
      assert.equal('did' in profiles(root)[0], false);
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
        const lint = run(root, 'lint');
        assert.equal(lint.status, 1, lint.output);
        assert.match(lint.output, /entities\.yaml[\s\S]*\[invalid-did\] 🔴 ERROR: DID .* for char\.emma is not a valid atproto DID/);
        assert.match(lint.output, reason);

        const compile = run(root, 'compile');
        assert.equal(compile.status, 1, compile.output);
        assert.match(compile.output, /\[invalid-did\]/);
      });
    });
  }
});

describe('a DID two characters claim', () => {
  test('fails lint and compile, even when one character is retired', () => {
    withUniverse(universe(`did: "${PLC}"`, `did: "${PLC}"`), (root) => {
      const lint = run(root, 'lint');
      assert.equal(lint.status, 1, lint.output);
      assert.match(
        lint.output,
        /entities\.yaml[\s\S]*\[duplicate-did\] 🔴 ERROR: DID 'did:plc:b4xqf5g2j52z3y7mcnk6jtms' for char\.leo is also claimed by char\.emma/
      );
      const compile = run(root, 'compile');
      assert.equal(compile.status, 1, compile.output);
      assert.match(compile.output, /\[duplicate-did\]/);
    });
  });

  test('matches a did:web whatever its case', () => {
    withUniverse(universe('did: "did:web:Emma.SupperClub.site"', 'did: "did:web:emma.supperclub.site"'), (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1, output);
      assert.match(output, /\[duplicate-did\]/);
    });
  });
});

test('a DID on a place is an error: only characters have accounts', () => {
  withUniverse(universe('', '', { bar: `did: "${PLC}"` }), (root) => {
    const { status, output } = run(root, 'lint');
    assert.equal(status, 1, output);
    assert.match(output, /\[invalid-did\] 🔴 ERROR: place\.bar has a DID, but only characters have accounts/);
  });
});

describe('a DID left in codex frontmatter', () => {
  // Where DIDs lived before 0.9.0. Reading it as a fallback would give a
  // universe two sources that can disagree; ignoring it would drop it silently.
  test('fails lint and compile, and the codex value is not carried', () => {
    withUniverse(universe('', '', { emmaCodex: `did: ${PLC}\n` }), (root) => {
      const lint = run(root, 'lint');
      assert.equal(lint.status, 1, lint.output);
      assert.match(
        lint.output,
        /emma\.md[\s\S]*\[did-in-codex\] 🔴 ERROR: `did` belongs on char\.emma's entry in codex\/entities\.yaml, not in its codex file/
      );
      const compile = run(root, 'compile');
      assert.equal(compile.status, 1, compile.output);
      assert.match(compile.output, /\[did-in-codex\]/);
      assert.equal('did' in profiles(root)[0], false);
    });
  });

  test('is an error even beside a registry DID', () => {
    withUniverse(universe(`did: "${PLC}"`, '', { emmaCodex: `did: ${PLC}\n` }), (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1, output);
      assert.match(output, /\[did-in-codex\]/);
    });
  });
});
