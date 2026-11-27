import type { Registry } from '../registry/entities.js';
import type { ChapterData, LinterEngine } from '../linter/engine.js';
export interface EntityAppearancePoint {
    book: string;
    chapter: number | string;
    storyDate: string;
    sceneId: string;
    matchedForm?: string;
}
export interface EntityFirstAppearance {
    id: string;
    type: string;
    displayName: string;
    firstPresent?: EntityAppearancePoint;
    firstReferenced?: EntityAppearancePoint;
    firstNamedOnPage?: EntityAppearancePoint;
}
export declare function getBookKeyFromDir(storyDir: string): string;
export declare function compareBookChapter(a: {
    book: string;
    chapter: number | string;
}, b: {
    book: string;
    chapter: number | string;
}): number;
export interface BookChapters {
    book: string;
    chapters: ChapterData[];
}
export declare function buildFirstAppearanceLedger(registry: Registry, books: BookChapters[]): EntityFirstAppearance[];
export declare function buildFirstAppearanceLedgerFromEngine(registry: Registry, engine: LinterEngine): EntityFirstAppearance[];
/**
 * Filters a compiled ledger to only appearances strictly BEFORE `(book, chapter)`.
 * An entity whose first appearance is in `target` or a later chapter is omitted
 * from the returned prior-knowledge view (or has that point cleared).
 */
export declare function filterLedgerBeforeChapter(ledger: EntityFirstAppearance[], book: string, chapter: number | string): EntityFirstAppearance[];
export declare function renderFirstAppearancesMarkdown(ledger: EntityFirstAppearance[]): string;
