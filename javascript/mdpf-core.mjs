// Platform-independent prompt operations. No DOM, Forge, or model imports.
export const MODULES = Object.freeze([
    'Quality & medium', 'Camera, pose & action', 'Character (head to toe)',
    'Outfit (top to bottom)', 'Gaze & expression', 'Background', 'Style',
]);

export function tokenize(source) {
    const tokens = [];
    const issues = [];
    const stack = [];
    const pairs = { '(': ')', '[': ']', '<': '>', '{': '}' };
    let start = 0;
    let escaped = false;
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (escaped) { escaped = false; continue; }
        if (c === '\\') { escaped = true; continue; }
        if (pairs[c]) stack.push(pairs[c]);
        else if (')]>}'.includes(c)) {
            if (stack.pop() !== c) issues.push(`Unmatched closing delimiter at ${i}.`);
        } else if (c === ',' && stack.length === 0) {
            tokens.push({ start, end: i, text: source.slice(start, i), separator: ',' });
            start = i + 1;
        }
    }
    tokens.push({ start, end: source.length, text: source.slice(start), separator: '' });
    if (stack.length) issues.push('Unclosed prompt delimiter.');
    if (escaped) issues.push('Trailing escape character.');
    return { tokens, issues };
}

export function compatibilityIssues(source) {
    const issues = [...tokenize(source).issues];
    if (source.includes('---')) issues.push('Regional separators require raw mode in this prototype.');
    if (/\[SEP\]|\b(?:BREAK|AND)\b/.test(source)) issues.push('Prompt control syntax requires raw mode.');
    if (/[\[\]{}]|__[^\n]+__/.test(source)) issues.push('Schedules, alternation, or dynamic syntax require raw mode.');
    if (source.includes('#')) issues.push('Prompt comments require raw mode.');
    if (/\bNegative prompt\s*:/i.test(source)) issues.push('This field contains a negative-prompt section; use only positive text.');
    const counts = source.match(/\b\d+(?:girl|boy|other)s?\b/gi) ?? [];
    if (counts.length > 1 || counts.some(tag => parseInt(tag, 10) !== 1)) {
        issues.push('Multiple character counts require raw mode.');
    }
    return [...new Set(issues)];
}

function sourceLines(source) {
    const lines = [];
    const newline = /\r\n|\n|\r/g;
    let start = 0;
    for (const match of source.matchAll(newline)) {
        lines.push({ start, end: match.index, text: source.slice(start, match.index), eol: match[0] });
        start = match.index + match[0].length;
    }
    lines.push({ start, end: source.length, text: source.slice(start), eol: '' });
    return lines;
}

// This proposes positional assignments; it does not establish that text is MDPF.
export function inspectPrompt(source, { extraQualityLine = false } = {}) {
    const issues = compatibilityIssues(source);
    if (issues.length) return { supported: false, source, issues };
    if (source === '') {
        return {
            supported: true, schemaVersion: 1, source, empty: true, extraQualityLine: false,
            modules: MODULES.map((name, index) => ({ name, index, start: 0, end: 0, text: '' })),
            issues: [],
        };
    }
    let lines = sourceLines(source);
    const physicalLines = lines;
    const expected = extraQualityLine ? 8 : 7;
    // A deliberately formatted heading layout has one blank header row per module.
    // Match the complete pattern; never discard arbitrary blank/empty module rows.
    let headingRows = false;
    let spaced = lines;
    if (spaced.length === expected + 8 && spaced.at(-1).text === '') spaced = spaced.slice(0, -1);
    if (spaced.length === expected + 7) {
        const content = [];
        let cursor = 0, valid = true;
        for (let index = 0; index < 7; index++) {
            if (spaced[cursor++].text.trim() !== '') { valid = false; break; }
            content.push(spaced[cursor++]);
            if (index === 0 && extraQualityLine) content.push(spaced[cursor++]);
        }
        if (valid) { lines = content; headingRows = true; }
    }
    // A terminal newline is retained outside module spans. An empty L7 is still a real row.
    if (lines.length === expected + 1 && lines.at(-1).text === '') lines.pop();
    // Authored solo spacing: exactly seven nonempty rows, with a blank gap at
    // every section boundary. Never collapse arbitrary blanks in a normal layout
    // (they can represent empty modules), or infer a second L1 row here.
    let authoredSpacing = false;
    if (lines.length !== expected && !extraQualityLine) {
        const content = physicalLines.map((line, index) => ({ line, index })).filter(({ line }) => line.text.trim());
        if (content.length === 7 && content.slice(1).every((item, index) => item.index - content[index].index >= 2)) {
            lines = content.map(item => item.line);
            authoredSpacing = true;
            headingRows = content.every(item => item.index > 0 && physicalLines[item.index - 1].text === '');
        }
    }
    if (lines.length !== expected) return {
        supported: false, source,
        issues: [`Expected ${expected} physical lines for this mapping; found ${lines.length}. Keep raw text or select the extra L1 line option.`],
    };
    // Cross-line weighted expressions cannot safely be edited as independent modules.
    if (lines.some(line => tokenize(line.text).issues.length)) return {
        supported: false, source, issues: ['A prompt construct spans lines. Keep it in raw mode.'],
    };
    const modules = MODULES.map((name, index) => {
        const first = extraQualityLine && index > 0 ? index + 1 : index;
        const last = extraQualityLine && index === 0 ? 1 : first;
        const start = lines[first].start;
        const end = lines[last].end;
        return { name, index, start, end, text: source.slice(start, end) };
    });
    return { supported: true, schemaVersion: 1, source, modules, extraQualityLine, headingRows, authoredSpacing, empty: false, issues: [] };
}

// Explicit formatting only: insert whitespace, preserve every existing source slice.
export function addHeadingRows(document) {
    if (!document.supported || !document.modules) throw new Error('A simple reviewed module mapping is required.');
    if (document.empty || document.headingRows) return document.source;
    const eol = document.source.match(/\r\n|\r|\n/)?.[0] ?? '\n';
    const physical = document.authoredSpacing ? sourceLines(document.source) : [];
    let result = document.source;
    for (const module of [...document.modules].reverse()) {
        const index = physical.findIndex(line => line.start === module.start);
        if (index > 0 && physical[index - 1].text === '') continue;
        result = result.slice(0, module.start) + eol + result.slice(module.start);
    }
    return result;
}

export function serialize(document, values = document.modules?.map(module => module.text)) {
    if (!document.supported) throw new Error('Cannot serialize unsupported structure.');
    if (!Array.isArray(values) || values.length !== 7 || values.some(value => typeof value !== 'string')) {
        throw new Error('Exactly seven text values are required.');
    }
    if (document.empty) return values.every(value => value === '') ? '' : values.join('\n');
    let output = document.source;
    // Replacing backwards preserves the original offsets and every untouched slice.
    for (let i = 6; i >= 0; i--) {
        const module = document.modules[i];
        if (values[i] !== module.text) output = output.slice(0, module.start) + values[i] + output.slice(module.end);
    }
    return output;
}

export function validateDraft(document, values) {
    const proposed = serialize(document, values);
    const issues = compatibilityIssues(proposed);
    values.forEach((value, index) => {
        const maximum = index === 0 && document.extraQualityLine ? 2 : 1;
        if (sourceLines(value).length > maximum) issues.push(`L${index + 1} contains too many physical lines for this mapping.`);
        issues.push(...tokenize(value).issues);
    });
    return { proposed, issues: [...new Set(issues)] };
}
