/**
 * Finding the chapters and books a piece of codex text points at, so the
 * as-of bundle can withhold text that names the future.
 *
 * This has to fail closed. Every form the parser misses is a sentence that
 * reaches a drafter unchecked, so it reads the ways authors actually write a
 * chapter — `Chapter 15`, `Chapter Fifteen`, `Chapter XV`, `the fifteenth
 * chapter`, `Chapters 14, 15 and 16`, `Chapter 4 of Book 2` — and treats a
 * reference it can recognise but not place (`the final chapter`, a bare
 * `Book 3`) as the future.
 */

/**
 * A chapter or book a piece of text names.
 *
 * - `{ book, chapter }`: one chapter of one book.
 * - `{ chapter }`: a chapter number with no book; numbers repeat across books.
 * - `{ book }`: a whole book.
 * - `{}`: a chapter that cannot be placed, such as "the final chapter".
 */
export interface ChapterRef {
  book?: number;
  chapter?: number;
}

const UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const IRREGULAR_ORDINALS: Record<string, string> = {
  one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth',
};
const ordinalOf = (word: string) =>
  IRREGULAR_ORDINALS[word] ?? (word.endsWith('y') ? `${word.slice(0, -1)}ieth` : `${word}th`);

/** Every number word (cardinal and ordinal) that can stand alone or end a compound, to its value. */
const UNIT_VALUES = new Map<string, number>();
/** Tens words, cardinal and ordinal, to their value. */
const TENS_VALUES = new Map<string, number>();
UNITS.forEach((w, n) => {
  if (n === 0) return;
  UNIT_VALUES.set(w, n);
  UNIT_VALUES.set(ordinalOf(w), n);
});
TENS.forEach((w, i) => {
  if (!w) return;
  TENS_VALUES.set(w, i * 10);
  TENS_VALUES.set(ordinalOf(w), i * 10);
});

/** Longest first, so `seventeen` is tried before `seven`. */
const alternation = (words: Iterable<string>) => [...words].sort((a, b) => b.length - a.length).join('|');

const UNIT_WORD = alternation(UNIT_VALUES.keys());
const TENS_WORD = alternation(TENS_VALUES.keys());
/** `fifteen`, `twenty-one`, `twenty first`, `thirtieth`. */
const NUMBER_WORD = `(?:(?:${TENS_WORD})(?:[\\s-]+(?:${UNIT_WORD}))?|${UNIT_WORD})`;
const ORDINAL_WORD = alternation([...UNIT_VALUES.keys(), ...TENS_VALUES.keys()].filter((w) => !UNITS.includes(w) && !TENS.includes(w)));
const ROMAN = '[ivxlc]+';
/** One number, however it is written. Must not run on into a longer word. */
const NUM = `(?:\\d+(?:st|nd|rd|th)?|${NUMBER_WORD}|${ROMAN})(?![\\p{L}\\d])`;
/** `14`, `14-16`, `14 to 16`, `14, 15 and 16`, `fourteen through sixteen`. */
const SEP = `\\s*(?:,\\s*(?:and|or|&)?|[-–—]|to|through|thru|and|or|&)\\s*`;
const LIST = `${NUM}(?:${SEP}${NUM})*`;
const CHAPTER = `(?:chapters?|chs?\\.?)`;
const BOOK = `books?`;
/** `15th`, `fifteenth`, `twenty-first`: an ordinal written before its noun. */
const ORDINAL = `(?:\\d+(?:st|nd|rd|th)|(?:${TENS_WORD})[\\s-]+(?:${ORDINAL_WORD})|${ORDINAL_WORD})`;

const re = (source: string) => new RegExp(source, 'giu');

