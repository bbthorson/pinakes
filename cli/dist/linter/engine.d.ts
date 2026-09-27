import { Registry } from '../registry/entities.js';
import { Config } from '../config.js';
export interface Diagnostic {
    file: string;
    line?: number;
    rule: string;
    severity: 'error' | 'warning';
    message: string;
}
/**
 * One hand-off recorded in a chapter's `custody:` block. Names are as the
 * author typed them; the compiler resolves them against the registry.
 */
export interface CustodyEntry {
    item: string;
    holder: string;
    /** Previous holder. Absent when the item enters the story here. */
    from?: string;
    /** One-line description of the hand-off. */
    event?: string;
}
export interface ChapterData {
    filePath: string;
    relativeFilePath: string;
    frontmatter: any;
    frontmatterText: string;
    chapterNum: string | number;
    title: string;
    dates: string[];
    locationNames: string[];
    charactersPresent: string[];
    charactersReferenced: string[];
    pov: string | null;
    registers: Record<string, string>;
    custody: CustodyEntry[];
    beatPurpose: string | null;
    /**
     * The chapter's prose, everything after the closing frontmatter fence. The
     * linter reads frontmatter, not prose, by design; `prose-check` is the one
     * consumer that needs the body, and loading it here keeps a single chapter
     * loader rather than a second one that could drift from this.
     */
    body: string;
}
export interface PostSource {
    filePath: string;
    relativeFilePath: string;
    frontmatter: any;
    body: string;
}
export interface StretchSource extends PostSource {
    /** The character folder the file sits in, or `''` for a file at the root. */
    folder: string;
    fileName: string;
}
export declare class LinterEngine {
    private config;
    private registry;
    private projectRoot;
    constructor(projectRoot: string, config: Config, registry: Registry);
    parseFrontmatter(content: string): {
        data: any;
        text: string;
        lineOffset: number;
        body: string;
    };
    /** Chapter files in a story, in filename order; `_` and `00_` files are templates. */
    private chapterFiles;
    loadChapters(storyDir: string): ChapterData[];
    /**
     * Splits a source file into its frontmatter block and everything after it.
     * `parseFrontmatter` hands back the YAML but not the prose, and a post's
     * prose *is* the record's payload.
     */
    private splitBody;
    /**
     * Posts live in `posts/` beside a story's `chapters/`, one file per post:
     * frontmatter carries the anchors, the body is the text the character said.
     *
     * Read in filename order, which is the order the compiler assigns sequence
     * numbers in, so ids stay stable across recompiles. `00_`-prefixed files are
     * templates, matching the convention the rest of the tree uses.
     */
    loadPosts(storyDir: string): PostSource[];
    /**
     * Stretches live in `stretches/<character-slug>/<asOf>.md` beside a story's
     * `chapters/`. Unlike posts they are nested one level, because a character's
     * stretches form a chain and read best together.
     *
     * A stray `.md` at the root (other than a `00_` file) is still loaded, with an
     * empty `folder`, so the filename lint can say where it belongs instead of
     * the file being silently ignored.
     */
    loadStretches(storyDir: string): StretchSource[];
    /**
     * Chapter files that `loadChapters` cannot load. Skipping them silently would
     * drop a chapter from every check and let `lint` pass on a typo in its YAML.
     */
    private frontmatterDiagnostics;
    getStories(): string[];
    /**
     * Registry entries that make resolution a guess: one alias claimed by two
     * entities of the same type, or one id registered twice. Also entries that
     * failed validation and were dropped. Shared by `lint` and `compile`, since
     * either would otherwise pick an entity, or lose one, silently.
     */
    registryDiagnostics(): Diagnostic[];
    /**
     * Character DIDs, which live on registry entries beside the id they belong
     * to. Three ways a profile could go out under the wrong identity, so, like
     * the registry checks, both `lint` and `compile` report them:
     *
     * - `invalid-did`: a DID atproto would reject, or a DID on something other
     *   than a character (places and items have no accounts).
     * - `duplicate-did`: one DID on two characters. Every character is checked,
     *   not only active ones: a retired character still owns its DID.
     * - `did-in-codex`: a `did` left in a character's codex frontmatter, where it
     *   lived before 0.9.0. It is an error rather than a fallback, so a universe
     *   has one place its DIDs come from, not two that can disagree.
     */
    identityDiagnostics(): Diagnostic[];
    lint(): Diagnostic[];
    private checkEntity;
}
