/**
 * The as-of horizon in `pinakes context`: codex text that names a chapter or
 * book that has not ended must not reach the bundle, however it is written.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chapterRefs, namesUnendedChapter, type ChapterRef, type ContextBundle } from '../dist/context/bundle.js';
import { appendConfig, chapter, cleanup, makeUniverse, run } from './helpers.ts';

describe('chapterRefs reads the ways authors write a chapter', () => {
  const cases: [string, ChapterRef[]][] = [
    ['After Chapter 15 he', [{ chapter: 15 }]],
    ['Ch15', [{ chapter: 15 }]],
    ['Ch. 15', [{ chapter: 15 }]],
    ['Chs. 3-5', [{ chapter: 3 }, { chapter: 4 }, { chapter: 5 }]],
    ['Chapter Fifteen', [{ chapter: 15 }]],
    ['chapter twenty-one', [{ chapter: 21 }]],
    ['Chapter XV', [{ chapter: 15 }]],
    ['Chapter I', [{ chapter: 1 }]],
    ['Chapters 14, 15 and 16', [{ chapter: 14 }, { chapter: 15 }, { chapter: 16 }]],
    ['Chapters 14–16', [{ chapter: 14 }, { chapter: 15 }, { chapter: 16 }]],
    ['Chapters fourteen to sixteen', [{ chapter: 14 }, { chapter: 15 }, { chapter: 16 }]],
    ['the fifteenth chapter', [{ chapter: 15 }]],
    ['the twenty-first chapter', [{ chapter: 21 }]],
    ['the 15th chapter', [{ chapter: 15 }]],
    ['Book 1, Chapter 15', [{ book: 1, chapter: 15 }]],
    ['Book Two, Chapter 4', [{ book: 2, chapter: 4 }]],
    ['Chapter 4 of Book 2', [{ book: 2, chapter: 4 }]],
    ['the third chapter of Book 2', [{ book: 2, chapter: 3 }]],
    ['book2#ch4', [{ book: 2, chapter: 4 }]],
    ['By Book 3 she has left', [{ book: 3 }]],
    ['Book I', [{ book: 1 }]],
    ['the second book', [{ book: 2 }]],
    ['in the final chapter', [{}]],
  ];
  for (const [text, expected] of cases) {
    test(JSON.stringify(text), () => assert.deepEqual(chapterRefs(text), expected));
  }
});

describe('chapterRefs does not invent references', () => {
  const cases: [string, ChapterRef[]][] = [
    ['the chapter I wrote', []],
    ['Chapter 3 and I left', [{ chapter: 3 }]],
    ['chapter 14 and the next', [{ chapter: 14 }]],
    ['Chapter 5, which', [{ chapter: 5 }]],
    ['a civil chapter', []],
    ['she read a book', []],
    ['the chill', []],
  ];
  for (const [text, expected] of cases) {
    test(JSON.stringify(text), () => assert.deepEqual(chapterRefs(text), expected));
  }
});

describe('namesUnendedChapter', () => {
  // Book 1: ch1 ends Oct 1, ch2 ends Oct 10. Book 2: ch1 ends Nov 1.
  const ends = new Map([
    ['book1', new Map([[1, '2026-10-01'], [2, '2026-10-10']])],
    ['book2', new Map([[1, '2026-11-01']])],
  ]);
  const unended = (text: string, asOf: string) => namesUnendedChapter(text, asOf, ends);

  test('a chapter that has ended is the past', () => {
    assert.equal(unended('In Book 1, Chapter One she opened.', '2026-10-05'), false);
  });

  test('a bare chapter number must have ended in every book that has it', () => {
    // Book 1's chapter 1 has ended by Oct 5; Book 2's has not.
    assert.equal(unended('In Chapter One she opened.', '2026-10-05'), true);
    assert.equal(unended('In Chapter One she opened.', '2026-11-02'), false);
  });

  test('every chapter in a list must have ended', () => {
    assert.equal(unended('Book 1, Chapters 1 and 2', '2026-10-05'), true);
    assert.equal(unended('Book 1, Chapters 1 and 2', '2026-10-15'), false);
  });

  test('a chapter no record knows is the future', () => {
    assert.equal(unended('Chapter 40', '2027-01-01'), true);
  });

  test('a range too long to expand is the future', () => {
    assert.equal(unended('Chapters 1-9000', '2027-01-01'), true);
  });

  test('a chapter named only by position is the future', () => {
    assert.equal(unended('in the final chapter', '2027-01-01'), true);
  });

  test('a book is past only once it has ended and the next has begun', () => {
    // Every compiled chapter of Book 1 has ended, but Book 2 has not begun:
    // Book 1's later chapters may simply not be written yet.
    assert.equal(unended('By Book 1 she has left', '2026-10-15'), true);
    assert.equal(unended('By Book 1 she has left', '2026-11-02'), false);
  });

  test('a book with no records is the future', () => {
    assert.equal(unended('the third book', '2027-01-01'), true);
  });
});

describe('context withholds codex text past the horizon', () => {
  const codex = `---
id: char.emma
---
# Emma

## Overview

She runs the bar.

After Chapter Two she leaves.

In Chapter One she opened.

## Plans

Shown plan.

### After Chapter 2

Secret plan.

#### Details

More secret.

### Chapters 1, 2 and 3

Unplaceable plan.
`;
  const files = {
    'codex/entities.yaml': `characters:
  - { id: char.emma, type: character, displayName: Emma, sourceFile: codex/characters/emma.md }
places:
  - { id: place.bar, type: place, displayName: The Bar }
`,
    'codex/characters/emma.md': codex,
    'stories/01_book/chapters/02_two.md': chapter({ num: 2, date: '2026-10-10' }),
  };

  function bundleAsOf(asOf: string): ContextBundle {
    const root = makeUniverse(files);
    try {
      appendConfig(root, 'context:\n  codex:\n    include: [Overview, Plans]\n');
      const { status, output } = run(root, 'context', 'Emma', '--as-of', asOf, '--json');
      assert.equal(status, 0, output);
      return JSON.parse(output);
    } finally {
      cleanup(root);
    }
  }

  test('before chapter 2 ends', () => {
    const b = bundleAsOf('2026-10-05');
    const text = JSON.stringify(b.long.sections);
    assert.deepEqual(
      b.long.sections.map((s) => s.heading),
      ['Overview', 'Plans'],
      'headings naming an unended chapter are not shown, nor their subsections'
    );
    assert.match(text, /She runs the bar\./);
    assert.match(text, /In Chapter One she opened\./);
    assert.doesNotMatch(text, /leaves/, 'a spelled-out chapter reference is withheld');
    assert.doesNotMatch(text, /Secret plan|More secret|Unplaceable/);
    // One paragraph, and two sections counted once each (not their subsections).
    assert.equal(b.long.withheld, 3);
  });

  test('after chapter 2 ends', () => {
    const b = bundleAsOf('2026-10-15');
    const text = JSON.stringify(b.long.sections);
    assert.deepEqual(
      b.long.sections.map((s) => s.heading),
      ['Overview', 'Plans', 'After Chapter 2', 'Details']
    );
    assert.match(text, /After Chapter Two she leaves\./);
    assert.match(text, /Secret plan\./);
    // Chapter 3 has no record, so its section stays withheld.
    assert.doesNotMatch(text, /Unplaceable/);
    assert.equal(b.long.withheld, 1);
  });
});
