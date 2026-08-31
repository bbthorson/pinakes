import fs from 'fs';
import path from 'path';
import { buildLexiconDocs, compileLexiconDocs, validateRecords, writeLexiconDocs } from '../lexicons/index.js';
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
 * heading.
 */
function readCharacterFile(filePath, engine) {
    if (!filePath || !fs.existsSync(filePath))
        return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = engine.parseFrontmatter(content);
    const handleRaw = text(data?.handle);
    return {
        handle: handleRaw ? handleRaw.replace(/^@/, '') : undefined,
        oneLine: getOverviewOneline(content),
        description: text(data?.description),
        tags: tagList(data?.tags),
        status: text(data?.status),
    };
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
function splitRegister(value) {
    const val = value.trim();
    const m = val.match(/^([^(]+?)\s*(\(.*)?$/);
    const expr = (m ? m[1] : val).trim().replace(/;$/, '').trim();
    const register = expr.split(/\s*(?:->|→)\s*/)[0].trim();
    return { register, expr };
}
export function compileProject(projectRoot, config, registry, engine) {
    const NS = config.project.nsid;
    const outputDir = path.resolve(projectRoot, config.paths.output);
    const results = [];
    const diagnostics = [];
    const lexiconDocs = buildLexiconDocs(NS);
    const schemas = compileLexiconDocs(lexiconDocs);
    /** Validates, then writes — invalid records are still written so the author can inspect them. */
    const writeRecords = (filePath, records) => {
        const relative = path.relative(projectRoot, filePath);
        diagnostics.push(...validateRecords(records, schemas, relative));
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(records, null, 2) + '\n', 'utf-8');
        results.push({ file: relative, count: records.length });
    };
    const stories = engine.getStories();
    const allPlaces = [];
    const allProfiles = [];
    // 1. Stories compile (scenes and state events)
    for (const storyDir of stories) {
        const book = getBookKey(storyDir);
        const chapters = engine.loadChapters(storyDir);
        if (chapters.length === 0)
            continue;
        const scenes = [];
        const events = [];
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
            // Registers / state events
            for (const [name, val] of Object.entries(ch.registers)) {
                const resolved = registry.resolve(name, 'character');
                if (!resolved)
                    continue;
                const { register, expr } = splitRegister(val);
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
        const bookDir = path.join(outputDir, book);
        writeRecords(path.join(bookDir, 'scenes.json'), scenes);
        writeRecords(path.join(bookDir, 'character_state_events.json'), events);
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
                handle: codex.handle,
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
    const seriesDir = path.join(outputDir, 'series');
    if (allPlaces.length > 0) {
        writeRecords(path.join(seriesDir, 'places.json'), allPlaces);
    }
    if (allProfiles.length > 0) {
        writeRecords(path.join(seriesDir, 'character_profiles.json'), allProfiles);
    }
    const lexiconFiles = writeLexiconDocs(outputDir, lexiconDocs).map(f => path.relative(projectRoot, f));
    return { results, lexiconFiles, diagnostics };
}
