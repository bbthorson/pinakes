import fs from 'fs';
import path from 'path';
import { lintStretches } from '../linter/stretches.js';
import { buildLexiconDocs, compileLexiconDocs, validateRecords, writeLexiconDocs } from '../lexicons/index.js';
import { pruneStale } from './prune.js';
import { parseRegister } from '../linter/registers.js';
import { readAccountField } from '../linter/identity.js';
function getBookKey(storyDir) {
    const base = path.basename(storyDir);
    const m = base.match(/^0*(\d+)/);
    if (m) {
        return `book${parseInt(m[1], 10)}`;
    }
    return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Projects an in-story date onto the RFC3339 datetime the Lexicon `datetime`
 * format requires. Fictional records are ordered by story time, so midnight UTC
 * on the story date is the record's `createdAt` — authoring time is not a
 * property of the narrative and would reorder the stream on every recompile.
 *
 * A malformed date is passed through untouched so Lexicon validation reports it
 * against the record, rather than this silently minting a plausible timestamp.
 */
function storyDateToDatetime(storyDate) {
    return DATE_ONLY.test(storyDate) ? `${storyDate}T00:00:00.000Z` : storyDate;
}
/**
 * Drops absent keys.
 *
 * The AT Protocol data model has no null: an optional field is either present
 * with a value or not present at all. Emitting `"pov": null` produces a record
 * that fails its own schema, so absence is expressed by omission.
 */
function compact(obj) {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined)
            out[key] = value;
    }
    return out;
}
/** Non-empty arrays only — an empty list is absence, not data. */
function present(list) {
    return list.length > 0 ? list : undefined;
}
/**
 * A trimmed scalar, or absence. Frontmatter is hand-written, so a value that
 * should be a string may arrive as a number or a bare word; a blank one is
 * absence, not an empty string.
 */
function text(value) {
    if (value === null || value === undefined || typeof value === 'object')
        return undefined;
    const str = String(value).trim();
    return str ? str : undefined;
}
/**
 * A tag list, however it was written. YAML gives `[main-cast, food]` as a
 * sequence, but authors also type `tags: main-cast, food` on one line.
 */
function tagList(value) {
    let raw;
    if (Array.isArray(value))
        raw = value;
    else if (typeof value === 'string')
        raw = value.split(',');
    else if (value === null || value === undefined)
        raw = [];
    else
        raw = [value];
    const tags = [];
    for (const item of raw) {
        const tag = text(item);
        if (tag && !tags.includes(tag))
            tags.push(tag);
    }
    return present(tags);
}
/**
 * A story date, however YAML handed it over. Quoted dates arrive as strings;
 * an unquoted `2026-10-02` may arrive as a Date under some YAML schemas, and
 * `text()` drops objects, which would turn a valid date into a missing one.
 */
function dateText(value) {
    if (value instanceof Date && !isNaN(value.getTime()))
        return value.toISOString().slice(0, 10);
    return text(value);
}
function getOverviewOneline(content) {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().toLowerCase() === '## overview') {
            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                let text = lines[j].trim();
                text = text.replace(/^\*|\*$/g, '').trim();
                text = text.replace(/^-/, '').trim();
                if (text)
                    return text;
            }
        }
    }
    return undefined;
}
/**
 * Reads the publishable surface of a character's codex file: the frontmatter a
 * reader surface renders from, plus the one-line summary under its Overview
 * heading. The account (`did`, `handle`) comes from the registry entry instead;
 * see `accountValue`.
 */
function readCharacterFile(filePath, engine) {
    if (!filePath || !fs.existsSync(filePath))
        return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = engine.parseFrontmatter(content);
    return {
        oneLine: getOverviewOneline(content),
        description: text(data?.description),
        tags: tagList(data?.tags),
        status: text(data?.status),
    };
}
/**
 * An account field a profile carries, from the registry entry. An invalid one
 * is carried too, as written, so the record shows what `invalid-did` or
 * `invalid-handle` rejected rather than silently losing it.
 */
