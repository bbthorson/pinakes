export function parseRegister(value) {
    let text = value.trim();
    // Parentheticals are notes, and a note may contain its own arrow
    // (`private (curious → quietly alarmed)` is one register, not a transition).
    // Strip innermost groups until none are left, then anything after an
    // unclosed `(`.
    for (let prev = ''; prev !== text;) {
        prev = text;
        text = text.replace(/\s*\([^()]*\)/g, '');
    }
    text = text.replace(/\s*\(.*$/, '').trim().replace(/;$/, '').trim();
    const steps = text.split(/\s*(?:->|→)\s*/).map((s) => s.trim()).filter(Boolean);
    return { register: steps[0] ?? '', expr: text, steps };
}
