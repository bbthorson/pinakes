/**
 * Character DIDs: carried from codex frontmatter onto the profile record and
 * checked for syntax, never minted or resolved. A DID atproto would reject, or
 * one two characters share, must fail both `lint` and `compile`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, run, withUniverse, type Files } from './helpers.ts';

const PLC = 'did:plc:b4xqf5g2j52z3y7mcnk6jtms';

const REGISTRY = `characters:
  - { id: char.emma, type: character, displayName: Emma, sourceFile: codex/characters/emma.md }
  - { id: char.leo, type: character, displayName: Leo, sourceFile: codex/characters/leo.md, status: retired }
places:
  - { id: place.bar, type: place, displayName: The Bar }
`;

/** A universe whose codex files carry the given frontmatter lines. */
function universe(emma: string, leo = ''): Files {
  return {
    'codex/entities.yaml': REGISTRY,
    'codex/characters/emma.md': `---\nhandle: emmacooks\n${emma}---\n# Emma\n`,
    'codex/characters/leo.md': `---\n${leo}---\n# Leo\n`,
  };
}

const profiles = (root: string) => readJson(root, 'records/series/character_profiles.json');

describe('a valid DID', () => {
  for (const did of [PLC, 'did:web:emma.supperclub.site']) {
    test(`${did} is carried onto the profile`, () => {
      withUniverse(universe(`did: ${did}\n`), (root) => {
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
    withUniverse(universe(''), (root) => {
      assert.equal(run(root, 'compile').status, 0);
      assert.equal('did' in profiles(root)[0], false);
    });
  });
});

describe('an invalid DID fails lint and compile', () => {
  const cases: [string, string, RegExp][] = [
    ['an upper-case did:plc', `did: ${PLC.toUpperCase().replace('DID:PLC:', 'did:plc:')}\n`, /24 lower-case base32/],
    ['a short did:plc', 'did: did:plc:abc\n', /24 lower-case base32/],
    ['a did:web with a path', 'did: did:web:example.com:emma\n', /bare hostname/],
    ['a method atproto does not accept', 'did: did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK\n', /only did:plc and did:web/],
    ['a bare identifier', 'did: b4xqf5g2j52z3y7mcnk6jtms\n', /only did:plc and did:web/],
    // Read as a list, this used to be dropped as though no DID were given.
    ['a list', `did: [${PLC}]\n`, /not a string/],
  ];
  for (const [what, line, reason] of cases) {
    test(what, () => {
      withUniverse(universe(line), (root) => {
        const lint = run(root, 'lint');
        assert.equal(lint.status, 1, lint.output);
        assert.match(lint.output, /emma\.md[\s\S]*\[invalid-did\] 🔴 ERROR: DID .* for char\.emma is not a valid atproto DID/);
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
    withUniverse(universe(`did: ${PLC}\n`, `did: ${PLC}\n`), (root) => {
      const lint = run(root, 'lint');
      assert.equal(lint.status, 1, lint.output);
      assert.match(
        lint.output,
        /leo\.md[\s\S]*\[duplicate-did\] 🔴 ERROR: DID 'did:plc:b4xqf5g2j52z3y7mcnk6jtms' for char\.leo is also claimed by codex\/characters\/emma\.md/
      );
      const compile = run(root, 'compile');
      assert.equal(compile.status, 1, compile.output);
      assert.match(compile.output, /\[duplicate-did\]/);
    });
  });

  test('matches a did:web whatever its case', () => {
    withUniverse(universe('did: did:web:Emma.SupperClub.site\n', 'did: did:web:emma.supperclub.site\n'), (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1, output);
      assert.match(output, /\[duplicate-did\]/);
    });
  });
});
