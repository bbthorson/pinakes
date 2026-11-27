/**
 * Six-Lens Temporal Review Board — deterministic slice assembler.
 *
 * Every one of these 6 Author-Mode lenses catches exclusive, non-redundant
 * editorial defects and must never be collapsed:
 *
 * 1. `backward-short`: target chapter + N prior chapters + writing guide
 * 2. `backward-mid`:   target chapter + book bible + voice guide + latest stretches + First-Appearance Entity Ledger (<= ch - 1)
 * 3. `backward-long`:  target chapter + compiled records summary + series codex + held-secret policy
 * 4. `forward-short`:  target chapter + current sequence/act upcoming outline beats (next 1–4 chapters)
 * 5. `forward-mid`:    target chapter + full book outline + subplot threads + scene-relevant interiority maps
 * 6. `forward-long`:   target chapter + series_arcs + series_plan
 */
import fs from 'fs';
import path from 'path';
import { buildFirstAppearanceLedgerFromEngine, filterLedgerBeforeChapter, getBookKeyFromDir, renderFirstAppearancesMarkdown, } from '../compiler/first-appearances.js';
export const TEMPORAL_LENSES = [
    'backward-short',
    'backward-mid',
    'backward-long',
    'forward-short',
    'forward-mid',
    'forward-long',
];
const LENS_PURPOSES = {
    'backward-short': 'Seam splices, intra-chapter clock/prop arithmetic, POV slips, craft/tells.',
    'backward-mid': 'Canon accuracy, register fidelity, fair-play provenance (First-Appearance Entity Ledger up to ch - 1).',
    'backward-long': 'Compiled reader-surface leaks, codex contradictions, earlier-book proper-noun drift.',
    'forward-short': 'Premature scope leaks and baton-pass handoffs to the next 1–4 chapters.',
    'forward-mid': 'Load-bearing setup-to-payoff survival and character contradiction-engine progression.',
    'forward-long': 'Cross-book secret-lane collisions, premature mechanism lock-ins, multi-book runway.',
};
/** Numbers prose lines as `L1: ...` so reviewers return exact `lineRef` coordinates. */
export function numberLines(text) {
    return text
        .split(/\r?\n/)
        .map((line, i) => `L${i + 1}: ${line}`)
        .join('\n');
}
function resolveStoryDir(engine, story) {
    const needle = story.toLowerCase();
    const stories = engine.getStories();
    return (stories.find((s) => path.basename(s).toLowerCase() === needle || getBookKeyFromDir(s) === needle) ??
        stories.find((s) => path.basename(s).toLowerCase().includes(needle)));
}
function readOptionalFile(root, candidates, label, documents, missingInputs, configuredExplicitly) {
    for (const rel of candidates) {
        if (!rel)
            continue;
        const abs = path.resolve(root, rel);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            documents.push({
                label,
                path: path.relative(root, abs),
                content: fs.readFileSync(abs, 'utf-8').trim(),
            });
            return;
        }
    }
    const first = candidates.find(Boolean);
    if (first && configuredExplicitly) {
        missingInputs.push(`${label}: ${first}`);
    }
}
function findFirstExisting(root, rels) {
    for (const rel of rels) {
        const abs = path.resolve(root, rel);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile())
            return rel;
    }
    return undefined;
}
/**
 * Extracts upcoming outline beats for `forward-short` from a markdown outline:
 * matches headings mentioning chapter numbers in `(targetCh, targetCh + window]`
 * or falls back to the full outline if headings don't use chapter numbers.
 */