/** `book1#ch15`, the form record ids use. */
const HASH = re(String.raw`\bbook\s*(\d+)\s*#\s*ch(?:apter)?\s*(\d+)`);
/** `Book 1, Chapter 15`, `Book Two: Chapters 3-5`. */
const BOOK_THEN_CHAPTER = re(`\\b${BOOK}\\s*(${NUM})\\s*[,:]?\\s*${CHAPTER}\\s*(${LIST})`);
/** `Chapter 4 of Book 2`, `Chapters 3 and 4 in Book Two`. */
const CHAPTER_OF_BOOK = re(`\\b(${CHAPTER})\\s*(${LIST})\\s+(?:of|in)\\s+(?:the\\s+)?${BOOK}\\s*(${NUM})`);
/** `the fifteenth chapter of Book 2`. */
const ORDINAL_CHAPTER_OF_BOOK = re(`\\b(${ORDINAL})\\s+chapter\\s+(?:of|in)\\s+(?:the\\s+)?${BOOK}\\s*(${NUM})`);
/** `Chapter 15`, `Ch. XV`, `Chapters fourteen to sixteen`. */
const BARE_CHAPTER = re(`\\b(${CHAPTER})\\s*(${LIST})`);
/** `the fifteenth chapter`, `the 15th chapter`. */
const ORDINAL_CHAPTER = re(`\\b(${ORDINAL})\\s+chapters?\\b`);
/** A chapter named by position rather than number. It cannot be placed, so it is the future. */
const UNPLACED_CHAPTER = re(String.raw`\b(?:final|last|closing|penultimate|next)\s+chapters?\b`);
/** `the second book`. */
const ORDINAL_BOOK = re(`\\b(${ORDINAL})\\s+book\\b`);
/** `Book 3`, `Books 2 and 3`, with no chapter. */
const BARE_BOOK = re(`\\b(${BOOK})\\s*(${LIST})`);

function parseRoman(token: string): number | undefined {
  const values: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  const s = token.toLowerCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = values[s[i]];
    const next = values[s[i + 1]] ?? 0;
    n += v < next ? -v : v;
  }
  // Only canonical numerals: `IIII` or `IC` is a word, not a number.
  return n > 0 && toRoman(n) === s ? n : undefined;
}