function accountValue(ent, name) {
    const field = readAccountField(ent, name);
    if (field.kind === 'valid')
        return field.value;
    if (field.kind === 'invalid')
        return typeof field.value === 'string' ? field.value : JSON.stringify(field.value);
    return undefined;
}
/**
 * The kind of place a location file describes, from its body (`**Type:** Bar`).
 * Frontmatter `type:` is the knowledge-graph document type — always
 * `Location` — so what the place actually *is* lives in the body line.
 */
function getPlaceKind(content) {
    const match = content.match(/^\s*\*\*Type:\*\*\s*(.+)$/im);
    return match ? text(match[1]) : undefined;
}
/** Frontmatter is hand-written, so a sequence may arrive as `2` or as `"2"`. */
function asInteger(value) {
    if (typeof value === 'number' && Number.isInteger(value))
        return value;
    if (typeof value === 'string' && /^\d+$/.test(value.trim()))
        return parseInt(value, 10);
    return undefined;
}
export function compileProject(projectRoot, config, registry, engine, options = {}) {
    const write = options.write ?? true;
    const NS = config.project.nsid;
    const outputDir = path.resolve(projectRoot, config.paths.output);
    const results = [];
    // An ambiguous alias drops a reference from every record that uses it, and
    // a bad DID publishes a profile under the wrong identity.
    const diagnostics = [...engine.registryDiagnostics(), ...engine.identityDiagnostics()];
    const allRecords = [];
    /** Absolute paths written this run; everything else pinakes-named is stale. */
    const written = new Set();
    const lexiconDocs = buildLexiconDocs(NS);
    const schemas = compileLexiconDocs(lexiconDocs);
    /** Validates, then writes — invalid records are still written so the author can inspect them. */
    const writeRecords = (filePath, records) => {
        const relative = path.relative(projectRoot, filePath);
        diagnostics.push(...validateRecords(records, schemas, relative));
        allRecords.push(...records);
        if (write) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(records, null, 2) + '\n', 'utf-8');
            written.add(path.resolve(filePath));
        }
        results.push({ file: relative, count: records.length });
    };
    /** Every citable record's end date (`null` = undated), for the stretch rules. */
    const sourceIndex = new Map();
    const indexDated = (records) => {
        for (const r of records)
            sourceIndex.set(r.id, r.storyDateEnd ?? r.storyDate ?? null);
    };
    /** Register first-terms the chapters use: the default stretch vocabulary. */
    const registersSeen = new Set();
    /** Stretches from every book, compiled after the series records exist. */
    const stretchSources = [];
    const stories = engine.getStories();
    const allPlaces = [];
    const allProfiles = [];
    const allItems = [];
    /**
     * Earliest recorded hand-off per item, across every book — the item record's
     * `firstAppearance`. Items come from the registry (series-wide) while custody
     * comes from chapters (per-book), so this is collected during the stories
     * pass and read back after it.
     */
    const firstCustody = new Map();
    /** Book key -> the story directory that claimed it. */
    const bookOwners = new Map();
    // 1. Stories compile (scenes, state events, custody events)
    for (const storyDir of stories) {
        const book = getBookKey(storyDir);
        const chapters = engine.loadChapters(storyDir);
        if (chapters.length === 0)
            continue;
        // `01_book` and `01_book_draft` both key to `book1`. Compiling the second
        // would overwrite the first's record files and mint colliding ids.
        const owner = bookOwners.get(book);
        if (owner) {
            diagnostics.push({
                file: path.relative(projectRoot, storyDir),
                rule: 'duplicate-book',
                severity: 'error',
                message: `Story directory compiles to book key '${book}', already used by ${path.relative(projectRoot, owner)}. Not compiled.`,
            });
            continue;
        }
        bookOwners.set(book, storyDir);
        const scenes = [];
        const events = [];
        const custodyEvents = [];
        /** Hand-offs per (item, chapter). The first keeps the bare id; repeats get `.2`, `.3`. */
        const custodySeq = new Map();
        for (const ch of chapters) {
            if (ch.dates.length === 0)
                continue;
            const storyDate = ch.dates[0];
            const storyDateEnd = ch.dates.length > 1 ? ch.dates[ch.dates.length - 1] : undefined;
            const chRef = `${book}#ch${ch.chapterNum}`;
            const sceneId = `scene.${book}.ch${ch.chapterNum}`;
            const createdAt = storyDateToDatetime(storyDate);
            // Resolve locations
            const placeRefs = [];
            const placeText = [];
            for (const loc of ch.locationNames) {
                const resolved = registry.resolve(loc, 'place');
                if (resolved) {
                    if (!placeRefs.includes(resolved.id)) {
                        placeRefs.push(resolved.id);
                    }
                }
                else if (registry.isNonEntity(loc)) {
                    const norm = registry.normalize(loc);
                    if (norm && !placeText.includes(norm)) {
                        placeText.push(norm);
                    }
                }
            }
            // Resolve people helper
            const resolvePeople = (names) => {
                const ids = [];
                for (const name of names) {
                    const resolved = registry.resolve(name, 'character');
                    if (resolved && !ids.includes(resolved.id)) {
                        ids.push(resolved.id);
                    }
                }
                return ids;
            };
            scenes.push(compact({
                $type: `${NS}.scene`,
                id: sceneId,
                storyDate,
                storyDateEnd,
                chapterRefs: [chRef],
                title: ch.title,
                part: ch.frontmatter.part !== undefined ? ch.frontmatter.part : undefined,
                sequence: asInteger(ch.frontmatter[config.project.sequenceField]),
                beat: ch.frontmatter.beat || undefined,
                tags: tagList(ch.frontmatter.tags),
                placeRefs: present(placeRefs),
                placeText: present(placeText),
                pov: ch.pov ? registry.resolve(ch.pov, 'character')?.id : undefined,
                participants: present(resolvePeople(ch.charactersPresent)),
                referenced: present(resolvePeople(ch.charactersReferenced)),
                primaryEvent: ch.beatPurpose || undefined,
                createdAt,
                sourceFile: ch.relativeFilePath,
            }));
            // Custody hand-offs
            for (const entry of ch.custody) {
                const itemEnt = registry.resolve(entry.item, 'item');
                const holderEnt = registry.resolve(entry.holder, 'character');
                // An unresolved item or holder is reported by `lint`; dropping it here
                // keeps a malformed hand-off out of the record set rather than minting
                // a custody event that points at nothing.
                if (!itemEnt || !holderEnt)
                    continue;
                const itemSlug = itemEnt.id.split('.', 2)[1];
                const fromEnt = entry.from ? registry.resolve(entry.from, 'character') : null;
                const baseId = `custodyEvent.${itemSlug}.${book}.ch${ch.chapterNum}`;
                const n = (custodySeq.get(baseId) ?? 0) + 1;
                custodySeq.set(baseId, n);
                const custodyId = n === 1 ? baseId : `${baseId}.${n}`;
                const prior = firstCustody.get(itemEnt.id);
                if (!prior || storyDate < prior.storyDate) {
                    firstCustody.set(itemEnt.id, { storyDate, chapterRef: chRef });
                }
                custodyEvents.push(compact({
                    $type: `${NS}.custodyEvent`,
                    id: custodyId,
                    item: itemEnt.id,
                    storyDate,
                    storyDateEnd,
                    holder: holderEnt.id,
                    fromHolder: fromEnt ? fromEnt.id : undefined,
                    event: text(entry.event),
                    chapterRef: chRef,
                    sceneRef: sceneId,
                    createdAt,
                    sourceFile: ch.relativeFilePath,
                }));
            }
            // Registers / state events
            for (const [name, val] of Object.entries(ch.registers)) {
                const resolved = registry.resolve(name, 'character');
                if (!resolved)
                    continue;
                const { register, expr } = parseRegister(val);
                events.push(compact({
                    $type: `${NS}.character.stateEvent`,
                    id: `stateEvent.${resolved.id.split('.', 2)[1]}.${book}.ch${ch.chapterNum}`,
                    subject: resolved.id,
                    storyDate,
                    storyDateEnd,
                    register,
                    registerExpr: expr !== register ? expr : undefined,
                    state: val,
                    chapterRef: chRef,
                    sceneRef: sceneId,
                    createdAt,
                    sourceFile: ch.relativeFilePath,
                }));
            }
        }
        // Sort events
        events.sort((a, b) => {
            if (a.subject !== b.subject)
                return a.subject.localeCompare(b.subject);
            if (a.storyDate !== b.storyDate)
                return a.storyDate.localeCompare(b.storyDate);
            return a.chapterRef.localeCompare(b.chapterRef);
        });
        custodyEvents.sort((a, b) => {
            if (a.item !== b.item)
                return a.item.localeCompare(b.item);
            if (a.storyDate !== b.storyDate)
                return a.storyDate.localeCompare(b.storyDate);
            return a.chapterRef.localeCompare(b.chapterRef);
        });
        // Posts: authored, not extracted. Emitted only when a story actually has a
        // `posts/` directory, so a universe that never writes any gets no empty
        // artifact to commit.
        const postSources = engine.loadPosts(storyDir);
        if (postSources.length > 0) {
            const posts = [];
            // Sequence within (chapter, author), so a second Emma post in chapter 12
            // is `.2`. Keyed rather than global so adding a post for one character
            // never renumbers another's.
            const seq = new Map();
            for (const src of postSources) {
                const fm = src.frontmatter;
                const authorName = text(fm.author);
                const resolvedAuthor = authorName ? registry.resolve(authorName, 'character') : undefined;
                if (!resolvedAuthor) {
                    diagnostics.push({
                        file: src.relativeFilePath,
                        rule: 'post-author',
                        severity: 'error',
                        message: authorName
                            ? `Post author '${authorName}' does not resolve to a registry character.`
                            : 'Post is missing an `author` in frontmatter.',
                    });
                    continue;
                }
                const storyDate = text(fm.date) ?? '';
                const chapterNum = asInteger(fm.chapter);
                const chRef = chapterNum !== undefined ? `${book}#ch${chapterNum}` : undefined;
                const slug = resolvedAuthor.id.split('.', 2)[1];
                const key = `${chapterNum ?? 'x'}.${slug}`;
                const n = (seq.get(key) ?? 0) + 1;
                seq.set(key, n);
                // `location` is a list on chapters and a scalar here — a post happens in
                // one place — but accept either so the frontmatter reads the same way.
                const locRaw = Array.isArray(fm.location) ? fm.location[0] : fm.location;
                const locName = text(locRaw);
                const placeRef = locName ? registry.resolve(locName, 'place')?.id : undefined;
                const mentionNames = Array.isArray(fm.mentions)
                    ? fm.mentions
                    : typeof fm.mentions === 'string'
                        ? fm.mentions.split(',')
                        : [];
                const mentions = [];
                for (const raw of mentionNames) {
                    const name = text(raw);
                    const hit = name ? registry.resolve(name, 'character') : undefined;
                    if (hit && !mentions.includes(hit.id))
                        mentions.push(hit.id);
                }
                posts.push(compact({
                    $type: `${NS}.character.post`,
                    id: `post.${book}.ch${chapterNum ?? 0}.${slug}.${n}`,
                    author: resolvedAuthor.id,
                    text: src.body || undefined,
                    storyDate,
                    storyTime: text(fm.time),
                    chapterRef: chRef,
                    publishDate: text(fm.publish),
                    inReplyTo: text(fm.reply_to),
                    mentions: present(mentions),
                    placeRef,
                    tags: tagList(fm.tags),
                    createdAt: storyDateToDatetime(storyDate),
                    sourceFile: src.relativeFilePath,
                }));
            }
            posts.sort((a, b) => {
                if (a.storyDate !== b.storyDate)
                    return a.storyDate.localeCompare(b.storyDate);
                return a.id.localeCompare(b.id);
            });
            indexDated(posts);
            writeRecords(path.join(outputDir, book, 'character_posts.json'), posts);
        }
        // Stretches are read here but compiled after the stories loop: `supersedes`
        // chains a character's stretches across books, and a stretch may cite a
        // profile, which does not exist until the series pass.
        for (const src of engine.loadStretches(storyDir))
            stretchSources.push({ book, src });
        indexDated(scenes);
        indexDated(events);
        indexDated(custodyEvents);
        for (const e of events)
            registersSeen.add(e.register);
        const bookDir = path.join(outputDir, book);
        writeRecords(path.join(bookDir, 'scenes.json'), scenes);
        writeRecords(path.join(bookDir, 'character_state_events.json'), events);
        if (custodyEvents.length > 0) {
            writeRecords(path.join(bookDir, 'custody_events.json'), custodyEvents);
        }
    }
    // 2. Locations / places compile
    const locationsDir = path.resolve(projectRoot, config.paths.locations);
    if (fs.existsSync(locationsDir)) {
        const locFiles = fs.readdirSync(locationsDir)
            .filter(f => f.endsWith('.md') && !f.startsWith('_') && f !== 'index.md')
            .sort();
        for (const file of locFiles) {
            const filePath = path.join(locationsDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const { data } = engine.parseFrontmatter(content);
            if (data && data.id && String(data.id).startsWith('place.')) {
                allPlaces.push(compact({
                    $type: `${NS}.place`,
                    id: data.id,
                    name: data.title || '',
                    kind: getPlaceKind(content),
                    description: text(data.description),
                    tags: tagList(data.tags),
                    status: data.status || 'active',
                    region: data.region || data.neighborhood || undefined,
                    firstAppearance: data.first_appearance || undefined,
                    schedule: data.schedule || undefined,
                    sourceFile: path.relative(projectRoot, filePath),
                }));
            }
        }
    }
    // 3. Characters profiles compile
    for (const ent of registry.allEntities) {
        if (ent.type === 'character' && ent.status === 'active') {
            const srcFile = ent.sourceFile ? path.resolve(projectRoot, ent.sourceFile) : '';
            const codex = readCharacterFile(srcFile, engine);
            allProfiles.push(compact({
                $type: `${NS}.character.profile`,
                id: `profile.${ent.id.split('.', 2)[1]}`,
                subject: ent.id,
                displayName: ent.displayName,
                handle: accountValue(ent, 'handle'),
                did: accountValue(ent, 'did'),
                description: codex.description,
                oneLine: codex.oneLine,
                tags: codex.tags,
                // The codex file is the finer-grained statement of where a character
                // stands; the registry entry is the fallback for one without a file.
                status: codex.status ?? text(ent.status),
                sourceFile: ent.sourceFile || '',
            }));
        }
    }
    // 4. Items compile — registry-derived and series-wide, like profiles. An
    // item's codex file is optional (most tracked objects are a registry entry
    // and nothing more), so absent frontmatter simply yields a leaner record.
    for (const ent of registry.allEntities) {
        if (ent.type !== 'item' || ent.status !== 'active')
            continue;
        let codex = {};
        if (ent.sourceFile) {
            const srcFile = path.resolve(projectRoot, ent.sourceFile);
            if (fs.existsSync(srcFile)) {
                const { data } = engine.parseFrontmatter(fs.readFileSync(srcFile, 'utf-8'));
                codex = { description: text(data?.description), tags: tagList(data?.tags) };
            }
        }
        allItems.push(compact({
            $type: `${NS}.item`,
            id: ent.id,
            displayName: ent.displayName,
            description: codex.description,
            tags: codex.tags,
            status: text(ent.status),
            firstAppearance: firstCustody.get(ent.id)?.chapterRef,
            sourceFile: ent.sourceFile || undefined,
        }));
    }
    for (const r of [...allPlaces, ...allProfiles, ...allItems])
        sourceIndex.set(r.id, null);
    // 5. Stretches — authored, like posts. Compiled last so that `supersedes` can
    // run across books and the stretch rules can see every record's dates.
    const stretchEntries = [];
    for (const { book, src } of stretchSources) {
        const fm = src.frontmatter;
        const name = text(fm.character);
        const resolved = name ? registry.resolve(name, 'character') : undefined;
        if (!resolved) {
            diagnostics.push({
                file: src.relativeFilePath,
                rule: 'stretch-character',
                severity: 'error',
                message: name
                    ? `Stretch character '${name}' does not resolve to a registry character.`
                    : 'Stretch is missing a `character` in frontmatter.',
            });
            continue;
        }
        const slug = resolved.id.split('.', 2)[1];
        const asOf = dateText(fm.asOf) ?? '';
        const carrying = Array.isArray(fm.carrying)
            ? fm.carrying.map((c) => text(c)).filter((c) => Boolean(c))
            : [];
        const sources = Array.isArray(fm.sources)
            ? fm.sources.map((c) => text(c)).filter((c) => Boolean(c))
            : [];
        stretchEntries.push({
            book,
            folder: src.folder,
            fileName: src.fileName,
            slug,
            record: compact({
                $type: `${NS}.character.stretch`,
                id: `stretch.${slug}.${book}.${asOf}`,
                subject: resolved.id,
                asOf,
                since: dateText(fm.since) ?? '',
                register: text(fm.register) ?? '',
                state: src.body,
                carrying: present(carrying),
                // Required and never compacted away: an empty list is a Lexicon failure
                // the author should see, not an absence.
                sources,
                status: text(fm.status) ?? '',
                createdAt: storyDateToDatetime(asOf),
                sourceFile: src.relativeFilePath,
            }),
        });
    }
    // Derived `supersedes`: each stretch points at the one before it for the same
    // character, across books. Authors never write it, so the chain cannot be
    // wrong. Ties on `asOf` are a `stretch-duplicate` finding, not a chain.
    const bySubject = new Map();
    for (const e of stretchEntries) {
        const list = bySubject.get(e.record.subject) ?? [];
        list.push(e);
        bySubject.set(e.record.subject, list);
    }
    for (const list of bySubject.values()) {
        list.sort((a, b) => String(a.record.asOf).localeCompare(String(b.record.asOf)));
        for (let i = 1; i < list.length; i++)
            list[i].record.supersedes = list[i - 1].record.id;
    }
    const stretchBooks = [...new Set(stretchEntries.map((e) => e.book))].sort();
    for (const book of stretchBooks) {
        const records = stretchEntries
            .filter((e) => e.book === book)
            // Rebuilt in Lexicon field order, so the derived `supersedes` sits where
            // a reader of the JSON expects it rather than trailing the record.
            .map(({ record: r }) => compact({
            $type: r.$type,
            id: r.id,
            subject: r.subject,
            asOf: r.asOf,
            since: r.since,
            register: r.register,
            state: r.state,
            carrying: r.carrying,
            sources: r.sources,
            supersedes: r.supersedes,
            status: r.status,
            createdAt: r.createdAt,
            sourceFile: r.sourceFile,
        }))
            .sort((a, b) => {
            if (a.subject !== b.subject)
                return a.subject.localeCompare(b.subject);
            return String(a.asOf).localeCompare(String(b.asOf));
        });
        writeRecords(path.join(outputDir, book, 'character_stretches.json'), records);
    }
    const vocabulary = config.stretches.registers ?? [...registersSeen].sort();
    const stretchFindings = lintStretches(stretchEntries, sourceIndex, vocabulary, config);
    const seriesDir = path.join(outputDir, 'series');
    if (allPlaces.length > 0) {
        writeRecords(path.join(seriesDir, 'places.json'), allPlaces);
    }
    if (allProfiles.length > 0) {
        writeRecords(path.join(seriesDir, 'character_profiles.json'), allProfiles);
    }
    if (allItems.length > 0) {
        writeRecords(path.join(seriesDir, 'items.json'), allItems);
    }
    // Ids are the record keys, so two records sharing one is a collision in any
    // repository they are published to. The usual cause is two chapter files
    // with the same `chapter:` number.
    const idFiles = new Map();
    for (const r of allRecords) {
        if (typeof r?.id !== 'string')
            continue;
        const first = idFiles.get(r.id);
        if (first) {
            diagnostics.push({
                file: r.sourceFile || first,
                rule: 'duplicate-record-id',
                severity: 'error',
                message: `Record id '${r.id}' is also produced by ${first}.`,
            });
        }
        else {
            idFiles.set(r.id, r.sourceFile || '');
        }
    }
    const lexiconPaths = write ? writeLexiconDocs(outputDir, lexiconDocs) : [];
    for (const f of lexiconPaths)
        written.add(path.resolve(f));
    const lexiconFiles = lexiconPaths.map(f => path.relative(projectRoot, f));
    // Only a writing compile prunes: `lint` and `context` build records in
    // memory and must leave the output directory exactly as they found it.
    const pruned = write ? pruneStale(projectRoot, outputDir, written) : [];
    const removed = pruned && pruned.map(f => path.relative(projectRoot, f));
    return { results, lexiconFiles, diagnostics, stretchFindings, records: allRecords, removed };
}
