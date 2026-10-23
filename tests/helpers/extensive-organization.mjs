import assert from 'node:assert/strict';
import { previewOrganization, previewRegionalOrganization, previewCharacterOrganization, organizationRows, characterOrderRank, outfitOrderRank, expressionOrderRank } from '../../javascript/mdpf-organize.mjs';
import { tokenize } from '../../javascript/mdpf-core.mjs';

export const tokenTexts = source => tokenize(source).tokens.map(item => item.text.trim()).filter(Boolean);
export const retainedTokenTexts = (source, result) => {
    const tokens = tokenize(source).tokens;
    const removed = new Set();
    for (const item of result.duplicates ?? []) if (item.removed) {
        assert.equal(tokens[item.index].text.trim(), item.text);
        assert.equal(tokens[item.keptIndex].text.trim(), item.text);
        assert.ok(item.keptIndex < item.index);
        assert.equal(removed.has(item.index), false);
        removed.add(item.index);
    }
    return tokens.filter((item, index) => !removed.has(index)).map(item => item.text.trim()).filter(Boolean);
};
const planners = { solo: previewOrganization, regional: previewRegionalOrganization, characters: previewCharacterOrganization };

export function materialize(item, eol = '\n', layout = 'blob') {
    const options = { confirmedSolo: true, confirmedRegions: true, confirmedCharacters: true, ...item.options };
    if (item.source !== undefined) return { source: item.source.replaceAll('\n', eol), options, expected: [] };
    const render = (items, spaced = false, trailing = true) => items.map(entry => entry.text).join(spaced ? ',' + eol + eol : ', ') + (trailing ? ',' : '');
    if (item.mode === 'solo') {
        const groups = layout === 'blob' ? [item.items] : Array.from({ length: 7 }, (_, index) => item.items.filter(entry => entry.module === index + 1));
        const source = layout === 'blob' ? render(item.items, false, item.trailingComma)
            : groups.map(group => render(group, false, true)).join(layout === 'spaced' ? eol + eol : eol);
        // Empty sections are blank rows, not empty comma fields.
        const clean = source.replace(/(^|[\r\n]),(?=[\r\n]|$)/g, '$1');
        return { source: clean, options, expected: [layout === 'blob' ? item.items : groups.flat()] };
    }
    if (item.mode === 'regional') {
        const chunks = item.chunks.map(chunk => render(chunk, item.spaced));
        const shared = item.shared.replaceAll('\n', eol);
        if (item.sharedPosition === 'first') chunks.unshift(shared);
        if (item.sharedPosition === 'last') chunks.push(shared);
        return { source: chunks.join(eol + (item.padded ? ' \t--- ' : '---') + eol),
            options: { ...options, sharedPosition: item.sharedPosition }, expected: item.chunks };
    }
    const lines = ['masterpiece, shared_composition_44,', 'standing, from front,', ''];
    const characterRanges = [];
    for (const [index, chunk] of item.chunks.entries()) {
        const first = lines.length;
        // Explicit count must lead each block, remaining tags deliberately shuffled.
        const count = chunk.filter(entry => /^1(?:girl|boy|other)$/.test(entry.text));
        const rest = chunk.filter(entry => !count.includes(entry));
        const ordered = [...count, ...rest.slice().reverse()];
        for (const entry of ordered) { lines.push(entry.text + ','); if (item.spaced) lines.push(''); }
        const last = lines.length - (item.spaced ? 2 : 1);
        characterRanges.push({ first, last });
        lines.push('', `shared_relationship_${index}, forest,`, '');
    }
    lines.push('<lora:shared_sample:0.4>, global_style_92,', '');
    return { source: lines.join(eol), options: { ...options, characterRanges: item.reverseRanges ? characterRanges.reverse() : characterRanges },
        expected: item.chunks.map(chunk => [...chunk.filter(entry => /^1(?:girl|boy|other)$/.test(entry.text)), ...chunk.filter(entry => !/^1(?:girl|boy|other)$/.test(entry.text)).reverse()]) };
}

export function variants(item) {
    return ['\n', '\r\n', '\r'].flatMap(eol => (item.mode === 'solo' && !item.blocked ? ['blob', 'lines', 'spaced'] : ['blob'])
        .map(layout => ({ ...materialize(item, eol, layout), eol, layout })));
}

function auditedItems(result, expected) {
    const actual = result.regions ? result.regions.filter(region => !region.shared).map(region => region.result?.items ?? []) : [result.items];
    return actual.flatMap((items, regionIndex) => {
        const wanted = expected[regionIndex];
        assert.equal(items.length, wanted.length, 'Every authored editable item must remain visible');
        return items.map((entry, index) => {
            assert.equal(entry.text, wanted[index].text, 'Original editable token order');
            const global = result.regions ? result.items.find(item => item.regionIndex === result.regions.filter(region => !region.shared)[regionIndex].index && item.index === entry.index + result.regions.filter(region => !region.shared)[regionIndex].offset) : entry;
            return { ...global, expected: wanted[index].module };
        });
    });
}

