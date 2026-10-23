import { MODULES, tokenize } from './mdpf-core.mjs?v=0.48.3-alpha.1';
import { standaloneBreaks } from './mdpf-controls.mjs?v=0.48.3-alpha.1';
import { scoreLine } from './mdpf-classifier.mjs?v=0.48.3-alpha.1';

const emotionTags = new Set(['smile', 'smirk', 'crazy smile', 'evil smile', 'grin', 'frown', 'smug', 'annoyed', 'angry', 'furious', 'serious', 'pout', 'blush', 'soft blush', 'happy', 'sad', 'crying', 'clenched teeth', 'parted lips', 'open mouth', 'closed mouth', 'closed eyes']);
const embeddedExpressions = new Set(['angry male', 'serious male']); // Explicit author corrections.
const normalize = value => value.trim().replaceAll('_', ' ').toLowerCase();
const characterStart = text => /^\s*1(?:girl|boy|other)\s*,/i.test(text) && (text.match(/\b\d+(?:girl|boy|other)s?\b/gi) ?? []).length === 1;
const backgroundRow = text => tokenize(text).tokens.some(token => {
    const tag = normalize(token.text).replace(/^\((.*):[\d.]+\)$/, '$1');
    return /\b(background|outdoors|indoors|rooftop|pool|beach|city street|starry sky|lighting|aura)\b/.test(tag)
        || /\b(castle|dungeon|throne room|stone walls)$/.test(tag);
});
const placementRow = text => /^\s*(?:man|woman|girl|boy|tall woman|short girl)\b[^\n]*(?:next to|behind|in front of|on top of|under|beside)\b/i.test(text);
const styleRow = text => /^\s*<lora:/i.test(text);

function lines(source, start, end) {
    const rows = [];
    let cursor = start;
    for (const match of source.slice(start, end).matchAll(/\r\n|\n|\r/g)) {
        const stop = start + match.index;
        rows.push({ start: cursor, end: stop, text: source.slice(cursor, stop) });
        cursor = stop + match[0].length;
    }
    rows.push({ start: cursor, end, text: source.slice(cursor, end) });
    return rows;
}

function expressions(text) {
    return tokenize(text).tokens.map(token => normalize(token.text).replace(/^\((.*):[\d.]+\)$/, '$1'))
        .filter(tag => emotionTags.has(tag) || embeddedExpressions.has(tag))
        .map(tag => tag.replace(/ male$/, ''));
}

function expressionRow(text) {
    const tags = tokenize(text).tokens.map(token => normalize(token.text)).filter(Boolean);
    return tags.some(tag => /^(looking |head tilt|eye contact)/.test(tag) || emotionTags.has(tag));
}

