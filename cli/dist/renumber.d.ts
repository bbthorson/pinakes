import type { LinterEngine } from './linter/engine.js';
export interface RenumberOptions {
    story: string;
    from: number;
    delta: number;
    dryRun?: boolean;
}
export interface RenumberFileChange {
    oldFile: string;
    newFile: string;
    oldChapter: number;
    newChapter: number;
    headingsUpdated: number;
}
export interface StaleChapterReference {
    file: string;
    line: number;
    match: string;
    chapterNum: number;
    suggestedNum: number;
    snippet: string;
}
export interface RenumberResult {
    storyDir: string;
    from: number;
    delta: number;
    dryRun: boolean;
    changes: RenumberFileChange[];
    staleReferences: StaleChapterReference[];
}
/** Converts an integer in [1, 199] to Title-Case English words (e.g. 21 -> "Twenty-One"). */
export declare function numberToChapterWord(n: number): string | null;
export declare function chapterWordToNumber(word: string): number | null;
/**
 * Shifts the numeric chapter token in a filename while preserving prefix,
 * suffix, and zero-padding width:
 *   `05.md` -> `06.md`
 *   `05_the_dinner.md` -> `06_the_dinner.md`
 *   `ch05_dinner.md` -> `ch06_dinner.md`
 */
export declare function shiftChapterFilename(fileName: string, oldNum: number, newNum: number): string;
/**
 * Updates `chapter:` inside the YAML frontmatter block and any `#`/`###`
 * `Chapter <Word>` or `Chapter <Num>` headings in the prose body whose number
 * matches `oldNum`.
 */
export declare function rewriteChapterContent(content: string, oldNum: number, newNum: number): {
    content: string;
    headingsUpdated: number;
};
export declare function scanStaleChapterReferences(projectRoot: string, storyDir: string, from: number, delta: number): StaleChapterReference[];
export declare function renumberChapters(projectRoot: string, engine: LinterEngine, options: RenumberOptions): RenumberResult;