export function evaluateCase(item, variant) {
    const plan = planners[item.mode];
    const initial = plan(variant.source, variant.options);
    assert.equal(initial.source, variant.source);
    if (item.blocked) return { initial, guardMiss: initial.supported, differences: [], reviewed: null };
    const observed = auditedItems(initial, variant.expected);
    const differences = observed.filter(entry => entry.module !== entry.expected);
    // These are explicit synthetic reviewer choices from the authored intent, not learned mappings.
    const placements = {}, bundles = [];
    for (const entry of differences) {
        if (/^<lora:/i.test(entry.text) && entry.expected !== 7) bundles.push({ start: entry.index, end: entry.index, module: entry.expected });
        else placements[entry.index] = entry.expected;
    }
    const reviewed = plan(variant.source, { ...variant.options, placements, bundles });
    assert.equal(reviewed.supported, true, reviewed.issues.join('\n'));
    assert.deepEqual(auditedItems(reviewed, variant.expected).map(entry => entry.module), variant.expected.flat().map(entry => entry.module));
    verifyPreservation(variant.source, reviewed);
    // Explicit review must also be stable on the already-organized text.
    const locals = reviewed.regions ? reviewed.regions.filter(region => !region.shared).map(region => region.result) : [reviewed];
    for (const local of locals) {
        const byText = new Map(local.items.map(entry => [entry.text, entry.module]));
        const next = previewOrganization(local.proposed, { confirmedSolo: true });
        const placements = {}, bundles = [];
        for (const entry of next.items) if (entry.module !== byText.get(entry.text)) {
            const module = byText.get(entry.text);
            if (/^<lora:/i.test(entry.text) && module !== 7) bundles.push({ start: entry.index, end: entry.index, module });
            else placements[entry.index] = module;
        }
        const repeated = previewOrganization(local.proposed, { confirmedSolo: true, placements, bundles });
        assert.equal(repeated.proposed, local.proposed, 'Repeated reviewed organization must be stable');
    }
    if (reviewed.regions) {
        const nextOptions = { ...variant.options };
        if (item.mode === 'characters') {
            const rows = organizationRows(reviewed.proposed); let shift = 0;
            nextOptions.characterRanges = [...reviewed.edits].sort((a, b) => a.start - b.start).map(edit => {
                const start = edit.start + shift, end = start + edit.replacement.length;
                const owned = rows.filter(row => row.start >= start && row.end <= end && row.text.trim());
                shift += edit.replacement.length - (edit.end - edit.start);
                return { first: owned[0].index, last: owned.at(-1).index };
            });
        }
        const next = plan(reviewed.proposed, nextOptions), placements = {}, bundles = [];
        const prior = reviewed.regions.filter(region => !region.shared);
        for (const [index, region] of next.regions.filter(region => !region.shared).entries()) {
            const byText = new Map(prior[index].result.items.map(entry => [entry.text, entry.module]));
            for (const entry of region.result.items) if (entry.module !== byText.get(entry.text)) {
                const module = byText.get(entry.text), target = entry.index + region.offset;
                if (/^<lora:/i.test(entry.text) && module !== 7) bundles.push({ start: target, end: target, module });
                else placements[target] = module;
            }
        }
        assert.equal(plan(reviewed.proposed, { ...nextOptions, placements, bundles }).proposed, reviewed.proposed,
            'Whole scoped proposal must remain stable after reconfirming current ownership');
    }
    return { initial, reviewed, differences, guardMiss: false };
}

export function verifyPreservation(source, result) {
    assert.equal(result.supported, true);
    if (!result.regions) {
        assert.deepEqual(tokenTexts(result.proposed).sort(), retainedTokenTexts(source, result).sort(), 'Preserve all tokens except explicitly audited duplicate removals');
        const ordered = [...result.moves].sort((a, b) => a.module - b.module).map(move => move.text);
        // Reviewed L3/L4 appearance, automatic L5 gaze prefixes and standalone L1 Pony scores may change order.
        // Independent focused tests assert the anatomical sequence and barriers.
        const ponyScores = result.moves.filter(move => move.module === 1 && move.bundleIndex === null && /^score[ _][1-9](?:[ _]up)?$/i.test(move.text.trim())).map(move => move.text);
        const reordered = new Set([...ponyScores, ...result.moves.filter(move => move.placement === 'automatic'
            && move.bundleIndex === null && !/[()\[\]{}<>\\\r\n]/.test(move.text) && (
                move.module === 3 && characterOrderRank(move.text) !== null || move.module === 4 && outfitOrderRank(move.text) !== null
                || move.module === 5 && expressionOrderRank(move.text) === 0)).map(move=>move.text)]);
        assert.deepEqual(tokenTexts(result.proposed).filter(text=>!reordered.has(text)), ordered.filter(text=>!reordered.has(text)), 'Stable source order outside reviewed appearance, gaze-prefix and Pony score moves');
        return;
    }
    let sourceEnd = 0, outputEnd = 0;
    for (const edit of [...result.edits].sort((a, b) => a.start - b.start)) {
        const shared = source.slice(sourceEnd, edit.start);
        assert.equal(result.proposed.slice(outputEnd, outputEnd + shared.length), shared, 'Shared bytes and boundary rows must be unchanged');
        outputEnd += shared.length;
        assert.equal(result.proposed.slice(outputEnd, outputEnd + edit.replacement.length), edit.replacement);
        const region = result.regions.find(region => region.start === edit.start && region.end === edit.end);
        assert.deepEqual(tokenTexts(edit.replacement).sort(), retainedTokenTexts(region.text, region.result).sort(), 'Only audited local repeats may be removed; no cross-character leakage');
        outputEnd += edit.replacement.length; sourceEnd = edit.end;
    }
    assert.equal(result.proposed.slice(outputEnd), source.slice(sourceEnd), 'Locked suffix exact');
    // Empty BREAK segments have no local proposal; their exact bytes are already
    // checked as unchanged gaps between the edited source spans above.
    for (const region of result.regions.filter(region => !region.shared && !region.empty)) verifyPreservation(region.text, region.result);
}
