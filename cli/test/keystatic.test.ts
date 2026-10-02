/**
 * The Keystatic collections must name exactly the frontmatter keys Pinakes
 * reads, in shapes that round-trip.
 *
 * Keystatic will not open an entry whose file has a key the schema does not
 * name, and writes only the schema's keys on save. The first schemas missed
 * `registers`, `affect`, `author`, a place's `id`, and named `did`/`handle`
 * for codex files, so no Supper Club Secrets chapter, post, character or place
 * opened, and entries created in the CMS came out malformed.
 *
 * `fields` here is a stand-in that records each definition, so the test needs
 * no Keystatic install. The real round trip (Keystatic's own parse and
 * serialize over every Supper Club file, then `compile`) was checked when the
 * schemas were written; this pins what that check depended on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPinakesCollections } from '@bbthorson/pinakes/keystatic';

type Def = { kind: string; element?: Def; fields?: Record<string, Def> };
const leaf = (kind: string) => (): Def => ({ kind });
const fields = {
  text: leaf('text'),
  integer: leaf('integer'),
  number: leaf('number'),
  select: leaf('select'),
  slug: leaf('slug'),
  markdoc: leaf('markdoc'),
  ignored: leaf('ignored'),
  array: (element: Def): Def => ({ kind: 'array', element }),
  object: (f: Record<string, Def>): Def => ({ kind: 'object', fields: f }),
};

const collections = (options: Record<string, unknown> = {}) =>
  createPinakesCollections(fields, { storyDir: 'stories/one', codexDir: 'codex', ...options }) as Record<
    string,
    { slugField: string; path: string; schema: Record<string, Def> }
  >;

/**
 * Every key Pinakes reads from each kind of file, and the field kind it needs.
 * `ignored` is for values Keystatic cannot model without reshaping: maps keyed
 * by character name, label-or-numbers unions, objects.
 */
const READS: Record<string, Record<string, string>> = {
  chapters: {
    title: 'slug', chapter: 'integer', sequence: 'integer', part: 'integer', date: 'text', publishDate: 'text',
    location: 'array', pov: 'text', characters_present: 'array', characters_referenced: 'array',
    registers: 'ignored', affect: 'ignored', custody: 'array', beat: 'text', beat_purpose: 'text', tags: 'array',
  },
  posts: {
    date: 'slug', author: 'text', chapter: 'integer', time: 'text', publish: 'text', reply_to: 'text',
    mentions: 'array', location: 'text', tags: 'array', note: 'text',
  },
  stretches: {
    asOf: 'slug', character: 'text', since: 'text', register: 'text', status: 'select', carrying: 'array',
    sources: 'array', affect: 'ignored', note: 'text',
  },
  characters: { title: 'slug', description: 'text', status: 'text', tags: 'array', affectBaseline: 'ignored', affectHalfLifeScale: 'number' },
  places: {
    title: 'slug', id: 'text', description: 'text', status: 'text', region: 'text', neighborhood: 'text',
    first_appearance: 'text', tags: 'array', schedule: 'ignored',
  },
  items: { title: 'slug', description: 'text', tags: 'array' },
};

test('each collection names exactly the keys Pinakes reads, in round-trippable shapes', () => {
  const cols = collections();
  assert.deepEqual(Object.keys(cols).sort(), Object.keys(READS).sort());
  for (const [name, reads] of Object.entries(READS)) {
    const { content, ...schema } = cols[name].schema;
    assert.equal(content.kind, 'markdoc', `${name}: body`);
    const kinds = Object.fromEntries(Object.entries(schema).map(([k, d]) => [k, d.kind]));
    assert.deepEqual(kinds, reads, name);
  }
});

test('custody entries are the { item, holder, from, event } objects the loader reads', () => {
  const custody = collections().chapters.schema.custody;
  assert.equal(custody.element?.kind, 'object');
  assert.deepEqual(Object.keys(custody.element?.fields ?? {}), ['item', 'holder', 'from', 'event']);
});

test('the slug field is a key the file already has, so a save adds no stray key', () => {
  for (const [name, col] of Object.entries(collections())) {
    assert.ok(col.slugField in READS[name], `${name}: slugField '${col.slugField}'`);
    assert.equal(col.schema[col.slugField].kind, 'slug', name);
  }
});

test('codex schemas carry no identity: did and handle live on the registry entry', () => {
  for (const name of ['characters', 'places', 'items']) {
    const schema = collections()[name].schema;
    assert.ok(!('did' in schema) && !('handle' in schema), name);
  }
});

test('stretches are nested one folder deep', () => {
  assert.equal(collections().stretches.path, 'stories/one/stretches/**');
});

test('the sequence key follows the universe', () => {
  const schema = collections({ sequenceField: 'meal' }).chapters.schema;
  assert.equal(schema.meal.kind, 'integer');
  assert.ok(!('sequence' in schema));
});

test('extraFields add a universe’s own keys, and may not redefine one Pinakes reads', () => {
  const cols = collections({ extraFields: { chapters: { clues: fields.ignored() } } });
  assert.equal(cols.chapters.schema.clues.kind, 'ignored');
  assert.equal(Object.keys(cols.chapters.schema).at(-1), 'content', 'the body editor stays last');
  assert.throws(
    () => collections({ extraFields: { chapters: { registers: fields.text() } } }),
    /Pinakes already defines 'registers'/
  );
});

test('every frontmatter key in the starter template is named by its config', () => {
  const root = fileURLToPath(new URL('../../template/', import.meta.url));
  const config = fs.readFileSync(path.join(root, 'site/keystatic.config.ts'), 'utf-8');
  // The template configs declare the template's own extra keys; read them back.
  const extras: Record<string, string[]> = {};
  for (const m of config.matchAll(/(\w+): \{ ([^}]*fields\.ignored\(\)[^}]*) \}/g)) {
    extras[m[1]] = [...m[2].matchAll(/(\w+): fields\.ignored\(\)/g)].map((x) => x[1]);
  }
  const extraFields = Object.fromEntries(
    Object.entries(extras).map(([c, keys]) => [c, Object.fromEntries(keys.map((k) => [k, fields.ignored()]))])
  );
  const cols = collections({ extraFields });
  const dirs: Record<string, string> = { characters: 'codex/characters', places: 'codex/locations', items: 'codex/items' };
  for (const [name, dir] of Object.entries(dirs)) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'index.md')) {
      const fm = fs.readFileSync(path.join(abs, file), 'utf-8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      for (const key of fm.match(/^[A-Za-z_]\w*(?=:)/gm) ?? []) {
        assert.ok(key in cols[name].schema, `${dir}/${file}: '${key}' is not in the ${name} schema`);
      }
    }
  }
});

test('collection paths are globs from the repository root', () => {
  const cols = createPinakesCollections(fields, { storyDir: 'stories/one' });
  assert.equal(cols.characters.path, 'codex/characters/*', 'codexDir defaults to the root-level codex');
  // Type-level: Keystatic's config only takes a glob, so the result must be
  // assignable without a cast.
  const p: `${string}/*` | `${string}/**` = cols.chapters.path;
  assert.equal(p, 'stories/one/chapters/*');
});

test('neither template config reaches above the repository root', () => {
  const root = fileURLToPath(new URL('../../template/', import.meta.url));
  for (const file of ['keystatic.config.ts', 'site/keystatic.config.ts']) {
    const config = fs.readFileSync(path.join(root, file), 'utf-8');
    assert.doesNotMatch(config, /(storyDir|codexDir): '\.\.\//, `${file}: Keystatic cannot read a '../' path`);
  }
});
