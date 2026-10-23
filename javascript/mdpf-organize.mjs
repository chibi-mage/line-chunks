import { MODULES, compatibilityIssues, tokenize } from './mdpf-core.mjs?v=0.48.5-alpha.1';
import { scoreLine, SCORING_POLICY } from './mdpf-classifier.mjs?v=0.48.5-alpha.1';
import { standaloneBreaks } from './mdpf-controls.mjs?v=0.48.5-alpha.1';
import { CHARACTER_ANATOMY_RANKS, OUTFIT_ORDER_RANKS, OUTFIT_SUFFIX_RANKS, OUTFIT_LOCATION_RANKS, PATTERN_RULES, COMBINED_CHARACTER_RANKS, COMBINED_OUTFIT_RANKS, GAZE_FIRST_TAGS, CARRIED_PROP_TAGS, CIVIT_SAMPLE_CHARACTER_RANKS, CIVIT_SAMPLE_OUTFIT_RANKS, QUALIFIED_OUTFIT_RANKS } from './mdpf-rules.mjs?v=0.48.5-alpha.1';

/** Ordering metadata, never classification evidence. Call only for automatic L3. */
export function characterOrderRank(text) {
    const tag = text.replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (/^1(?:girl|boy|other)$/.test(tag)) return 0;
    if (tag === 'solo') return 1;
    if (Object.hasOwn(CIVIT_SAMPLE_CHARACTER_RANKS, tag)) return CIVIT_SAMPLE_CHARACTER_RANKS[tag];
    if (Object.hasOwn(COMBINED_CHARACTER_RANKS, tag)) return COMBINED_CHARACTER_RANKS[tag];
    if (Object.hasOwn(CHARACTER_ANATOMY_RANKS, tag)) return CHARACTER_ANATOMY_RANKS[tag];
    // Match the same full appearance forms accepted by classification; no noun substring sorting.
    if (/^(?:[a-z][a-z '-]* )?hair$/.test(tag)) return 10;
    if (/^(?:[a-z][a-z '-]* )?eyes$/.test(tag)) return 20;
    if (/^(?:[a-z][a-z '-]* )?pupils$/.test(tag)) return 21;
    return null;
}

const outfitPatterns = new Map(PATTERN_RULES.map(rule => [rule.id, rule.pattern]));
const carriedProps = new Set(CARRIED_PROP_TAGS);
const gazeFirst = new Set(GAZE_FIRST_TAGS);
/** Stable gaze-first order for automatic plain L5; other expressions keep source order. */
export function expressionOrderRank(text) {
    const tag = text.replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return gazeFirst.has(tag) || outfitPatterns.get('directed-gaze').test(tag) ? 0 : 1;
}
const outfitSuffixes = Object.keys(OUTFIT_SUFFIX_RANKS).sort((left,right) => right.length - left.length);
const qualifiedOutfitNouns = Object.keys(QUALIFIED_OUTFIT_RANKS).sort((left,right) => right.length - left.length);
/** Ordering metadata only. Whole-tag classification must already have assigned L4. */
export function outfitOrderRank(text) {
    const tag = text.replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (carriedProps.has(tag) || outfitPatterns.get('carried-prop').test(tag)) return 100;
    if (Object.hasOwn(CIVIT_SAMPLE_OUTFIT_RANKS, tag)) return CIVIT_SAMPLE_OUTFIT_RANKS[tag];
    if (Object.hasOwn(COMBINED_OUTFIT_RANKS, tag)) return COMBINED_OUTFIT_RANKS[tag];
    if (Object.hasOwn(OUTFIT_ORDER_RANKS, tag)) return OUTFIT_ORDER_RANKS[tag];
    if (outfitPatterns.get('qualified-known-outfit').test(tag)) return QUALIFIED_OUTFIT_RANKS[qualifiedOutfitNouns.find(noun=>tag.endsWith(' '+noun))];
    if (['hair-and-clothing-action','covering-body-action','held-object','known-outfit-action'].some(id => outfitPatterns.get(id).test(tag))) return null;
    if (outfitPatterns.get('covered-body-outfit').test(tag)) {
        const location = tag.split(' ').at(-1);
        return Object.hasOwn(OUTFIT_LOCATION_RANKS, location) ? OUTFIT_LOCATION_RANKS[location] : null;
    }
    if (outfitPatterns.get('clothing-cutout').test(tag)) {
        const location = tag.replace(/ cutouts?$/, '');
        return Object.hasOwn(OUTFIT_LOCATION_RANKS, location) ? OUTFIT_LOCATION_RANKS[location] : null;
    }
    if (!['clothing-item','worn-accessory','qualified-body-accessory','qualified-armor']
        .some(id => outfitPatterns.get(id).test(tag))) return null;
    const suffix = outfitSuffixes.find(noun => tag === noun || tag.endsWith(' ' + noun));
    return suffix === undefined ? null : OUTFIT_SUFFIX_RANKS[suffix];
}

// Conservative first transformation: complete, explicitly confirmed solo prompts only.
// Tokens remain opaque; weighted groups are never split or normalized.
export function previewOrganization(source, { confirmedSolo = false, placements = {}, bundles = [], unknownStyle = true, deduplicate = true, keepDuplicates = [] } = {}) {
    const controls = standaloneBreaks(source);
    if (controls.breaks.length && !controls.issues.length) {
        const issues = compatibilityIssues(controls.masked);
        if (!confirmedSolo) issues.push('Confirm that this prompt describes one character.');
        if (!controls.masked.trim()) issues.push('Enter positive prompt tags, not only BREAK controls.');
        if (source.length > 20000) issues.push('This preview supports up to 20,000 characters.');
        if (!placements || typeof placements !== 'object' || Array.isArray(placements) || !Array.isArray(bundles)) issues.push('Invalid segment choices.');
        if (issues.length) return { source, supported: false, proposed: null, issues, items: [], moves: [], review: [], sections: [], duplicates: [] };
        return organizeScopes(source, [{ start: 0, end: source.length, text: source, index: 0, shared: false, title: 'Prompt' }],
            { placements, bundles, unknownStyle, deduplicate, keepDuplicates }, { segmented: true });
    }
    const issues = compatibilityIssues(source);
    if (!confirmedSolo) issues.push('Confirm that this prompt describes one character.');
    if (!source.trim()) issues.push('Enter a positive prompt first.');
    if (source.length > 20000) issues.push('This preview supports up to 20,000 characters.');
    const tokens = tokenize(source).tokens;
    const review = [], moves = [], groups = MODULES.map(() => []), items = [], duplicates = [];
    if (tokens.filter(token => token.text.trim()).length > 200) issues.push('This preview supports up to 200 items.');
    if (source.length > 20000 || tokens.filter(token => token.text.trim()).length > 200) return {
        source, supported: false, proposed: null, issues, review, moves, items, sections: [],
    };
    const validModule = module => Number.isInteger(module) && module >= 1 && module <= 7;
    const validIndex = index => Number.isInteger(index) && index >= 0 && index < tokens.length && Boolean(tokens[index].text.trim());
    if (typeof deduplicate !== 'boolean' || !Array.isArray(keepDuplicates) || keepDuplicates.some(index => !validIndex(index))) issues.push('Invalid duplicate choices.');
    const retained = new Set(Array.isArray(keepDuplicates) ? keepDuplicates : []), seen = new Map();
    const owners = new Map();
    if (!placements || typeof placements !== 'object' || Array.isArray(placements)) issues.push('Invalid manual placements.');
    else for (const [key, module] of Object.entries(placements)) {
        if (!/^(0|[1-9]\d*)$/.test(key) || !validIndex(Number(key)) || !validModule(module)) issues.push('Invalid manual placement.');
    }
    if (!Array.isArray(bundles)) issues.push('Invalid bundles.');
    else for (const [bundleIndex, bundle] of bundles.entries()) {
        if (!bundle || !validIndex(bundle.start) || !validIndex(bundle.end) || bundle.end < bundle.start || !validModule(bundle.module)) {
            issues.push('Invalid bundle range or destination.'); continue;
        }
        for (let index = bundle.start; index <= bundle.end; index++) {
            if (owners.has(index)) issues.push('Bundles must not overlap.');
            if (Object.hasOwn(placements ?? {}, index)) issues.push('Remove individual placements before bundling those items.');
            owners.set(index, { ...bundle, bundleIndex });
        }
    }
    for (const [index, token] of tokens.entries()) {
        const text = token.text.trim();
        if (!text) {
            if (index !== tokens.length - 1) review.push({ text: '(empty comma field)', reason: 'Keep unusual comma structure for manual review.' });
            continue;
        }
        const scored = scoreLine(text);
        const categories = scored.scores.filter(score => score > 0).length;
        const evidenceModule = scored.module !== null && categories === 1 && !scored.unknown.length && !scored.ignored.length ? scored.module : null;
        const weakModule = scored.scores.findIndex(score => score > 0) + 1;
        const tentative = scored.status === 'uncertain' && categories === 1 && scored.coverage === 1
            && !scored.unknown.length && !scored.ignored.length && !/[<>\r\n]/.test(text)
            && scored.scores[weakModule - 1] >= 3 && scored.scores[weakModule - 1] < SCORING_POLICY.minScore
            ? { module: weakModule, score: scored.scores[weakModule - 1], evidence: scored.evidence,
                reason: 'Known evidence points to one section but is below the automatic threshold. Accept explicitly or choose another destination.' } : null;
        const angle = /[<>]/.test(text);
        const lora = /^<lora:[^<>\r\n]+>$/i.test(text);
        // Author convention: placement fallback only, never new classification evidence.
        const fallback = unknownStyle && !/[\r\n]/.test(text) && (lora || (!angle && (scored.status === 'unknown'
            || scored.evidence.length > 0 && scored.evidence.every(item => Object.keys(item.scores).every(module => module === '1' || module === '7')) && categories === 2)));
        const automatic = evidenceModule ?? (fallback ? 7 : null);
        // Evidence identity stays independent of fallback policy and manual destination.
        // A reference is syntactic only: neither its role nor a trigger is inferred.
        const evidenceKind = lora ? 'lora-reference' : evidenceModule === 7 ? 'recognized-style'
            : !angle && scored.status === 'unknown' && scored.unknown.length && !scored.ignored.length ? 'unclassified'
            : !angle && categories === 2 && !scored.unknown.length && !scored.ignored.length && scored.evidence.length
                && scored.evidence.every(item => Object.keys(item.scores).every(module => module === '1' || module === '7')) ? 'quality-style-ambiguity' : 'other';
        const bundle = owners.get(index);
        const manual = placements?.[index];
        const module = bundle?.module ?? (validModule(manual) ? manual : automatic);
        const reason = /\r|\n/.test(text) ? 'Cross-line item: review comma boundaries in the main prompt.'
            : angle && (!lora || !bundle && !(unknownStyle && module === 7)) ? 'Standalone LoRAs outside L7 require an explicit bundle; other angle syntax is unsupported.'
            : module === null ? 'Choose a destination or include this item in an explicit bundle.' : null;
        items.push({ index, text, automatic, module, tentative, evidenceKind, bundleIndex: bundle?.bundleIndex ?? null,
            placement: bundle ? 'bundle' : validModule(manual) ? 'manual' : fallback && evidenceModule === null ? 'provisional L7' : 'automatic', reason });
        // Exact trimmed plain tags only, per editable scope and destination. Keep
        // weighted constructs, references, count anchors and verified bundles intact.
        const plain = !/[()\[\]{}<>\\\r\n]/.test(text) && !/^\d+(?:girl|boy|other)s?$/i.test(text) && !bundle;
        // Accepting the retained occurrence's tentative destination must not
        // resurrect an identical repeat already marked for removal. Keeping that
        // repeat still requires its own destination before it can be applied.
        const key = JSON.stringify([text, module ?? tentative?.module ?? null]);
        if (plain && seen.has(key)) {
            const removed = deduplicate && !retained.has(index);
            duplicates.push({ index, text, keptIndex: seen.get(key), removed });
            items.at(-1).duplicateOf = seen.get(key); items.at(-1).removedDuplicate = removed;
            if (removed) continue;
        } else if (plain) seen.set(key, index);
        if (reason) {
            review.push({ text, reason });
            continue;
        }
        groups[module - 1].push(text);
        moves.push({ text, module, originalIndex: index, placement: items.at(-1).placement, bundleIndex: bundle?.bundleIndex ?? null });
    }
    if (review.length) issues.push(`${review.length} item(s) need review. No partial reorganization will be applied.`);
    // Pony quality scores lead L1, highest numeric score first. _up never changes
    // priority. Keep source spellings, equal-score order, opaque groups and bundles.
    const scoreRank = move => {
        if (move.bundleIndex !== null) return 0;
        const match = move.text.trim().replaceAll('_', ' ').replace(/\s+/g, ' ').match(/^score ([1-9])(?: up)?$/i);
        return match ? Number(match[1]) : 0;
    };
    groups[0] = moves.filter(move => move.module === 1).map(move => ({ text: move.text, rank: scoreRank(move) }))
        .sort((left, right) => right.rank - left.rank).map(item => item.text);
    // Stable appearance order for L3/L4 and gaze-first order for L5.
    // Explicit/manual/bundled/opaque/unranked items are barriers, as are scopes.
    for (const [module, rank] of [[3, characterOrderRank], [4, outfitOrderRank], [5, expressionOrderRank]]) {
        const ordered = [], run = [];
        const flush = () => {
            ordered.push(...run.sort((left,right) => rank(left.text) - rank(right.text)));
            run.length = 0;
        };
        for (const move of moves.filter(move => move.module === module)) {
            if (move.placement !== 'automatic' || move.bundleIndex !== null || /[()\[\]{}<>\\\r\n]/.test(move.text) || rank(move.text) === null) {
                flush(); ordered.push(move);
            } else run.push(move);
        }
        flush();
        groups[module - 1] = ordered.map(move => move.text);
    }
    // Deliberate formatting change only: commas, spaces and heading rows are shown in full.
    // Keep the original terminal-comma choice. Internal commas are required between tags.
    const nonempty = groups.map((group, index) => group.length ? index : -1).filter(index => index >= 0);
    const last = nonempty.at(-1);
    const trailingComma = source.trimEnd().endsWith(',');
    const proposed = issues.length ? null : groups.map((group, index) => '\n' + group.join(', ')
        + (group.length && (index !== last || trailingComma) ? ',' : '')).join('\n');
    return { source, supported: issues.length === 0, proposed, issues: [...new Set(issues)], review, moves, items, duplicates,
        sections: MODULES.map((name, index) => ({ module: index + 1, name, tags: groups[index] })) };
}

/** Fixed standalone regional boundaries; the shared chunk is copied byte-for-byte. */
export function previewRegionalOrganization(source, { confirmedRegions = false, sharedPosition = 'unverified', placements = {}, bundles = [], unknownStyle = true, deduplicate = true, keepDuplicates = [] } = {}) {
    const issues = [], boundaries = [], chunks = [], items = [], moves = [], review = [], regions = [];
    const empty = () => ({ source, supported: false, proposed: null, issues: [...new Set(issues)], items, moves, review, regions, sections: [], regional: true });
    if (!confirmedRegions) issues.push('Confirm each editable chunk describes one character.');
    if (!['first', 'last', 'none'].includes(sharedPosition)) issues.push('Choose which chunk is shared, or explicitly choose None.');
    if (source.length > 20000) { issues.push('This preview supports up to 20,000 characters.'); return empty(); }
    // Separator rows include their exact trailing newline. No inline/custom separators.
    let start = 0;
    for (const match of source.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
        if (!match[0]) continue;
        if (match[0].replace(/[\r\n]+$/, '').trim() !== '---') continue;
        chunks.push({ start, end: match.index });
        boundaries.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
        start = match.index + match[0].length;
    }
    chunks.push({ start, end: source.length });
    if (!boundaries.length || source.replace(/^[ \t]*---[ \t]*(?:\r\n|\r|\n|$)/gm, '').includes('---')) issues.push('Use standalone literal --- separator rows; inline/custom separators are unsupported.');
    const editable = chunks.length - (sharedPosition === 'none' ? 0 : 1);
    if (editable < 2 || editable > 8 || chunks.length > 9) issues.push('Use two to eight editable chunks, with at most one shared chunk.');
    if (!placements || typeof placements !== 'object' || Array.isArray(placements) || !Array.isArray(bundles)) { issues.push('Invalid regional choices.'); return empty(); }
    let offset = 0;
    for (const [index, chunk] of chunks.entries()) {
        const text = source.slice(chunk.start, chunk.end);
        const shared = sharedPosition === 'first' && index === 0 || sharedPosition === 'last' && index === chunks.length - 1;
        if (!text.trim() || tokenize(text).issues.length) issues.push(`Chunk ${index + 1} is empty or contains a construct spanning boundaries.`);
        const tokens = tokenize(text).tokens;
        regions.push({ ...chunk, index, shared, text, offset, tokenCount: tokens.length });
        offset += tokens.length;
    }
    if (issues.length) return empty();
    return organizeScopes(source, regions, { placements, bundles, unknownStyle, deduplicate, keepDuplicates }, { boundaries });
}

function organizeScopes(source, regions, { placements, bundles, unknownStyle, deduplicate, keepDuplicates }, { boundaries = [], characterBlocks = false, segmented = false, breakImport = false } = {}) {
    const issues = [], items = [], moves = [], review = [], edits = [], duplicates = [];
    const controls = breakImport ? { breaks: boundaries, segments: regions, issues: [] } : standaloneBreaks(source); issues.push(...controls.issues);
    if (controls.segments.some(segment => tokenize(segment.text).issues.length)) issues.push('A construct spans a BREAK boundary.');
    // Flatten only editable text into independent BREAK segments. Shared source
    // stays locked. Segment gaps contain the exact original control rows.
    let offset = 0;
    regions = regions.flatMap(region => {
        const local = standaloneBreaks(region.text);
        if (!region.shared) {
            issues.push(...compatibilityIssues(local.masked));
            if (!local.masked.trim()) issues.push('An editable region contains no positive prompt tags.');
        }
        const pieces = !region.shared && local.breaks.length ? local.segments : [{ start: 0, end: region.text.length, text: region.text }];
        return pieces.map((piece, segmentIndex) => {
            const item = { ...region, parentIndex: region.index, start: region.start + piece.start, end: region.start + piece.end, text: piece.text,
                title: local.breaks.length && !region.shared ? `${region.title ?? 'Chunk ' + (region.index + 1)} · segment ${segmentIndex + 1}` : region.title,
                segmentIndex, empty: !piece.text.trim(), offset, tokenCount: tokenize(piece.text).tokens.length };
            offset += item.tokenCount;
            if (tokenize(piece.text).issues.length) issues.push('A construct spans a BREAK or ownership boundary.');
            return item;
        });
    }).map((region, index) => ({ ...region, index }));
    const empty = () => ({ source, supported: false, proposed: null, issues, items, moves, review, regions, boundaries, sections: [], regional: !characterBlocks && !segmented && !breakImport, characterBlocks, segmented, breakImport, breaks: controls.breaks });
    if (issues.length) return empty();
    const owner = index => Number.isInteger(index) ? regions.find(region => index >= region.offset && index < region.offset + region.tokenCount
        && tokenize(region.text).tokens[index - region.offset].text.trim()) : null;
    if (typeof deduplicate !== 'boolean' || !Array.isArray(keepDuplicates) || keepDuplicates.some(index => !owner(index) || owner(index).shared)) issues.push('Invalid duplicate choices or a choice targets locked shared text.');
    if (issues.length) return empty();
    for (const key of Object.keys(placements)) if (!/^(0|[1-9]\d*)$/.test(key) || !owner(Number(key)) || owner(Number(key)).shared) issues.push('A placement targets a missing item or the locked shared chunk.');
    for (const bundle of bundles) {
        const first = owner(bundle?.start), last = owner(bundle?.end);
        if (!first || first.shared || !last || first.index !== last.index) issues.push('Bundles cannot cross regional boundaries or include the shared chunk.');
    }
    if (issues.length) return empty();
    let proposed = source;
    for (const region of regions) {
        if (region.shared || region.empty) continue;
        const localPlacements = Object.fromEntries(Object.entries(placements).filter(([key]) => owner(Number(key))?.index === region.index).map(([key, module]) => [Number(key) - region.offset, module]));
        const localBundles = bundles.filter(bundle => owner(bundle.start)?.index === region.index).map(bundle => ({ ...bundle, start: bundle.start - region.offset, end: bundle.end - region.offset }));
        const result = previewOrganization(region.text, { confirmedSolo: true, placements: localPlacements, bundles: localBundles, unknownStyle, deduplicate,
            keepDuplicates: keepDuplicates.filter(index => owner(index)?.index === region.index).map(index => index - region.offset) });
        region.result = result;
        duplicates.push(...result.duplicates?.map(item => ({ ...item, index: item.index + region.offset, keptIndex: item.keptIndex + region.offset,
            regionIndex: region.index, scopeLabel: region.title ?? `Chunk ${region.index + 1}` })) ?? []);
        items.push(...result.items.map(item => ({ ...item, index: item.index + region.offset, regionIndex: region.index, scopeLabel: region.title ?? `Chunk ${region.index + 1}`,
            bundleIndex: item.bundleIndex === null ? null : bundles.findIndex(bundle => bundle.start === localBundles[item.bundleIndex].start + region.offset) })));
        moves.push(...result.moves.map(move => ({ ...move, originalIndex: move.originalIndex + region.offset, regionIndex: region.index, scopeLabel: region.title ?? `Chunk ${region.index + 1}` })));
        review.push(...result.review.map(item => ({ ...item, reason: `Chunk ${region.index + 1}: ${item.reason}` })));
        issues.push(...result.issues.map(issue => `Chunk ${region.index + 1}: ${issue}`));
    }
    if (items.length > 200) issues.push('This preview supports up to 200 editable items in total.');
    if (!issues.length) for (const region of [...regions].reverse()) {
        if (region.shared || region.empty) continue;
        const leading = region.text.match(/^\s*/)[0], trailing = region.text.match(/\s*$/)[0];
        const eol = region.text.match(/\r\n|\n|\r/)?.[0] ?? source.match(/\r\n|\n|\r/)?.[0] ?? '\n';
        const nonempty = region.result.sections.filter(section => section.tags.length);
        const hasHeader = /(?:\r\n|\n|\r)$/.test(leading) && leading.replace(/(?:\r\n|\n|\r)$/, '').split(/\r\n|\n|\r/).at(-1) === '';
        const externalHeader = characterBlocks && organizationRows(source.slice(0, region.start)).at(-2)?.text === '';
        const header = hasHeader || externalHeader ? '' : breakImport && !/[\r\n]$/.test(source.slice(0, region.start)) ? eol + eol
            : leading && !/(?:\r\n|\n|\r)$/.test(leading) ? eol + eol : eol;
        const body = header + nonempty.map((section, index) => section.tags.join(', ')
            + (index < nonempty.length - 1 || region.text.trimEnd().endsWith(',') ? ',' : '')).join(eol + eol);
        const replacement = leading + body + trailing;
        edits.push({ start: region.start, end: region.end, replacement, scopeLabel: region.title ?? `Chunk ${region.index + 1}` });
        proposed = proposed.slice(0, region.start) + replacement + proposed.slice(region.end);
    }
    return { source, supported: !issues.length, proposed: issues.length ? null : proposed, issues: [...new Set(issues)], items, moves, review, regions, boundaries, edits, duplicates, sections: [], regional: !characterBlocks && !segmented && !breakImport, characterBlocks, segmented, breakImport, breaks: controls.breaks };
}

/** Read-only candidates. Only row-leading uppercase BREAK is recognized, followed
 * by whitespace or end of row. Delimiter bytes are kept outside editable spans. */
export function detectBreakImport(source) {
    const issues = [], chunks = [], boundaries = [];
    if (typeof source !== 'string' || source.length > 20000) return { source, chunks, boundaries, issues: ['BREAK import supports up to 20,000 source characters.'] };
    const rows = organizationRows(source); let start = 0;
    for (const row of rows) {
        const match = row.text.match(/^[\t ]*BREAK(?=[\t ]|$)[\t ]*/);
        if (!match) continue;
        const end = match[0].length === row.text.length ? rows[row.index + 1]?.start ?? source.length : row.start + match[0].length;
        chunks.push({ start, end: row.start, text: source.slice(start, row.start) });
        boundaries.push({ start: row.start, end, text: source.slice(row.start, end) }); start = end;
    }
    chunks.push({ start, end: source.length, text: source.slice(start) });
    if (!boundaries.length || chunks.length > 12) issues.push('Use row-leading uppercase BREAK with two to eight character blocks and at most four shared blocks.');
    for (const [index, chunk] of chunks.entries()) {
        const tokens = tokenize(chunk.text).tokens.map(token => token.text.trim()).filter(Boolean);
        const problems = compatibilityIssues(chunk.text).filter(issue => issue !== 'Multiple character counts require raw mode.');
        if (!tokens.length || problems.length) issues.push(`Block ${index + 1} is empty, unsupported, or contains a construct/control spanning a boundary.`);
        chunk.suggestedRole = /^1(?:girl|boy|other)$/i.test(tokens[0] ?? '') ? 'character' : 'shared';
    }
    return { source, chunks, boundaries, issues: [...new Set(issues)] };
}

/** Reviewed import only. BREAK suggests boundaries, never automatic ownership. */
export function previewBreakImport(source, { confirmedImport = false, importRoles = [], placements = {}, bundles = [], unknownStyle = true, deduplicate = true, keepDuplicates = [] } = {}) {
    const detected = detectBreakImport(source), issues = [...detected.issues];
    const empty = () => ({ source, supported: false, proposed: null, issues: [...new Set(issues)], items: [], moves: [], review: [], regions: [], sections: [], edits: [], breakImport: true, characterBlocks: true });
    if (!confirmedImport) issues.push('Confirm every shared and character block and the BREAK boundaries before previewing.');
    if (!Array.isArray(importRoles) || importRoles.length !== detected.chunks.length || importRoles.some(role => !['shared','character'].includes(role))) issues.push('Detect candidate blocks and review a role for every block.');
    if (!placements || typeof placements !== 'object' || Array.isArray(placements) || !Array.isArray(bundles)) issues.push('Invalid import choices.');
    if (issues.length) return empty();
    const owners = importRoles.filter(role => role === 'character').length, shared = importRoles.length - owners;
    if (owners < 2 || owners > 8 || shared > 4) issues.push('Confirm two to eight character blocks and at most four shared blocks.');
    const kinds = [], declarations = [];
    const regions = detected.chunks.map((chunk,index) => {
        const tokens = tokenize(chunk.text).tokens.map(token => token.text.trim()).filter(Boolean);
        const counts = chunk.text.match(/\b\d+(?:girl|boy|other)s?\b/gi) ?? [];
        const shared = importRoles[index] === 'shared';
        if (!shared) {
            if (!/^1(?:girl|boy|other)$/i.test(tokens[0] ?? '') || counts.length !== 1) issues.push(`Block ${index + 1} must begin with exactly one plain 1girl, 1boy or 1other tag.`);
            else kinds.push(tokens[0].slice(1).toLowerCase());
        } else for (const count of counts) {
            if (!tokens.some(tag => tag.toLowerCase() === count.toLowerCase()) || !/^[2-8](?:girls|boys|others)$/i.test(count)) issues.push('Shared count declarations must be plain aggregate tags; single/weighted counts need manual organization.');
            else declarations.push(count.toLowerCase());
        }
        return { ...chunk, index, shared, title: `${shared ? 'Shared' : 'Character'} block ${index + 1}` };
    });
    if (declarations.length > 1 || declarations.length === 1 && (Number(declarations[0][0]) !== owners || kinds.some(kind => kind !== declarations[0].slice(1,-1)))) issues.push('The shared count does not agree with the confirmed character blocks. Resolve the count or ownership manually.');
    if (issues.length) return empty();
    const result = organizeScopes(source, regions, { placements, bundles, unknownStyle, deduplicate, keepDuplicates }, { boundaries: detected.boundaries, characterBlocks: true, breakImport: true });
    for (const region of result.regions.filter(region => !region.shared && region.result?.supported)) {
        if (region.result.items[0]?.module !== 3 || region.result.items.some(item => item.module < 3)) result.issues.push(`${region.title}: import organizes L3–L7; keep shared quality/camera/actions outside character blocks.`);
    }
    if (result.issues.length) { result.supported = false; result.proposed = null; result.edits = []; }
    return result;
}

export function organizationRows(source) {
    const rows = []; let start = 0;
    for (const match of source.matchAll(/\r\n|\n|\r/g)) {
        rows.push({ index: rows.length, start, end: match.index, text: source.slice(start, match.index) });
        start = match.index + match[0].length;
    }
    rows.push({ index: rows.length, start, end: source.length, text: source.slice(start) });
    return rows;
}

/** Ordinary multi-character ownership is supplied explicitly, never guessed from tags. */
export function previewCharacterOrganization(source, { confirmedCharacters = false, characterRanges = [], placements = {}, bundles = [], unknownStyle = true, deduplicate = true, keepDuplicates = [] } = {}) {
    const controls = standaloneBreaks(source);
    const issues = [...compatibilityIssues(controls.masked).filter(issue => issue !== 'Multiple character counts require raw mode.'), ...controls.issues];
    const empty = () => ({ source, supported: false, proposed: null, issues: [...new Set(issues)], items: [], moves: [], review: [], regions: [], sections: [], regional: false, characterBlocks: true });
    if (!confirmedCharacters) issues.push('Confirm each editable character block describes one character.');
    if (source.length > 20000) issues.push('This preview supports up to 20,000 characters.');
    if (!Array.isArray(characterRanges) || characterRanges.length < 2 || characterRanges.length > 8) issues.push('Confirm two to eight character line ranges.');
    if (!placements || typeof placements !== 'object' || Array.isArray(placements) || !Array.isArray(bundles)) issues.push('Invalid character-block choices.');
    if (issues.length) return empty();
    const rows = organizationRows(source);
    const valid = index => Number.isInteger(index) && rows[index]?.text.trim();
    for (const range of characterRanges) {
        if (!range || !valid(range.first) || !valid(range.last) || range.last < range.first) issues.push('Invalid character line range.');
        else if (!/^\s*1(?:girl|boy|other)\s*(?:,|$)/i.test(rows[range.first].text)) issues.push('Each character range must start on its explicit 1girl/1boy/1other row.');
    }
    if (issues.length) return empty();
    const ordered = characterRanges.map(range => ({ ...range })).sort((a, b) => a.first - b.first);
    if (ordered.some((range, index) => index > 0 && range.first <= ordered[index - 1].last)) issues.push('Character ranges must not overlap.');
    if (issues.length) return empty();
    const regions = []; let cursor = 0, number = 0, offset = 0;
    function append(start, end, shared, title) {
        if (start === end) return;
        const text = source.slice(start, end), tokens = tokenize(text);
        if (tokens.issues.length) issues.push('A construct spans a character/shared boundary.');
        regions.push({ start, end, shared, title, text, index: regions.length, offset, tokenCount: tokens.tokens.length });
        offset += tokens.tokens.length;
    }
    for (const range of ordered) {
        const start = rows[range.first].start, end = rows[range.last].end;
        append(cursor, start, true, 'Shared text · locked');
        const text = source.slice(start, end);
        const counts = text.match(/\b\d+(?:girl|boy|other)s?\b/gi) ?? [];
        if (counts.length !== 1 || parseInt(counts[0], 10) !== 1) issues.push('Each editable block needs exactly one explicit single-character count.');
        append(start, end, false, `Character block ${++number}`); cursor = end;
    }
    append(cursor, source.length, true, 'Shared text · locked');
    if (issues.length) return empty();
    const result = organizeScopes(source, regions, { placements, bundles, unknownStyle, deduplicate, keepDuplicates }, { characterBlocks: true });
    if (result.supported) for (const parent of new Set(result.regions.filter(region => !region.shared).map(region => region.parentIndex))) {
        const owned = result.regions.filter(region => !region.shared && region.parentIndex === parent);
        const ownedItems = owned.flatMap(region => region.result?.items ?? []);
        const region = owned[0];
        if (ownedItems[0]?.module !== 3 || ownedItems.some(item => item.module < 3)) {
            result.issues.push(`${region.title}: keep the count in L3 and camera/quality text outside the selected range. This mode organizes L3–L7 only.`);
        }
    }
    if (result.issues.length) { result.supported = false; result.proposed = null; result.edits = []; }
    return result;
}
