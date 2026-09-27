import { Config } from '../config.js';
import { Registry } from '../registry/entities.js';
import { LinterEngine } from '../linter/engine.js';
export interface CodexSection {
    heading: string;
    level: number;
    text: string;
}
export interface ContextBundle {
    character: {
        id: string;
        displayName: string;
    };
    asOf: string;
    long: {
        frontmatter: Record<string, string>;
        sections: CodexSection[];
        /** Sections and paragraphs removed by configuration. A count, never names. */
        withheld: number;
        configured: boolean;
    };
    mid: {
        latest?: Record<string, any>;
        earlier: string[];
        draftsIgnored: number;
    };
    short: {
        id: string;
        storyDate: string;
        storyDateEnd?: string;
        register: string;
        registerExpr?: string;
        state?: string;
    }[];
    history: {
        posts: {
            id: string;
            author: string;
            storyDate: string;
            storyTime?: string;
            inReplyTo?: string;
            text: string;
        }[];
        scenes: {
            id: string;
            storyDate: string;
            storyDateEnd?: string;
            title: string;
        }[];
    };
    fullState: boolean;
}
export interface BuildResult {
    bundle?: ContextBundle;
    errors: string[];
}
export { chapterRefs, namesUnendedChapter, type ChapterRef } from './chapter-refs.js';
/**
 * Cuts a codex body to the allowed headings.
 *
 * The level-1 title is never shown (the bundle names the character itself).
 * Content before the first heading is not under any included heading, so it is
 * not shown either. `withholdParagraph` is applied to headings as well as
 * paragraphs: a heading like "After Chapter 20" withholds its whole section,
 * subsections included, because the heading says what the section is about.
 */
export declare function cutCodex(body: string, include: string[], exclude: string[], excludeParagraphs: string[], 
/** Extra paragraph test; `true` withholds. Used for the chapter horizon. */
withholdParagraph?: (text: string) => boolean): {
    sections: CodexSection[];
    withheld: number;
    unmatchedExcludes: string[];
};
export declare function buildContext(root: string, config: Config, registry: Registry, engine: LinterEngine, records: any[], characterName: string, asOf: string, options?: {
    fullState?: boolean;
}): BuildResult;
export declare function renderMarkdown(b: ContextBundle): string;
