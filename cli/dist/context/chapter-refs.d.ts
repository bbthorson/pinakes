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
/** Every chapter or book a piece of codex text names. */
export declare function chapterRefs(text: string): ChapterRef[];
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
export declare function namesUnendedChapter(text: string, asOf: string, chapterEnds: Map<string, Map<number, string>>): boolean;