function toRoman(n: number): string {
  const table: [number, string][] = [
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

/**
 * The value of one number token. `keyword` is the word before it: a lone `I`
 * is a number only straight after a capitalised `Chapter` or `Book`, since
 * "the chapter I wrote" is a pronoun.
 */
function parseNumber(token: string, keyword = ''): number | undefined {
  const t = token.trim();
  const digits = t.match(/^(\d+)(?:st|nd|rd|th)?$/i);
  if (digits) return parseInt(digits[1], 10);

  const parts = t.toLowerCase().split(/[\s-]+/);
  if (parts.length === 1 && UNIT_VALUES.has(parts[0])) return UNIT_VALUES.get(parts[0]);
  if (parts.length === 1 && TENS_VALUES.has(parts[0])) return TENS_VALUES.get(parts[0]);
  if (parts.length === 2 && TENS_VALUES.has(parts[0]) && (UNIT_VALUES.get(parts[1]) ?? 10) < 10) {
    return TENS_VALUES.get(parts[0])! + UNIT_VALUES.get(parts[1])!;
  }

  if (/^[ivxlc]+$/i.test(t)) {
    if (t.length === 1 && t !== 'I' && t !== 'V' && t !== 'X') return undefined;
    if (t === 'I' && !/^[A-Z]/.test(keyword)) return undefined;
    return parseRoman(t);
  }
  return undefined;
}

/**
 * Every number in a list or range. A range expands to each chapter in it; one
 * longer than `MAX_RANGE` is not expanded (a typo like `1-9000` must not hang
 * the cut) and reads as an unknown chapter instead. An unparseable token ends
 * the list: `chapter 14 and the next` is chapter 14.
 */
const MAX_RANGE = 200;
/** A chapter number no record carries, so every horizon check treats it as unended. */
const UNKNOWN_CHAPTER = -1;

const NUM_AT = new RegExp(NUM, 'iuy');
const SEP_AT = new RegExp(SEP, 'iuy');
const RANGE_SEP = /^\s*(?:[-–—]|to|through|thru)\s*$/i;

function parseList(list: string, keyword = ''): number[] {
  const out: number[] = [];
  let rangeFrom: number | undefined;
  let pos = 0;
  // Read number, separator, number, ... with sticky regexes. Splitting on the
  // separator instead would cut `twenty-one` at its hyphen into a range.
  for (let first = true; ; first = false) {
    NUM_AT.lastIndex = pos;
    const num = NUM_AT.exec(list);
    if (!num) break;
    // Only the token straight after the keyword may be a lone `I`.
    const n = parseNumber(num[0], first ? keyword : '');
    if (n === undefined) break;
    pos = NUM_AT.lastIndex;

    if (rangeFrom !== undefined) {
      const [lo, hi] = rangeFrom <= n ? [rangeFrom, n] : [n, rangeFrom];
      // A range too long to expand is most likely a typo, but it cannot be
      // checked, so it becomes a chapter no book has: the future.
      if (hi - lo > MAX_RANGE) out.push(UNKNOWN_CHAPTER);
      else for (let k = lo; k <= hi; k++) if (!out.includes(k)) out.push(k);
      rangeFrom = undefined;
    } else if (!out.includes(n)) {
      out.push(n);
    }

    SEP_AT.lastIndex = pos;
    const sep = SEP_AT.exec(list);
    if (!sep) break;
    pos = SEP_AT.lastIndex;
    if (RANGE_SEP.test(sep[0])) rangeFrom = n;
  }
  return out;
}

/** Every chapter or book a piece of codex text names. */
export function chapterRefs(text: string): ChapterRef[] {
  const refs: ChapterRef[] = [];
  let rest = text;
  // Each form is removed once matched, so `Book 1, Chapter 15` is not read a
  // second time as a bare `Chapter 15` and a bare `Book 1`.
  const take = (pattern: RegExp, handle: (m: string[]) => void) => {
    rest = rest.replace(pattern, (...m: string[]) => {
      handle(m);
      return ' ';
    });
  };

  take(HASH, (m) => refs.push({ book: parseInt(m[1], 10), chapter: parseInt(m[2], 10) }));
  take(BOOK_THEN_CHAPTER, (m) => {
    // Both words are present, so a lone `I` here is a numeral either way.
    const book = parseNumber(m[1], 'Book');
    for (const chapter of parseList(m[2], 'Chapter')) refs.push(book === undefined ? { chapter } : { book, chapter });
  });
  take(CHAPTER_OF_BOOK, (m) => {
    const book = parseNumber(m[3], 'Book');
    for (const chapter of parseList(m[2], m[1])) refs.push(book === undefined ? { chapter } : { book, chapter });
  });
  take(ORDINAL_CHAPTER_OF_BOOK, (m) => {
    const chapter = parseNumber(m[1]);
    const book = parseNumber(m[2]);
    refs.push(chapter === undefined ? {} : book === undefined ? { chapter } : { book, chapter });
  });
  take(BARE_CHAPTER, (m) => {
    for (const chapter of parseList(m[2], m[1])) refs.push({ chapter });
  });
  take(ORDINAL_CHAPTER, (m) => {
    const chapter = parseNumber(m[1]);
    refs.push(chapter === undefined ? {} : { chapter });
  });
  take(UNPLACED_CHAPTER, () => refs.push({}));
  take(ORDINAL_BOOK, (m) => {
    const book = parseNumber(m[1]);
    if (book !== undefined) refs.push({ book });
  });
  take(BARE_BOOK, (m) => {
    for (const book of parseList(m[2], m[1])) refs.push({ book });
  });
  return refs;
}

/**
 * Whether text names a chapter or book that has not ended by `asOf`.
 *
 * A reference counts as past only when it provably is:
 * - an explicit book and chapter must have ended by `asOf`;
 * - a bare chapter number must have ended in every book that has one, because
 *   chapter numbers repeat across books;
 * - a whole book must have every compiled chapter ended, and a later book must
 *   already be under way — otherwise its remaining chapters may simply not be
 *   written yet;
 * - a chapter the records do not know, or one named only by position, is the
 *   future.
 *
 * `chapterEnds` maps `bookN` to chapter number to end date, from scene records.
 */
export function namesUnendedChapter(text: string, asOf: string, chapterEnds: Map<string, Map<number, string>>): boolean {
  const bookNumber = (key: string) => {
    const m = key.match(/^book(\d+)$/);
    return m ? parseInt(m[1], 10) : undefined;
  };

  for (const ref of chapterRefs(text)) {
    if (ref.book !== undefined && ref.chapter !== undefined) {
      const end = chapterEnds.get(`book${ref.book}`)?.get(ref.chapter);
      if (!end || end > asOf) return true;
    } else if (ref.chapter !== undefined) {
      const ends = [...chapterEnds.values()].map((m) => m.get(ref.chapter!)).filter((e): e is string => Boolean(e));
      if (ends.length === 0 || ends.some((e) => e > asOf)) return true;
    } else if (ref.book !== undefined) {
      const ends = [...(chapterEnds.get(`book${ref.book}`)?.values() ?? [])];
      if (ends.length === 0 || ends.some((e) => e > asOf)) return true;
      const laterStarted = [...chapterEnds.entries()].some(
        ([key, chapters]) => (bookNumber(key) ?? 0) > ref.book! && [...chapters.values()].some((e) => e <= asOf)
      );
      if (!laterStarted) return true;
    } else {
      return true;
    }
  }
  return false;
}
