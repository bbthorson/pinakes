/**
 * First-Appearance Entity Ledger: a deterministic index of when each registered
 * character, place, and item first appears in frontmatter (`present`,
 * `referenced`) and is first named on-page in chapter prose.
 *
 * Used by the `backward-mid` review lens to verify fair-play provenance (for
 * example, whether a POV character could already know a neighbor's name as of
 * chapter N - 1).
 */
import path from 'path';
import type { Registry, Entity } from '../registry/entities.js';
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

export function getBookKeyFromDir(storyDir: string): string {
  const base = path.basename(storyDir);
  const m = base.match(/^0*(\d+)/);
  if (m) return `book${parseInt(m[1], 10)}`;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function bookOrder(bookKey: string): [number, string] {
  const m = bookKey.match(/^book(\d+)$/);
  return m ? [parseInt(m[1], 10), bookKey] : [Number.MAX_SAFE_INTEGER, bookKey];
}

function chapterOrder(ch: number | string): [number, string] {
  const n = typeof ch === 'number' ? ch : Number(ch);
  return Number.isFinite(n) ? [n, String(ch)] : [Number.MAX_SAFE_INTEGER, String(ch)];
}

export function compareBookChapter(
  a: { book: string; chapter: number | string },
  b: { book: string; chapter: number | string }
): number {
  const [ab, as] = bookOrder(a.book);
  const [bb, bs] = bookOrder(b.book);
  if (ab !== bb) return ab - bb;
  if (as !== bs) return as.localeCompare(bs);
  const [ac, acs] = chapterOrder(a.chapter);
  const [bc, bcs] = chapterOrder(b.chapter);
  if (ac !== bc) return ac - bc;
  return acs.localeCompare(bcs);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSurfaceMatchers(entity: Entity): { form: string; regex: RegExp }[] {
  const forms = new Set<string>([entity.displayName, ...entity.aliases]);
  const sorted = [...forms]
    .map((f) => f.trim())
    .filter((f) => f.length >= 2)
    .sort((a, b) => b.length - a.length);

  return sorted.map((form) => ({
    form,
    // Unicode-aware word boundaries so accented names and possessives match cleanly.
    regex: new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(form)}(?![\\p{L}\\p{N}_])`, 'iu'),
  }));
}

export interface BookChapters {
  book: string;
  chapters: ChapterData[];
}

export function buildFirstAppearanceLedger(
  registry: Registry,
  books: BookChapters[]
): EntityFirstAppearance[] {
  // Flatten and sort all chapters deterministically by (book, chapter).
  const ordered: { book: string; ch: ChapterData }[] = [];
  for (const b of books) {
    for (const ch of b.chapters) {
      ordered.push({ book: b.book, ch });
    }
  }
  ordered.sort((a, b) =>
    compareBookChapter(
      { book: a.book, chapter: a.ch.chapterNum },
      { book: b.book, chapter: b.ch.chapterNum }
    )
  );

  const entries = new Map<string, EntityFirstAppearance>();
  const matchers = new Map<string, { form: string; regex: RegExp }[]>();

  for (const ent of registry.allEntities) {
    if (entries.has(ent.id)) continue;
    entries.set(ent.id, {
      id: ent.id,
      type: ent.type,
      displayName: ent.displayName,
    });
    matchers.set(ent.id, buildSurfaceMatchers(ent));
  }

  for (const { book, ch } of ordered) {
    const storyDate = ch.dates[0] ?? '';
    const sceneId = `scene.${book}.ch${ch.chapterNum}`;
    const basePoint: EntityAppearancePoint = {
      book,
      chapter: ch.chapterNum,
      storyDate,
      sceneId,
    };

    // 1. Frontmatter presence
    const presentIds = new Set<string>();
    for (const c of ch.charactersPresent) {
      const hit = registry.resolve(c, 'character');
      if (hit) presentIds.add(hit.id);
    }
    if (ch.pov) {
      const hit = registry.resolve(ch.pov, 'character');
      if (hit) presentIds.add(hit.id);
    }
    for (const loc of ch.locationNames) {
      const hit = registry.resolve(loc, 'place');
      if (hit) presentIds.add(hit.id);
    }
    for (const cust of ch.custody) {
      const itemHit = registry.resolve(cust.item, 'item');
      if (itemHit) presentIds.add(itemHit.id);
      const holderHit = registry.resolve(cust.holder, 'character');
      if (holderHit) presentIds.add(holderHit.id);
    }

    for (const id of presentIds) {
      const e = entries.get(id);
      if (e && !e.firstPresent) e.firstPresent = { ...basePoint };
    }

    // 2. Frontmatter referenced
    for (const c of ch.charactersReferenced) {
      const hit = registry.resolve(c, 'character');
      if (!hit) continue;
      const e = entries.get(hit.id);
      if (e && !e.firstReferenced) e.firstReferenced = { ...basePoint };
    }

    // 3. On-page prose scan for entities not yet named on-page
    if (ch.body) {
      for (const [id, entry] of entries) {
        if (entry.firstNamedOnPage) continue;
        const ms = matchers.get(id) ?? [];
        for (const m of ms) {
          if (m.regex.test(ch.body)) {
            entry.firstNamedOnPage = { ...basePoint, matchedForm: m.form };
            break;
          }
        }
      }
    }
  }

  return [...entries.values()].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}

export function buildFirstAppearanceLedgerFromEngine(
  registry: Registry,
  engine: LinterEngine
): EntityFirstAppearance[] {
  const books: BookChapters[] = engine.getStories().map((storyDir) => ({
    book: getBookKeyFromDir(storyDir),
    chapters: engine.loadChapters(storyDir),
  }));
  return buildFirstAppearanceLedger(registry, books);
}

/**
 * Filters a compiled ledger to only appearances strictly BEFORE `(book, chapter)`.
 * An entity whose first appearance is in `target` or a later chapter is omitted
 * from the returned prior-knowledge view (or has that point cleared).
 */
export function filterLedgerBeforeChapter(
  ledger: EntityFirstAppearance[],
  book: string,
  chapter: number | string
): EntityFirstAppearance[] {
  const cutoff = { book, chapter };
  const isBefore = (pt?: EntityAppearancePoint) => (pt ? compareBookChapter(pt, cutoff) < 0 : false);

  const out: EntityFirstAppearance[] = [];
  for (const e of ledger) {
    const firstPresent = isBefore(e.firstPresent) ? e.firstPresent : undefined;
    const firstReferenced = isBefore(e.firstReferenced) ? e.firstReferenced : undefined;
    const firstNamedOnPage = isBefore(e.firstNamedOnPage) ? e.firstNamedOnPage : undefined;
    if (firstPresent || firstReferenced || firstNamedOnPage) {
      out.push({
        id: e.id,
        type: e.type,
        displayName: e.displayName,
        ...(firstPresent ? { firstPresent } : {}),
        ...(firstReferenced ? { firstReferenced } : {}),
        ...(firstNamedOnPage ? { firstNamedOnPage } : {}),
      });
    }
  }
  return out;
}

export function renderFirstAppearancesMarkdown(ledger: EntityFirstAppearance[]): string {
  if (ledger.length === 0) return '_No entities named or present before this chapter._\n';
  const lines = [
    '| Entity | Type | First Present | First Referenced | First Named On-Page |',
    '| --- | --- | --- | --- | --- |',
  ];
  const fmt = (pt?: EntityAppearancePoint) =>
    pt ? `${pt.book}#ch${pt.chapter} (${pt.storyDate || 'undated'})${pt.matchedForm ? ` as "${pt.matchedForm}"` : ''}` : '—';
  for (const e of ledger) {
    lines.push(
      `| ${e.displayName} (\`${e.id}\`) | ${e.type} | ${fmt(e.firstPresent)} | ${fmt(e.firstReferenced)} | ${fmt(e.firstNamedOnPage)} |`
    );
  }
  return lines.join('\n') + '\n';
}