function extractUpcomingOutline(outlineText, targetChapterNum, windowSize) {
    const lines = outlineText.split(/\r?\n/);
    const headingIndices = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^#{1,6}\s+(.*)$/);
        if (!m)
            continue;
        const chMatch = m[1].match(/\b(?:chapter|ch\.?)\s*(\d+)\b/i);
        headingIndices.push({ idx: i, ch: chMatch ? parseInt(chMatch[1], 10) : undefined });
    }
    const upcomingBlocks = [];
    for (let h = 0; h < headingIndices.length; h++) {
        const { idx, ch } = headingIndices[h];
        if (ch !== undefined && ch > targetChapterNum && ch <= targetChapterNum + windowSize) {
            const end = h + 1 < headingIndices.length ? headingIndices[h + 1].idx : lines.length;
            upcomingBlocks.push(lines.slice(idx, end).join('\n').trim());
        }
    }
    return upcomingBlocks.length > 0 ? upcomingBlocks.join('\n\n') : outlineText.trim();
}
function summarizeCompiledRecords(records, NS) {
    const byType = new Map();
    for (const r of records) {
        const t = String(r.$type ?? 'unknown').replace(`${NS}.`, '');
        const list = byType.get(t) ?? [];
        list.push(r);
        byType.set(t, list);
    }
    const out = ['### Compiled Records Summary'];
    for (const [type, list] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        out.push(`- **${type}**: ${list.length} record(s)`);
    }
    const profiles = byType.get('character.profile') ?? [];
    if (profiles.length) {
        out.push('', '### Published Character Profiles');
        for (const p of profiles) {
            out.push(`- **${p.displayName}** (\`${p.subject}\`): ${p.oneLine ?? p.description ?? '_no summary_'}`);
        }
    }
    const places = byType.get('place') ?? [];
    if (places.length) {
        out.push('', '### Published Places');
        for (const pl of places) {
            out.push(`- **${pl.name}** (\`${pl.id}\`): ${pl.description ?? pl.kind ?? '_no summary_'}`);
        }
    }
    return out.join('\n');
}
function expandPathTemplate(template, storyRel, bookKey) {
    if (!template)
        return undefined;
    return template.replace(/<story>/g, storyRel).replace(/<book>/g, bookKey);
}
export function buildReviewSlices(root, config, registry, engine, records, options) {
    const errors = [];
    const storyDir = resolveStoryDir(engine, options.story);
    if (!storyDir) {
        return { slices: [], errors: [`Story '${options.story}' did not match any story directory.`] };
    }
    const book = getBookKeyFromDir(storyDir);
    const storyRel = path.relative(root, storyDir);
    const chapters = engine.loadChapters(storyDir);
    const targetStr = String(options.chapter);
    const target = chapters.find((c) => String(c.chapterNum) === targetStr);
    if (!target) {
        return {
            slices: [],
            errors: [`Chapter '${options.chapter}' not found in story '${path.basename(storyDir)}'.`],
        };
    }
    const targetNum = typeof target.chapterNum === 'number' ? target.chapterNum : Number(target.chapterNum);
    const targetDate = target.dates[0] ?? '';
    const targetIdx = chapters.indexOf(target);
    const seqField = config.project.sequenceField;
    const targetSeq = typeof target.frontmatter?.[seqField] === 'number'
        ? target.frontmatter[seqField]
        : Number.isFinite(Number(target.frontmatter?.[seqField]))
            ? Number(target.frontmatter[seqField])
            : undefined;
    const reviewCfg = config.probabilistic.review;
    const pathsCfg = reviewCfg.paths;
    const priorCount = options.priorChapters ?? reviewCfg.priorChapters;
    const upcomingCount = options.upcomingChapters ?? reviewCfg.upcomingChapters;
    const requestedLenses = options.lenses?.length ? options.lenses : [...TEMPORAL_LENSES];
    const ledger = buildFirstAppearanceLedgerFromEngine(registry, engine);
    const NS = config.project.nsid;
    const targetSummary = {
        chapterNum: target.chapterNum,
        title: target.title,
        date: targetDate,
        pov: target.pov,
        charactersPresent: target.charactersPresent,
        ...(targetSeq !== undefined ? { sequence: targetSeq } : {}),
        numberedBody: numberLines(target.body),
    };
    const outlinePath = expandPathTemplate(pathsCfg.outline, storyRel, book) ??
        findFirstExisting(root, [
            path.join(storyRel, 'plot', 'outline.md'),
            path.join(storyRel, 'chapters', '00_story_outline.md'),
            path.join(storyRel, 'plot', '00_story_outline.md'),
        ]);
    const slices = [];
    for (const lens of requestedLenses) {
        const documents = [];
        const missingInputs = [];
        let firstAppearancesBeforeChapter;
        if (lens === 'backward-short') {
            const prior = chapters.slice(Math.max(0, targetIdx - priorCount), targetIdx);
            for (const p of prior) {
                documents.push({
                    label: `Prior Chapter ${p.chapterNum} — ${p.title}`,
                    path: p.relativeFilePath,
                    content: p.body,
                });
            }
            readOptionalFile(root, [expandPathTemplate(pathsCfg.writingGuide, storyRel, book)], 'Writing Guide', documents, missingInputs, Boolean(pathsCfg.writingGuide));
        }
        else if (lens === 'backward-mid') {
            readOptionalFile(root, [
                expandPathTemplate(pathsCfg.bookBible, storyRel, book),
                path.join(storyRel, 'plot', '00_story_background.md'),
            ], 'Book Bible', documents, missingInputs, Boolean(pathsCfg.bookBible));
            readOptionalFile(root, [expandPathTemplate(pathsCfg.voiceGuide, storyRel, book)], 'Voice Guide', documents, missingInputs, Boolean(pathsCfg.voiceGuide));
            // Latest approved stretches for present characters on or before target chapter date
            const stretches = records.filter((r) => r.$type === `${NS}.character.stretch` &&
                r.status === 'approved' &&
                typeof r.asOf === 'string' &&
                (!targetDate || r.asOf <= targetDate));
            const latestBySubject = new Map();
            for (const st of stretches) {
                const prev = latestBySubject.get(st.subject);
                if (!prev || st.asOf > prev.asOf)
                    latestBySubject.set(st.subject, st);
            }
            if (latestBySubject.size > 0) {
                const lines = [];
                for (const st of [...latestBySubject.values()].sort((a, b) => a.subject.localeCompare(b.subject))) {
                    lines.push(`### ${st.subject} (as of ${st.asOf}, register \`${st.register}\`)`, '', st.state, '');
                }
                documents.push({ label: 'Latest Approved Stretches', content: lines.join('\n').trim() });
            }
            firstAppearancesBeforeChapter = filterLedgerBeforeChapter(ledger, book, target.chapterNum);
            documents.push({
                label: `First-Appearance Entity Ledger (up to before ${book}#ch${target.chapterNum})`,
                content: renderFirstAppearancesMarkdown(firstAppearancesBeforeChapter).trim(),
            });
        }
        else if (lens === 'backward-long') {
            documents.push({
                label: 'Compiled Records Summary',
                content: summarizeCompiledRecords(records, NS),
            });
            // Series codex files for characters present or referenced in the target chapter
            const relevantIds = new Set();
            for (const name of [...target.charactersPresent, ...target.charactersReferenced, ...(target.pov ? [target.pov] : [])]) {
                const hit = registry.resolve(name, 'character');
                if (hit)
                    relevantIds.add(hit.id);
            }
            for (const id of relevantIds) {
                const ent = registry.getEntity(id);
                if (!ent?.sourceFile)
                    continue;
                const abs = path.resolve(root, ent.sourceFile);
                if (fs.existsSync(abs)) {
                    documents.push({
                        label: `Series Codex — ${ent.displayName}`,
                        path: ent.sourceFile,
                        content: fs.readFileSync(abs, 'utf-8').trim(),
                    });
                }
            }
            // Held-secret policy (file and/or pinakes.yaml configured heldSecrets)
            readOptionalFile(root, [expandPathTemplate(pathsCfg.heldSecretPolicy, storyRel, book)], 'Held-Secret Policy', documents, missingInputs, Boolean(pathsCfg.heldSecretPolicy));
            if (config.probabilistic.heldSecrets.length > 0) {
                const policyLines = config.probabilistic.heldSecrets.map((s) => `- **${s.id}**: ${s.description}${s.holdUntil ? ` (holdUntil: ${JSON.stringify(s.holdUntil)})` : ''}`);
                documents.push({ label: 'Configured Held Secrets (pinakes.yaml)', content: policyLines.join('\n') });
            }
        }
        else if (lens === 'forward-short') {
            if (outlinePath) {
                const abs = path.resolve(root, outlinePath);
                if (fs.existsSync(abs)) {
                    const full = fs.readFileSync(abs, 'utf-8');
                    const extracted = Number.isFinite(targetNum)
                        ? extractUpcomingOutline(full, targetNum, upcomingCount)
                        : full.trim();
                    documents.push({
                        label: `Upcoming Outline Beats (next ${upcomingCount} chapters)`,
                        path: path.relative(root, abs),
                        content: extracted,
                    });
                }
                else if (pathsCfg.outline) {
                    missingInputs.push(`Outline: ${outlinePath}`);
                }
            }
            // Also include metadata of any already-drafted subsequent chapters in the same sequence/window
            const upcomingDrafted = chapters.slice(targetIdx + 1, targetIdx + 1 + upcomingCount);
            if (upcomingDrafted.length > 0) {
                const lines = upcomingDrafted.map((c) => `- **Ch ${c.chapterNum} — ${c.title}** (${c.dates[0] ?? 'undated'}): ${c.beatPurpose ?? '_no beat_purpose_'}`);
                documents.push({ label: 'Subsequent Drafted Chapter Beats', content: lines.join('\n') });
            }
        }
        else if (lens === 'forward-mid') {
            readOptionalFile(root, [outlinePath], 'Full Book Outline', documents, missingInputs, Boolean(pathsCfg.outline));
            readOptionalFile(root, [
                expandPathTemplate(pathsCfg.subplotThreads, storyRel, book),
                path.join(storyRel, 'tracking', 'subplot_threads.md'),
            ], 'Subplot Threads', documents, missingInputs, Boolean(pathsCfg.subplotThreads));
            // Scene-relevant interiority maps for characters present in target chapter
            const intDirRel = expandPathTemplate(pathsCfg.interiorityDir, storyRel, book) ??
                path.join(storyRel, 'tracking', 'interiority');
            const intDirAbs = path.resolve(root, intDirRel);
            if (fs.existsSync(intDirAbs) && fs.statSync(intDirAbs).isDirectory()) {
                const intFiles = fs.readdirSync(intDirAbs).filter((f) => f.endsWith('.md') && !f.startsWith('00_'));
                for (const name of target.charactersPresent) {
                    const hit = registry.resolve(name, 'character');
                    if (!hit)
                        continue;
                    const slug = (hit.id.includes('.') ? hit.id.split('.', 2)[1] : hit.id).toLowerCase();
                    const match = intFiles.find((f) => f.toLowerCase().includes(slug));
                    if (match) {
                        const full = path.join(intDirAbs, match);
                        documents.push({
                            label: `Interiority Map — ${name}`,
                            path: path.relative(root, full),
                            content: fs.readFileSync(full, 'utf-8').trim(),
                        });
                    }
                }
            }
            else if (pathsCfg.interiorityDir) {
                missingInputs.push(`Interiority Dir: ${intDirRel}`);
            }
        }
        else if (lens === 'forward-long') {
            readOptionalFile(root, [expandPathTemplate(pathsCfg.seriesArcs, storyRel, book), 'codex/series_arcs.md'], 'Series Arcs', documents, missingInputs, Boolean(pathsCfg.seriesArcs));
            readOptionalFile(root, [expandPathTemplate(pathsCfg.seriesPlan, storyRel, book), 'codex/series_plan.md'], 'Series Plan', documents, missingInputs, Boolean(pathsCfg.seriesPlan));
        }
        slices.push({
            lens,
            purpose: LENS_PURPOSES[lens],
            book,
            storyDir: storyRel,
            chapter: target.chapterNum,
            chapterFile: target.relativeFilePath,
            storyDate: targetDate,
            targetChapter: targetSummary,
            documents,
            ...(firstAppearancesBeforeChapter ? { firstAppearancesBeforeChapter } : {}),
            missingInputs,
        });
    }
    return { slices, errors };
}
export function renderReviewSliceMarkdown(slice) {
    const out = [
        `# Temporal Review Slice — \`${slice.lens}\``,
        '',
        `**Target:** ${slice.book} Chapter ${slice.chapter} — ${slice.targetChapter.title} (${slice.storyDate || 'undated'})`,
        `**Lens Focus:** ${slice.purpose}`,
        `**File:** \`${slice.chapterFile}\``,
        '',
    ];
    if (slice.missingInputs.length > 0) {
        out.push('> **Missing configured inputs:** ' + slice.missingInputs.join('; '), '');
    }
    out.push('## Target Chapter (Line-Numbered)', '', '```markdown', slice.targetChapter.numberedBody, '```', '');
    for (const doc of slice.documents) {
        const header = doc.path ? `${doc.label} (\`${doc.path}\`)` : doc.label;
        out.push(`## ${header}`, '', doc.content, '');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
