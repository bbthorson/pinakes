/** Every record file name `compileProject` writes, in a book or `series/` directory. */
export declare const RECORD_FILES: Set<string>;
/**
 * Deletes stale pinakes files under `outputDir` and returns their paths, or
 * `null` when it declined to prune.
 *
 * `written` holds the absolute paths this compile wrote. Pruning is skipped
 * when the output directory is the project root or contains it: there, a
 * `scenes.json` one level down could be the author's own file.
 */
export declare function pruneStale(projectRoot: string, outputDir: string, written: Set<string>): string[] | null;