/** Lossless candidate structure. Assignments are positional/heuristic, never a rewrite. */
export function inspectStructure(source, { separator, globalPosition = 'unknown', extraQualityLine = false } = {}) {
    const issues = [];
    const controls = standaloneBreaks(source);
    const syntax = tokenize(source).issues;
    if (syntax.length || controls.issues.length || controls.segments.some(segment => tokenize(segment.text).issues.length)
        || /\[SEP\]|\bAND\b|[\[\]{}#]/.test(source) || /__[^\n]+__/.test(source) || /\bNegative prompt\s*:/i.test(source) || /\bBREAK\b/.test(separator ?? '')) {
        return { supported: false, source, issues: [...syntax, 'Advanced control, dynamic, comment, or malformed syntax requires raw mode.'] };
    }
    const boundaries = [];
    if (separator !== undefined) {
        if (!separator || /[\r\n]/.test(separator)) return { supported: false, source, issues: ['Newline/empty regional separators are not supported by this preview.'] };
        let offset = source.indexOf(separator);
        while (offset !== -1) {
            boundaries.push({ start: offset, end: offset + separator.length, text: separator });
            offset = source.indexOf(separator, offset + separator.length);
        }
    } else {
        for (const row of lines(source, 0, source.length)) {
            if (row.text.trim() === '---') boundaries.push({ ...row });
        }
        if (source.includes('---') && !boundaries.length) return { supported: false, source, issues: ['Inline separators need a verified literal separator setting; use raw mode.'] };
    }
    const regional = boundaries.length > 0;
    const chunks = [];
    let start = 0;
    for (const boundary of boundaries) { chunks.push({ start, end: boundary.start }); start = boundary.end; }
    chunks.push({ start, end: source.length });
    const blocks = [];
    const characters = [];
    const regions = [];
    let number = 0;
    let regionNumber = 0;
    function block(row, regionId, kind = 'opaque', module = null, characterId = null, scope = 'unassigned') {
        const value = {
            id: `span-${row.start}-${row.end}`, ...row, regionId, kind, module, characterId, scope,
            editable: kind === 'module' || kind === 'placement',
            evidence: kind === 'module' ? 'Candidate assignment from authored rows; review before editing.' : '',
        };
        blocks.push(value);
        return value;
    }
    function assignPrefix(rows, regionId, scope) {
        if (!rows.length) return;
        const qualityRows = extraQualityLine ? 2 : 1;
        rows.forEach((row, index) => {
            const scored = rows.length === 1 ? scoreLine(row.text) : null;
            if (index < qualityRows && (/\b(quality|masterpiece|highres|anime style|MechaP0s|newest)\b/i.test(rows[0].text))) {
                block(row, regionId, 'module', 1, null, scope);
            } else if (scored?.module === 2 && !scored.unknown.length && !scored.ignored.length && scored.scores.every((score, module) => module === 1 || score === 0)) {
                block(row, regionId, 'module', 2, null, scope);
            } else if (index === rows.length - 1 && index >= qualityRows + 1 && styleRow(row.text)) {
                block(row, regionId, 'module', 7, null, scope);
            } else if (index === qualityRows) block(row, regionId, 'module', 2, null, scope);
            else { block(row, regionId); issues.push('Some context rows need manual assignment.'); }
        });
    }
    chunks.forEach((chunk, chunkIndex) => {
        const regionId = regional ? `chunk-${chunkIndex}` : 'document';
        const rows = lines(source, chunk.start, chunk.end).filter(row => row.text.trim() !== '' && row.text.trim() !== 'BREAK');
        const starts = rows.flatMap((row, index) => characterStart(row.text) ? [index] : []);
        const explicitShared = regional && ((globalPosition === 'first' && chunkIndex === 0) || (globalPosition === 'last' && chunkIndex === chunks.length - 1));
        const region = { id: regionId, ...chunk, global: explicitShared, context: starts.length === 0, title: regional ? `Region candidate ${chunkIndex + 1}` : 'Prompt' };
        regions.push(region);
        if (!rows.length) { issues.push('Empty region retained; review the regional boundaries.'); return; }
        if (!starts.length) {
            region.title = explicitShared ? 'Shared / global content' : 'Context · global status unverified';
            assignPrefix(rows, regionId, explicitShared ? 'shared' : 'context');
            return;
        }
        if (regional) region.title = `${globalPosition === 'unknown' ? 'Region candidate' : 'Region'} ${++regionNumber}`;
        if (explicitShared) issues.push('The configured global chunk contains character content. Review its scope.');
        assignPrefix(rows.slice(0, starts[0]), regionId, regional ? 'region' : 'shared');
        starts.forEach((rowIndex, localIndex) => {
            const char = { id: `character-${++number}`, number, regionId, expressions: [], embeddedExpressions: [], missingModules: [] };
            characters.push(char);
            const row = rows[rowIndex];
            block(row, regionId, 'module', 3, char.id, 'character');
            for (const token of tokenize(row.text).tokens) {
                if (embeddedExpressions.has(normalize(token.text))) {
                    char.embeddedExpressions.push({ text: token.text.trim(), start: row.start + token.start, end: row.start + token.end });
                    char.expressions.push(...expressions(token.text));
                }
            }
            const tail = rows.slice(rowIndex + 1, starts[localIndex + 1] ?? rows.length);
            let outfitSeen = false;
            tail.forEach((entry, tailIndex) => {
                if (placementRow(entry.text)) { block(entry, regionId, 'placement', null, null, 'relationship'); return; }
                if (backgroundRow(entry.text)) {
                    block(entry, regionId, 'module', 6, regional ? char.id : null, regional ? 'region' : 'shared'); return;
                }
                if (tailIndex === tail.length - 1 && styleRow(entry.text)) {
                    block(entry, regionId, 'module', 7, null, regional ? 'region' : 'shared'); return;
                }
                if (expressionRow(entry.text)) {
                    block(entry, regionId, 'module', 5, char.id, 'character');
                    char.expressions.push(...expressions(entry.text)); return;
                }
                if (!outfitSeen && tailIndex === 0) {
                    outfitSeen = true;
                    block(entry, regionId, 'module', 4, char.id, 'character'); return;
                }
                block(entry, regionId, 'opaque', null, char.id);
                issues.push('An unassigned character row is preserved read-only.');
            });
            const assigned = blocks.filter(item => item.characterId === char.id).map(item => item.module);
            char.missingModules = [4, 5].filter(module => !assigned.includes(module));
        });
    });
    boundaries.forEach(boundary => block(boundary, null, 'delimiter', null, null, 'boundary'));
    controls.breaks.forEach(control => block({ start: control.start, end: control.start + control.rowText.length, text: control.rowText },
        regions.find(region => control.start >= region.start && control.start < region.end)?.id ?? null, 'control', null, null, 'boundary'));
    blocks.sort((a, b) => a.start - b.start);
    if (characters.length < 2 && !controls.breaks.length) return { supported: false, source, issues: ['Two separate authored character rows were not established. Keep raw mode for ambiguous or flat prompts.'] };
    if (blocks.some(item => tokenize(item.text).issues.length)) return { supported: false, source, issues: ['A construct spans rows or regions; keep raw mode.'] };
    if (characters.some(char => char.embeddedExpressions.length)) issues.push('Expression tags inside a character row are identified as L5 intent; they have not been moved.');
    const headingRows = blocks.filter(item => item.kind !== 'delimiter' && item.kind !== 'control').every(item => {
        const preceding = lines(source, 0, item.start).at(-2);
        return preceding?.text === '';
    });
    return {
        supported: true, kind: 'advanced', schemaVersion: 2, source, regional, separator: regional ? separator ?? '---' : null,
        globalPosition, blocks, characters, regions, breaks: controls.breaks, issues: [...new Set(issues)], extraQualityLine, headingRows,
    };
}

/** Insert only missing heading rows; never remove authored whitespace or alter regions. */
export function addStructureHeadingRows(document) {
    if (!document.supported || document.kind !== 'advanced') throw new Error('A supported character structure is required.');
    const rows = lines(document.source, 0, document.source.length);
    // Inline separators or constructs spanning physical rows cannot share this layout.
    const isolated = document.blocks.every(block => rows.some(row => block.kind === 'delimiter'
        ? row.start <= block.start && row.end >= block.end && row.text.trim() === block.text.trim()
        : row.start === block.start && row.end === block.end));
    if (!isolated) return document.source;
    const eol = document.source.match(/\r\n|\r|\n/)?.[0] ?? '\n';
    let result = document.source;
    for (const block of [...document.blocks].reverse()) {
        if (block.kind === 'delimiter' || block.kind === 'control') continue;
        const index = rows.findIndex(row => row.start === block.start);
        if (index > 0 && rows[index - 1].text === '') continue;
        result = result.slice(0, block.start) + eol + result.slice(block.start);
    }
    return result;
}

/** Edit only existing, identified spans. Never reconstruct rows, regions or separators. */
export function serializeStructure(document, changes = {}) {
    if (!document.supported || document.kind !== 'advanced') throw new Error('Unsupported advanced document.');
    const byId = new Map(document.blocks.map(block => [block.id, block]));
    const replacements = Object.entries(changes).map(([id, text]) => {
        const block = byId.get(id);
        if (!block?.editable || typeof text !== 'string') throw new Error('Unknown or read-only source span.');
        return { ...block, text };
    }).sort((a, b) => b.start - a.start);
    let output = document.source;
    for (const item of replacements) output = output.slice(0, item.start) + item.text + output.slice(item.end);
    return output;
}

export function structureAdvisories(document, integration = { state: 'unknown' }) {
    if (!document.supported) return [];
    const notices = [];
    const signatures = document.characters.map(char => [...new Set(char.expressions)].sort().join('|')).filter(Boolean);
    const different = signatures.length > 1 && new Set(signatures).size > 1;
    const verified = integration.state === 'enabled' && document.regional && integration.separator === document.separator;
    if (different && !verified) notices.push('Different character expressions detected. Illustrious may apply the same expression across characters. Use Forge Couple for separation, or inpaint the secondary expression afterward.');
    if (document.regional && !verified) notices.push('Regional separators detected. Check that Forge Couple is enabled and uses the same separator.');
    if (verified) notices.push('Forge Couple is enabled with the matching separator. Region geometry and image results still need review.');
    const embedded = document.characters.filter(char => char.embeddedExpressions.length).map(char => char.number);
    if (embedded.length) notices.push(`Expression intent is embedded in character row(s) ${embedded.join(', ')}. Review the marked tags; detection does not move them.`);
    return notices;
}

export function moduleName(number) { return MODULES[number - 1]; }










