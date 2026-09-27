/**
 * Regression tests for the audit fixes in PR #22. Each block reproduces a case
 * where `lint` passed on a broken universe, or `compile` produced colliding
 * record ids, and asserts the verdict the CLI now gives.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { appendConfig, chapter, cleanup, makeUniverse, readJson, run } from './helpers.mjs';

/** Builds a universe, hands it to `fn`, and always removes it. */
function withUniverse(files, fn) {
  const root = makeUniverse(files);
  try {
    fn(root);
  } finally {
    cleanup(root);
  }
}

const CH1 = 'stories/01_book/chapters/01_one.md';

test('the fixture universe lints and compiles clean', () => {
  withUniverse({}, (root) => {
    assert.equal(run(root, 'lint').status, 0);
    assert.equal(run(root, 'compile').status, 0);
  });
});

describe('a partial rules: block', () => {
  const broken = { [CH1]: chapter({ num: 1, date: '2026-10-01' }).replace('pov: Emma', 'pov: Nobody') };

  test('keeps the defaults for rules it does not name', () => {
    withUniverse(broken, (root) => {
      appendConfig(root, 'rules:\n  co-presence-conflict: "off"\n');
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /\[unresolved-entities\] 🔴 ERROR/);
    });
  });

  test('still applies the severity it does name', () => {
    withUniverse(broken, (root) => {
      appendConfig(root, 'rules:\n  unresolved-entities: warning\n');
      const { status, output } = run(root, 'lint');
      assert.equal(status, 0);
      assert.match(output, /\[unresolved-entities\] 🟡 WARNING/);
    });
  });
});

describe('malformed chapter frontmatter', () => {
  test('invalid YAML is an error, not a skipped chapter', () => {
    withUniverse(
      { 'stories/01_book/chapters/02_two.md': '---\nchapter: 2\ntitle: "unclosed\ndate: "2026-10-02"\n---\nx\n' },
      (root) => {
        const { status, output } = run(root, 'lint');
        assert.equal(status, 1);
        assert.match(output, /02_two\.md[\s\S]*\[malformed-frontmatter\] 🔴 ERROR: Frontmatter is not valid YAML/);
      }
    );
  });

  test('a file with no chapter key is a warning', () => {
    withUniverse({ 'stories/01_book/chapters/02_notes.md': '---\ntitle: Notes\n---\nx\n' }, (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 0);
      assert.match(output, /02_notes\.md[\s\S]*\[malformed-frontmatter\] 🟡 WARNING/);
    });
  });

  test('template-prefixed files are still ignored', () => {
    withUniverse({ 'stories/01_book/chapters/00_guide.md': '---\ntitle: "unclosed\n---\n' }, (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 0);
      assert.doesNotMatch(output, /malformed-frontmatter/);
    });
  });
});

describe('duplicate chapter numbers', () => {
  const files = { 'stories/01_book/chapters/02_dup.md': chapter({ num: 1, date: '2026-10-02' }) };

  test('fail lint', () => {
    withUniverse(files, (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /\[duplicate-chapter\] 🔴 ERROR: Chapter 1 is also declared by 01_one\.md/);
    });
  });

  test('fail compile on the colliding scene id', () => {
    withUniverse(files, (root) => {
      const { status, output } = run(root, 'compile');
      assert.equal(status, 1);
      assert.match(output, /\[duplicate-record-id\] 🔴 ERROR: Record id 'scene\.book1\.ch1'/);
    });
  });
});

test('an item passed twice in one chapter gets two distinct custody ids', () => {
  const custody = `custody:
  - item: Key
    holder: Emma
  - item: Key
    holder: Leo
    from: Emma
`;
  withUniverse({ [CH1]: chapter({ num: 1, date: '2026-10-01', extra: custody }) }, (root) => {
    assert.equal(run(root, 'compile').status, 0);
    const ids = readJson(root, 'records/book1/custody_events.json').map((r) => r.id);
    // The first hand-off keeps the bare id, so ids already published are stable.
    assert.deepEqual(ids, ['custodyEvent.key.book1.ch1', 'custodyEvent.key.book1.ch1.2']);
  });
});

test('two story directories with the same book key do not overwrite each other', () => {
  withUniverse(
    { 'stories/01_book_draft/chapters/01_one.md': chapter({ num: 1, date: '2026-10-01' }).replace('Chapter 1', 'DRAFT') },
    (root) => {
      const { status, output } = run(root, 'compile');
      assert.equal(status, 1);
      assert.match(output, /\[duplicate-book\] 🔴 ERROR: Story directory compiles to book key 'book1'/);
      const titles = readJson(root, 'records/book1/scenes.json').map((r) => r.title);
      assert.deepEqual(titles, ['Chapter 1']);
    }
  );
});

describe('context and posts', () => {
  test('a post with an empty body does not crash the bundle', () => {
    withUniverse(
      { 'stories/01_book/posts/a.md': '---\nauthor: Emma\nchapter: 1\ndate: "2026-10-01"\n---\n' },
      (root) => {
        const { status, output } = run(root, 'context', 'Emma', '--as-of', '2026-10-05');
        assert.equal(status, 0, output);
        assert.match(output, /post\.book1\.ch1\.emma\.1/);
      }
    );
  });

  test('an undated post is not shown before the horizon', () => {
    withUniverse(
      { 'stories/01_book/posts/a.md': '---\nauthor: Emma\nchapter: 1\n---\nThe future.\n' },
      (root) => {
        const { status, output } = run(root, 'context', 'Emma', '--as-of', '2026-10-05');
        assert.equal(status, 0, output);
        assert.doesNotMatch(output, /The future\./);
      }
    );
  });
});

