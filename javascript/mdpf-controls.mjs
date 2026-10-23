// Source-only control parsing. No host, DOM or token-encoding assumptions.
export function standaloneBreaks(source) {
    const breaks = [], segments = []; let start = 0;
    for (const match of source.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
        if (!match[0]) continue;
        const text = match[0].replace(/(?:\r\n|\r|\n)$/, '');
        if (!/^[\t ]*BREAK[\t ]*$/.test(text)) continue;
        breaks.push({ start: match.index, end: match.index + match[0].length, text: match[0], rowText: text });
        segments.push({ start, end: match.index, text: source.slice(start, match.index) });
        start = match.index + match[0].length;
    }
    segments.push({ start, end: source.length, text: source.slice(start) });
    let masked = source;
    for (const control of [...breaks].reverse()) masked = masked.slice(0, control.start) + control.text.replace(/[^\r\n]/g, ' ') + masked.slice(control.end);
    return { breaks, segments, masked, issues: /\bBREAK\b/.test(masked) ? ['Only standalone uppercase BREAK rows are supported; keep inline, escaped or grouped controls in raw mode.'] : [] };
}
