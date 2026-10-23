import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarterTemplate, assignStarterTemplate, updateAssignments, setLineAssignment, planCharacterAddition, applyCharacterAddition } from '../javascript/mdpf-assignments.mjs';
import { serializeDraft, parseDraft, restoreDraft } from '../javascript/mdpf-drafts.mjs';
import { inspectPrompt } from '../javascript/mdpf-core.mjs';
import { inspectStructure } from '../javascript/mdpf-structure.mjs';
import { previewOrganization, previewRegionalOrganization, previewCharacterOrganization } from '../javascript/mdpf-organize.mjs';
import { previewWithLineAssignments, organizedLineAssignments } from '../javascript/mdpf-line-organization.mjs';
import { verifyPreservation } from './helpers/extensive-organization.mjs';

const pools = [
    { 1: 'masterpiece, best quality, newest,', 2: 'cowboy shot, standing, holding hat,', 3: 'blue hair, green eyes, freckles, long arms,', 4: 'wet clothes, gold bracelet, blue coat, boots, blue coat,', 5: 'looking at viewer, shy smile,', 6: 'castle, throne, stone wall, moonlight,', 7: '<lora:example_style:0.7>, example_trigger,' },
    { 1: 'score_7_up, score_9, score_8_up, best quality,', 2: 'portrait, face focus, brushing hair,', 3: 'red hair, french braid, ahoge, white pupils, scar on cheek,', 4: 'torn clothes, hair ribbon, glasses, serafuku, detached sleeves, socks, serafuku,', 5: 'looking up, looking to the side, worried, narrowed eyes,', 6: 'rooftop, night, city, sparks, blue aura,', 7: 'official style, monochrome, unknown_trigger_190,' },
    { 1: 'cinematic lighting, volumetric lighting, anime coloring,', 2: 'from side, sitting, crossed legs, holding sword,', 3: 'black hair, brown eyes, black nails, fox tail, horns,', 4: 'nude, crown, collar, gauntlets, breastplate, black boots, sword, sword,', 5: 'looking at another, talking, clenched teeth,', 6: 'forest, river, water, sunlight, embers,', 7: '<lora:ink_example:0.5>, ink_example,' },
];
function replaceRow(state, row, text) {
    const source = state.source.slice(0, row.start) + text + state.source.slice(row.end);
    return updateAssignments(state, source, { supported: false }, { reason: 'typing', edit: { source: state.source, start: row.start, end: row.end } });
}
function saveOpen(state, options) {
    const text = serializeDraft(state, { enabled: true, compact: !!state.headingRows, coupleHint: options.mode === 'couple' ? { separator: '---', sharedPosition: options.globalPosition } : null });
    const result = restoreDraft(parseDraft(text)).state;
    assert.equal(result.source, state.source);
    return result;
}
function plan(state, options) {
    if (options.mode === 'couple') return previewWithLineAssignments(previewRegionalOrganization, state.source, { confirmedRegions: true, sharedPosition: options.globalPosition, deduplicate: true }, state);
    const owners = [...new Set(state.rows.filter(row => row.templateCharacter).map(row => row.templateCharacter))];
    if (owners.length <= 1) return previewWithLineAssignments(previewOrganization, state.source, { confirmedSolo: true, deduplicate: true }, state);
    const characterRanges = owners.map(owner => {
        const rows = state.rows.filter(row => row.templateCharacter === owner && row.text.trim());
        return { first: rows[0].index, last: rows.at(-1).index };
    });
    return previewWithLineAssignments(previewCharacterOrganization, state.source, { confirmedCharacters: true, characterRanges, deduplicate: true }, state);
}
const layouts = [['solo', {}], ['pair', {}]];
for (let characters = 2; characters <= 7; characters++) for (const globalPosition of ['first', 'last', 'none']) layouts.push(['couple', { characters, globalPosition }]);
for (const [type, layout] of layouts) for (let batch = 0; batch < pools.length; batch++) test(`complete draft workflow ${type} ${JSON.stringify(layout)} / pool ${batch + 1}`, () => {
    const options = { mode: type === 'couple' ? 'couple' : 'ordinary', ...layout };
    let state = assignStarterTemplate(buildStarterTemplate(type, layout));
    for (const id of state.rows.filter(row => row.templateSlot && row.module).map(row => row.id)) {
        const row = state.rows.find(row => row.id === id);
        if (row.module === 5 && row.templateCharacter % 2 === 0) continue;
        const value = pools[batch][row.module];
        state = replaceRow(state, row, row.module === 3 ? row.text + ' ' + value : value);
    }
    state = saveOpen(state, options);
    const lastOutfit = state.rows.filter(row => row.templateSlot && row.module === 4).at(-1);
    state = replaceRow(state, lastOutfit, lastOutfit.text + '\nwhite gloves,');
    assert.equal(state.rows.find(row => row.text === 'white gloves,').templateCharacter, lastOutfit.templateCharacter);
    state = saveOpen(state, options);
    const addition = planCharacterAddition(state, options);
    assert.equal(addition.supported, true, addition.message);
    const oldSource = state.source;
    state = applyCharacterAddition(state, addition);
    assert.equal(state.source.slice(0, addition.at) + state.source.slice(addition.at + addition.fragment.length), oldSource);
    const newOutfit = state.rows.find(row => row.templateCharacter === addition.number && row.module === 4);
    state = replaceRow(state, newOutfit, 'red jacket, red jacket, black boots,');
    state = saveOpen(state, options);
    const before = serializeDraft(state);
    const result = plan(state, options);
    assert.equal(result.supported, true, result.issues?.join('\n'));
    verifyPreservation(state.source, result);
    assert.ok(result.duplicates.some(row => row.removed));
    const doc = options.mode === 'couple' ? inspectStructure(result.proposed, { separator: '---', globalPosition: options.globalPosition }) : inspectPrompt(result.proposed);
    let organized = updateAssignments(null, result.proposed, doc.supported ? doc : inspectStructure(result.proposed));
    const explicit = organizedLineAssignments(result);
    for (const row of explicit.rows) {
        const target = organized.rows.find(candidate => candidate.start === row.start && candidate.end === row.end);
        assert.ok(target); organized = setLineAssignment(organized, target.id, row.module);
    }
    organized = saveOpen(organized, options);
    assert.equal(organized.source, result.proposed);
    // The page-local Revert snapshot must itself remain portable and exact.
    assert.equal(serializeDraft(restoreDraft(parseDraft(before)).state), before);
});

for (const [token, supported] of [['<lora:unverified_character:0.7>', false], ['(blue hair, smile:1.2)', true], ['__dynamic_character__', false]]) test(`import ${token} stays savable with explicit organization eligibility`, () => {
    let state = assignStarterTemplate(buildStarterTemplate('solo'));
    const character = state.rows.find(row => row.module === 3);
    state = replaceRow(state, character, '1girl, ' + token + ',');
    const reopened = saveOpen(state, { mode: 'ordinary' });
    const result = plan(reopened, { mode: 'ordinary' });
    assert.equal(result.supported, supported);
    if (!supported) assert.equal(result.proposed, null);
    else verifyPreservation(reopened.source, result);
    assert.equal(reopened.source, state.source);
});