test('post-register matches a chapter written as a zero-padded string', () => {
  withUniverse(
    {
      'stories/01_book/chapters/03_three.md': chapter({
        num: 3,
        date: '2026-10-03',
        extra: 'registers:\n  Emma: private\n',
      }),
      'stories/01_book/posts/a.md': '---\nauthor: Emma\nchapter: "03"\ndate: "2026-10-03"\n---\nA leak.\n',
    },
    (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /\[post-register\] 🔴 ERROR: Post is anchored to chapter 03/);
    }
  );
});

describe('missing-date', () => {
  const undated = { [CH1]: chapter({ num: 1, date: '2026-10-01' }).replace('date: "2026-10-01"', 'date: "someday"') };

  test('still reports an undated chapter when non-sequential-dates is off', () => {
    // It used to run inside the sequence check, so this setting disabled it too.
    withUniverse(undated, (root) => {
      appendConfig(root, 'rules:\n  non-sequential-dates: "off"\n');
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /\[missing-date\] 🔴 ERROR/);
    });
  });

  test('is configurable on its own', () => {
    withUniverse(undated, (root) => {
      appendConfig(root, 'rules:\n  missing-date: warning\n');
      const { status, output } = run(root, 'lint');
      assert.equal(status, 0);
      assert.match(output, /\[missing-date\] 🟡 WARNING/);
    });
  });
});

describe('custom rules', () => {
  /** A universe whose config points `paths.rules` at `glob`. The fixture config ends inside `paths:`. */
  const withRules = (glob, rule, fn) =>
    withUniverse({ 'rules/r.yaml': rule }, (root) => {
      appendConfig(root, `  rules: "${glob}"\n`);
      fn(root);
    });
  const rule = (pattern) => `name: title-case\ndescription: Titles start upper-case\nvalidate:\n  field: title\n  pattern: "${pattern}"\n`;

  test('a valid rule loads and enforces', () => {
    withRules('rules/*.yaml', rule('^[a-z]'), (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /\[title-case\] 🔴 ERROR/);
    });
  });

  test('an invalid regex fails lint instead of being skipped', () => {
    withRules('rules/*.yaml', rule('('), (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /failed to load custom rule rules\/r\.yaml: Invalid regular expression/);
    });
  });

  test('a directory instead of a glob fails lint instead of loading nothing', () => {
    withRules('rules', rule('^[A-Z]'), (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /failed to load custom rule/);
    });
  });

  test('a glob that matches no files fails lint instead of loading nothing', () => {
    withRules('rules/*.yml', rule('^[a-z]'), (root) => {
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /paths\.rules 'rules\/\*\.yml' matches no files/);
    });
  });

  // Each of these loaded, then checked nothing, and lint reported OK.
  const register = (validate) =>
    `name: registers\ndescription: Known registers only\nselector: stateEvent\nvalidate:\n${validate}`;
  for (const [what, body, message] of [
    ['a stateEvent rule on a field other than register', register('  field: pov\n  pattern: "^x$"\n'), /can only check `field: register`/],
    ['a stateEvent rule using required', register('  field: register\n  pattern: "^x$"\n  required: true\n'), /`required` is not checked for state events/],
    ['a stateEvent rule with no pattern', register('  field: register\n'), /needs a `pattern`/],
    ['a chapter rule with neither pattern nor required', 'name: r\ndescription: d\nvalidate:\n  field: title\n', /checks nothing/],
  ]) {
    test(`${what} fails lint instead of never running`, () => {
      withRules('rules/*.yaml', body, (root) => {
        const { status, output } = run(root, 'lint');
        assert.equal(status, 1);
        assert.match(output, /failed to load custom rule rules\/r\.yaml/);
        assert.match(output, message);
      });
    });
  }

  describe('a stateEvent register rule reads registers the way the compiler does', () => {
    const vocabulary = register('  field: register\n  pattern: "^(public|private|under-pressure)$"\n');
    const withRegister = (value, fn) =>
      withUniverse(
        {
          [CH1]: chapter({ num: 1, date: '2026-10-01', extra: `registers:\n  Emma: "${value}"\n` }),
          'rules/r.yaml': vocabulary,
        },
        (root) => {
          appendConfig(root, '  rules: "rules/*.yaml"\n');
          fn(run(root, 'lint'));
        }
      );

    test('a note in parentheses is not part of the register', () => {
      // Tested in full, this was 86 of Supper Club Secrets' 99 annotations failing.
      withRegister('private (sentiment flipping in real time)', ({ status, output }) => {
        assert.equal(status, 0, output);
      });
    });

    test('an arrow inside a note is not a transition', () => {
      withRegister('private (curious → quietly alarmed)', ({ status, output }) => {
        assert.equal(status, 0, output);
      });
    });

    test('every step of a transition is checked, not only the first', () => {
      withRegister('private (tired) → briefly animated (a glance)', ({ status, output }) => {
        assert.equal(status, 1);
        assert.match(output, /register state 'briefly animated' does not match/);
        assert.doesNotMatch(output, /register state 'private/);
      });
    });
  });

  test('a stateEvent register rule still loads and enforces', () => {
    const files = {
      'stories/01_book/chapters/01_one.md': chapter({ num: 1, date: '2026-10-01', extra: 'registers:\n  Emma: "guarded (tired)"\n' }),
    };
    withUniverse({ ...files, 'rules/r.yaml': register('  field: register\n  pattern: "^public$"\n') }, (root) => {
      appendConfig(root, '  rules: "rules/*.yaml"\n');
      const { status, output } = run(root, 'lint');
      assert.equal(status, 1);
      assert.match(output, /\[registers\] 🔴 ERROR/);
    });
  });
});
