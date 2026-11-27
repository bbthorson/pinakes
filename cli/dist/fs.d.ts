export interface UniverseFS {
    exists(filePath: string): boolean;
    readFile(filePath: string): string;
    readdir(dirPath: string): string[];
    isDirectory(filePath: string): boolean;
    isFile(filePath: string): boolean;
}
/** Default Node.js filesystem adapter. */
export declare const nodeFS: UniverseFS;
/**
 * In-memory read-only filesystem hydrated from a `{ relativePath: content }` map
 * (for example, a GitHub repo snapshot cached in Cloudflare R2).
 */
export declare class MemoryFS implements UniverseFS {
    readonly root: string;
    private readonly files;
    private readonly dirs;
    constructor(entries: Record<string, string>, root?: string);
    private resolveKey;
    exists(filePath: string): boolean;
    readFile(filePath: string): string;
    readdir(dirPath: string): string[];
    isDirectory(filePath: string): boolean;
    isFile(filePath: string): boolean;
}
