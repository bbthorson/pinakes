/**
 * Minimal synchronous filesystem abstraction (`UniverseFS`) so Pinakes's
 * deterministic core and probabilistic/review layers run identically on Node.js
 * (`nodeFS`) and in-memory inside Cloudflare Workers (`MemoryFS`).
 */
import fs from 'fs';
import path from 'path';

export interface UniverseFS {
  exists(filePath: string): boolean;
  readFile(filePath: string): string;
  readdir(dirPath: string): string[];
  isDirectory(filePath: string): boolean;
  isFile(filePath: string): boolean;
}

/** Default Node.js filesystem adapter. */
export const nodeFS: UniverseFS = {
  exists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, 'utf-8'),
  readdir: (p) => fs.readdirSync(p),
  isDirectory: (p) => fs.existsSync(p) && fs.statSync(p).isDirectory(),
  isFile: (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
};

function normPosix(p: string): string {
  const s = p.replace(/\\/g, '/').replace(/\/+/g, '/');
  return s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s;
}

/**
 * In-memory read-only filesystem hydrated from a `{ relativePath: content }` map
 * (for example, a GitHub repo snapshot cached in Cloudflare R2).
 */
export class MemoryFS implements UniverseFS {
  public readonly root: string;
  private readonly files = new Map<string, string>();
  private readonly dirs = new Set<string>();

  constructor(entries: Record<string, string>, root = '/universe') {
    this.root = normPosix(path.resolve(root));
    this.dirs.add(this.root);

    for (const [rel, content] of Object.entries(entries)) {
      const cleanRel = rel.replace(/\\/g, '/').replace(/^\/+/, '');
      const full = normPosix(`${this.root}/${cleanRel}`);
      this.files.set(full, content);

      // Register every ancestor directory up to root.
      let cur = path.posix.dirname(full);
      while (cur.startsWith(this.root)) {
        this.dirs.add(cur);
        if (cur === this.root) break;
        const next = path.posix.dirname(cur);
        if (next === cur) break;
        cur = next;
      }
    }
  }

  private resolveKey(p: string): string {
    const posix = p.replace(/\\/g, '/');
    if (posix.startsWith('/')) return normPosix(path.posix.normalize(posix));
    return normPosix(path.posix.normalize(`${this.root}/${posix}`));
  }

  exists(filePath: string): boolean {
    const key = this.resolveKey(filePath);
    return this.files.has(key) || this.dirs.has(key);
  }

  readFile(filePath: string): string {
    const key = this.resolveKey(filePath);
    const val = this.files.get(key);
    if (val === undefined) throw new Error(`ENOENT: no such file in MemoryFS: ${filePath}`);
    return val;
  }

  readdir(dirPath: string): string[] {
    const key = this.resolveKey(dirPath);
    if (!this.dirs.has(key)) throw new Error(`ENOENT: no such directory in MemoryFS: ${dirPath}`);
    const prefix = key === '/' ? '/' : `${key}/`;
    const children = new Set<string>();

    for (const f of this.files.keys()) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      const first = rest.split('/')[0];
      if (first) children.add(first);
    }
    for (const d of this.dirs) {
      if (!d.startsWith(prefix)) continue;
      const rest = d.slice(prefix.length);
      const first = rest.split('/')[0];
      if (first) children.add(first);
    }
    return [...children].sort();
  }

  isDirectory(filePath: string): boolean {
    return this.dirs.has(this.resolveKey(filePath));
  }

  isFile(filePath: string): boolean {
    return this.files.has(this.resolveKey(filePath));
  }
}
