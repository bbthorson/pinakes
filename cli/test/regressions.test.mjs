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
});
