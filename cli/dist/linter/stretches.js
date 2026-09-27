const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar date, not merely the right shape — `2026-02-30` fails. */
export function isCalendarDate(value) {
    if (typeof value !== 'string' || !DATE_ONLY.test(value))
        return false;
    const d = new Date(`${value}T00:00:00.000Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function lintStretches(entries, index, registers, config) {
    const out = [];
    const severityOf = (rule, fallback) => {
        const set = config.rules[rule] ?? fallback;
        return set === 'off' ? null : set;
    };
    const report = (rule, fallback, file, message) => {
        const severity = severityOf(rule, fallback);
        if (severity)
            out.push({ file, rule, severity, message });
    };
    const seen = new Map(); // subject::asOf -> first file
    for (const { record: r, folder, fileName, slug } of entries) {
        const file = r.sourceFile;
        // Dates
        const asOfOk = isCalendarDate(r.asOf);
        const sinceOk = isCalendarDate(r.since);
        if (!asOfOk)
            report('stretch-dates', 'error', file, `\`asOf\` must be a YYYY-MM-DD calendar date; got '${r.asOf ?? ''}'.`);
        if (!sinceOk)
            report('stretch-dates', 'error', file, `\`since\` must be a YYYY-MM-DD calendar date; got '${r.since ?? ''}'.`);
        if (asOfOk && sinceOk && r.since > r.asOf) {
            report('stretch-dates', 'error', file, `\`since\` (${r.since}) is after \`asOf\` (${r.asOf}); a stretch looks backward.`);
        }
        // Filename and folder
        const expectedName = `${r.asOf}.md`;
        if (folder !== slug || fileName !== expectedName) {
            report('stretch-filename', 'error', file, `A stretch for ${r.subject} as of ${r.asOf ?? '?'} belongs at \`stretches/${slug}/${expectedName}\`.`);
        }
        // One per character per date
        if (asOfOk) {
            const key = `${r.subject}::${r.asOf}`;
            const first = seen.get(key);
            if (first) {
                report('stretch-duplicate', 'error', file, `${r.subject} already has a stretch as of ${r.asOf} (${first}).`);
            }
            else {
                seen.set(key, file);
            }
        }
        // Status
        if (r.status !== 'draft' && r.status !== 'approved') {
            report('stretch-status', 'error', file, `\`status\` must be 'draft' or 'approved'; got '${r.status ?? ''}'.`);
        }
        // Register vocabulary
        if (!registers.includes(r.register)) {
            report('stretch-register', 'error', file, `Register '${r.register ?? ''}' is not in the vocabulary (${registers.map((x) => `'${x}'`).join(', ')}).`);
        }
        // Sources: resolve, then check none ends after asOf.
        const sources = Array.isArray(r.sources) ? r.sources : [];
        for (const src of sources) {
            const id = String(src);
            if (!index.has(id)) {
                report('stretch-source-unresolved', 'error', file, `Source '${id}' is not a compiled record id. Stretches cite posts, state events, scenes, custody events, profiles, places, or items.`);
                continue;
            }
            const end = index.get(id);
            if (asOfOk && end && end > r.asOf) {
                report('stretch-source-future', 'error', file, `Source '${id}' ends ${end}, after this stretch's asOf ${r.asOf}. A character cannot draw on what has not happened yet.`);
            }
        }
        // Length
        const softMax = config.stretches.softMaxChars;
        if (typeof r.state === 'string' && r.state.length > softMax) {
            report('stretch-length', 'warning', file, `Stretch is ${r.state.length} characters, over the ${softMax} soft limit. A stretch is a paragraph, not a summary.`);
        }
    }
    return out;
}
