import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
export class LinterEngine {
    config;
    registry;
    projectRoot;
    constructor(projectRoot, config, registry) {
        this.projectRoot = projectRoot;
        this.config = config;
        this.registry = registry;
    }
    // Parses the frontmatter between the first two '---' fences
    parseFrontmatter(content) {
        const lines = content.split(/\r?\n/);
        if (lines.length === 0 || lines[0].trim() !== '---') {
            return { data: {}, text: '', lineOffset: 0, body: content.trim() };
        }
        const fmLines = [];
        let closingIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                closingIndex = i;
                break;
            }
            fmLines.push(lines[i]);
        }
        if (closingIndex === -1) {
            return { data: {}, text: '', lineOffset: 0, body: content.trim() };
        }
        const fmText = fmLines.join('\n');
        const body = lines.slice(closingIndex + 1).join('\n').trim();
        try {
            const data = YAML.parse(fmText) || {};
            return { data, text: fmText, lineOffset: 1, body };
        }
        catch (e) {
            return { data: null, text: fmText, lineOffset: 1, body };
        }
    }
    // Scan stories and load metadata
    loadChapters(storyDir) {
        const chaptersPath = path.join(storyDir, 'chapters');
        if (!fs.existsSync(chaptersPath))
            return [];
        const files = fs.readdirSync(chaptersPath)
            .filter(f => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('00_'))
            .sort();
        const chapters = [];
        for (const file of files) {
            const filePath = path.join(chaptersPath, file);
            const relativeFilePath = path.relative(this.projectRoot, filePath);
            const content = fs.readFileSync(filePath, 'utf-8');
            const { data, text, body } = this.parseFrontmatter(content);
            if (data === null) {
                // Handle malformed frontmatter elsewhere as diagnostic
                continue;
            }
            if (!data.chapter)
                continue;
            // Extract ISO dates via regex
            const dateString = String(data.date || '');
            const dates = dateString.match(/\d{4}-\d{2}-\d{2}/g) || [];
            // Locations
            let locationNames = [];
            if (typeof data.location === 'string') {
                locationNames = [data.location];
            }
            else if (Array.isArray(data.location)) {
                locationNames = data.location.map((l) => String(l));
            }
            // Characters Present & Referenced
            const charactersPresent = Array.isArray(data.characters_present)
                ? data.characters_present.map((c) => String(c))
                : [];
            const charactersReferenced = Array.isArray(data.characters_referenced)
                ? data.characters_referenced.map((c) => String(c))
                : [];
            // Registers
            const registers = {};
            if (data.registers && typeof data.registers === 'object') {
                for (const [k, v] of Object.entries(data.registers)) {
                    registers[k] = String(v);
                }
            }
            // Custody hand-offs. A list rather than a map (unlike `registers:`)
            // because one chapter can pass the same item twice, and each entry
            // carries a previous holder and a description of its own.
            const custody = [];
            if (Array.isArray(data.custody)) {
                for (const raw of data.custody) {
                    if (!raw || typeof raw !== 'object')
                        continue;
                    const itemName = raw.item !== undefined ? String(raw.item) : '';
                    const holderName = raw.holder !== undefined ? String(raw.holder) : '';
                    if (!itemName || !holderName)
                        continue;
                    custody.push({
                        item: itemName,
                        holder: holderName,
                        from: raw.from !== undefined && raw.from !== null ? String(raw.from) : undefined,
                        event: raw.event !== undefined && raw.event !== null ? String(raw.event) : undefined,
                    });
                }
            }
            chapters.push({
                filePath,
                relativeFilePath,
                frontmatter: data,
                frontmatterText: text,
                chapterNum: isNaN(Number(data.chapter)) ? data.chapter : Number(data.chapter),
                title: data.title || '',
                dates,
                locationNames,
                charactersPresent,
                charactersReferenced,
                pov: data.pov ? String(data.pov) : null,
                registers,
                custody,
                beatPurpose: data.beat_purpose || null,
                body,
            });
        }
        return chapters;
    }
    /**
     * Splits a source file into its frontmatter block and everything after it.
     * `parseFrontmatter` hands back the YAML but not the prose, and a post's
     * prose *is* the record's payload.
     */
    splitBody(content) {
        const lines = content.split(/\r?\n/);
        if (lines[0]?.trim() !== '---')
            return content.trim();
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---')
                return lines.slice(i + 1).join('\n').trim();
        }
        return content.trim();
    }
    /**
     * Posts live in `posts/` beside a story's `chapters/`, one file per post:
     * frontmatter carries the anchors, the body is the text the character said.
     *
     * Read in filename order, which is the order the compiler assigns sequence
     * numbers in, so ids stay stable across recompiles. `00_`-prefixed files are
     * templates, matching the convention the rest of the tree uses.
     */
    loadPosts(storyDir) {
        const dir = path.join(storyDir, 'posts');
        if (!fs.existsSync(dir))
            return [];
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md') && !f.startsWith('00_'))
            .sort()
            .map((fileName) => {
            const filePath = path.join(dir, fileName);
            const content = fs.readFileSync(filePath, 'utf-8');
            const { data } = this.parseFrontmatter(content);
            return {
                filePath,
                relativeFilePath: path.relative(this.projectRoot, filePath),
                frontmatter: data || {},
                body: this.splitBody(content),
            };
        });
    }
    // Get active stories (non-templates)
    getStories() {
        const storiesPath = path.join(this.projectRoot, this.config.paths.stories);
        if (!fs.existsSync(storiesPath))
            return [];
        return fs.readdirSync(storiesPath)
            .map(name => path.join(storiesPath, name))
            .filter(p => fs.statSync(p).isDirectory() && !path.basename(p).startsWith('_') && !path.basename(p).startsWith('.'));
    }
    // Perform linting
    lint() {
        const diagnostics = [];
        const stories = this.getStories();
        for (const storyDir of stories) {
            const chapters = this.loadChapters(storyDir);
            if (chapters.length === 0)
                continue;
            // 1. Built-in: Entity Resolution checks
            if (this.config.rules['unresolved-entities'] !== 'off') {
                const severity = this.config.rules['unresolved-entities'];
                for (const ch of chapters) {
                    // POV check
                    if (ch.pov) {
                        this.checkEntity(ch.pov, 'character', ch, 'pov', severity, diagnostics);
                    }
                    // Location check
                    for (const loc of ch.locationNames) {
                        this.checkEntity(loc, 'place', ch, 'location', severity, diagnostics);
                    }
                    // Present check
                    for (const char of ch.charactersPresent) {
                        this.checkEntity(char, 'character', ch, 'characters_present', severity, diagnostics);
                    }
                    // Referenced check
                    for (const char of ch.charactersReferenced) {
                        this.checkEntity(char, 'character', ch, 'characters_referenced', severity, diagnostics);
                    }
                    // Registers check
                    for (const char of Object.keys(ch.registers)) {
                        this.checkEntity(char, 'character', ch, 'registers keys', severity, diagnostics);
                    }
                    // Custody check — an unregistered item or holder would otherwise be
                    // dropped silently by the compiler, losing the hand-off.
                    for (const entry of ch.custody) {
                        this.checkEntity(entry.item, 'item', ch, 'custody item', severity, diagnostics);
                        this.checkEntity(entry.holder, 'character', ch, 'custody holder', severity, diagnostics);
                        if (entry.from) {
                            this.checkEntity(entry.from, 'character', ch, 'custody from', severity, diagnostics);
                        }
                    }
                }
            }
            // 2. Built-in: Sequential dates check
            if (this.config.rules['non-sequential-dates'] !== 'off') {
                const severity = this.config.rules['non-sequential-dates'];
                // Sort chapters sequentially by their chapter identifier if numeric
                const sortedChapters = [...chapters].sort((a, b) => {
                    const aNum = typeof a.chapterNum === 'number' ? a.chapterNum : 0;
                    const bNum = typeof b.chapterNum === 'number' ? b.chapterNum : 0;
                    return aNum - bNum;
                });
                let lastStartDate = null;
                let lastChapterFile = '';
                for (const ch of sortedChapters) {
                    if (ch.dates.length === 0) {
                        diagnostics.push({
                            file: ch.relativeFilePath,
                            rule: 'missing-date',
                            severity: 'error',
                            message: `Chapter missing valid ISO date in frontmatter \`date\` field`,
                        });
                        continue;
                    }
                    const chStartDate = ch.dates[0];
                    if (lastStartDate && chStartDate < lastStartDate) {
                        diagnostics.push({
                            file: ch.relativeFilePath,
                            rule: 'non-sequential-dates',
                            severity,
                            message: `Chapter date (${chStartDate}) is out of sequence. It occurs before previous chapter ${lastChapterFile} date (${lastStartDate}).`,
                        });
                    }
                    lastStartDate = chStartDate; // update to start date of this chapter
                    lastChapterFile = path.basename(ch.filePath);
                }
            }
            // 3. Built-in: Co-presence conflicts check (same character in different locations on same date range)
            if (this.config.rules['co-presence-conflict'] !== 'off') {
                const severity = this.config.rules['co-presence-conflict'];
                // Match characters present in each chapter against other chapters occurring on overlapping dates.
                // Chapters are compared by their RESOLVED place ids: a chapter whose location entries
                // resolve to no registry place (a distributed montage, transit, or unlocated chapter)
                // pins its characters to no particular place, so it cannot co-presence-conflict (#12).
                // Resolving also makes alias spellings of the same place compare equal.
                const resolvedPlaceIds = (fmLocation) => {
                    const locs = fmLocation ? (Array.isArray(fmLocation) ? fmLocation : [fmLocation]) : [];
                    return locs
                        .map((l) => this.registry.resolve(String(l), 'place')?.id)
                        .filter((id) => Boolean(id));
                };
                for (let i = 0; i < chapters.length; i++) {
                    const chA = chapters[i];
                    if (chA.dates.length === 0)
                        continue;
                    const placeIdsA = resolvedPlaceIds(chA.frontmatter.location);
                    if (placeIdsA.length === 0)
                        continue;
                    const startA = chA.dates[0];
                    const endA = chA.dates[chA.dates.length - 1];
                    for (let j = i + 1; j < chapters.length; j++) {
                        const chB = chapters[j];
                        if (chB.dates.length === 0)
                            continue;
                        const startB = chB.dates[0];
                        const endB = chB.dates[chB.dates.length - 1];
                        // Overlap check
                        const overlaps = (startA <= endB) && (startB <= endA);
                        if (overlaps) {
                            const placeIdsB = resolvedPlaceIds(chB.frontmatter.location);
                            // Only trigger if both chapters resolve to places and share none of them
                            const hasSharedLocation = placeIdsA.some((id) => placeIdsB.includes(id));
                            if (!hasSharedLocation && placeIdsB.length > 0) {
                                // Resolve character IDs for both
                                const idsA = chA.charactersPresent.map(c => this.registry.resolve(c, 'character')?.id).filter(Boolean);
                                const idsB = chB.charactersPresent.map(c => this.registry.resolve(c, 'character')?.id).filter(Boolean);
                                const overlapsChars = idsA.filter(id => idsB.includes(id));
                                for (const charId of overlapsChars) {
                                    const displayName = this.registry.allEntities.find(e => e.id === charId)?.displayName || charId;
                                    diagnostics.push({
                                        file: chA.relativeFilePath,
                                        rule: 'co-presence-conflict',
                                        severity,
                                        message: `Co-presence conflict: Character '${displayName}' is present in Chapter ${chA.chapterNum} and Chapter ${chB.chapterNum} (${chB.relativeFilePath}) at the same time in different locations.`,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            // 4. Built-in: the public-register rule for authored posts.
            //
            // Every other record is projected out of prose and cannot contradict it.
            // A post is written *as* the character and goes out on a permanent public
            // feed, so it is the one place where the author can leak the plot.
            //
            // The rule: a post may be anchored only to a chapter where its author is
            // in a public register, or to a chapter where the author has no register
            // annotation at all (they are off-page, so nothing on the page can
            // contradict them). A private or under-pressure state produces silence.
            //
            // This is checked at the chapter, not the day. A character can be public
            // at the dinner table and private in a phone call three hours later, and
            // the post belongs to the scene it is anchored to.
            if (this.config.rules['post-register'] !== 'off') {
                const severity = (this.config.rules['post-register'] ?? 'error');
                const safe = this.config.posts.publicRegisters;
                const posts = this.loadPosts(storyDir);
                if (posts.length > 0) {
                    // (chapter, resolved character id) -> the register annotation there.
                    const registerAt = new Map();
                    for (const ch of chapters) {
                        for (const [name, val] of Object.entries(ch.registers)) {
                            const hit = this.registry.resolve(name, 'character');
                            if (!hit)
                                continue;
                            // The register is the first term: `public -> private (...)` is a
                            // performance that begins in public, which is what the reader of
                            // the feed sees.
                            const first = String(val).split(/->|\u2192/)[0].trim().split('(')[0].trim();
                            registerAt.set(`${ch.chapterNum}::${hit.id}`, first);
                        }
                    }
                    for (const post of posts) {
                        const authorName = post.frontmatter.author;
                        const author = authorName ? this.registry.resolve(String(authorName), 'character') : undefined;
                        if (!author)
                            continue; // the compiler reports an unresolvable author
                        const chapter = post.frontmatter.chapter;
                        if (chapter === undefined || chapter === null)
                            continue;
                        const register = registerAt.get(`${chapter}::${author.id}`);
                        if (register === undefined)
                            continue; // off-page: no annotation to contradict
                        if (!safe.includes(register)) {
                            diagnostics.push({
                                file: post.relativeFilePath,
                                rule: 'post-register',
                                severity,
                                message: `Post is anchored to chapter ${chapter}, where ${author.id} is in the ` +
                                    `'${register}' register. Only ${safe.map((r) => `'${r}'`).join(' or ')} ` +
                                    `permits a post; anything else is silence.`,
                            });
                        }
                    }
                }
            }
        }
        return diagnostics;
    }
    checkEntity(name, type, ch, field, severity, diagnostics) {
        const norm = this.registry.normalize(name);
        if (!norm)
            return;
        const resolved = this.registry.resolve(norm, type);
        if (resolved)
            return;
        if (this.registry.isNonEntity(norm))
            return;
        // Line number search in frontmatter
        let line;
        const fmLineOffset = 2; // starts after the opening ---
        const lines = ch.frontmatterText.split(/\n/);
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(name)) {
                line = i + fmLineOffset;
                break;
            }
        }
        diagnostics.push({
            file: ch.relativeFilePath,
            line,
            rule: 'unresolved-entities',
            severity,
            message: `Unresolved reference to ${type} '${norm}' in field '${field}'`,
        });
    }
}
