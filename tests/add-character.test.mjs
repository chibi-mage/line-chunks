import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarterTemplate, assignStarterTemplate, planCharacterAddition, applyCharacterAddition, updateAssignments } from '../javascript/mdpf-assignments.mjs';
import { inspectPrompt } from '../javascript/mdpf-core.mjs';

for (const type of ['solo', 'pair']) test(`ordinary ${type}: inserts ahead of shared tail and preserves every old row`, () => {
    const state = assignStarterTemplate(buildStarterTemplate(type));
    const plan = planCharacterAddition(state, { count: '1boy', placement: 'boy next to girl,' });
    assert.equal(plan.supported, true, plan.message);
    assert.equal(plan.number, type === 'solo' ? 2 : 3);
    const tail = state.rows.find(row => row.module === 6 && !row.templateCharacter);
    assert.ok(plan.at <= tail.start);
    assert.equal(plan.proposed.slice(0, plan.at) + plan.proposed.slice(plan.at + plan.fragment.length), state.source);
    const next = applyCharacterAddition(state, plan);
    assert.ok(next);
    for (const old of state.rows) {
        const row = next.rows.find(row => row.id === old.id);
        assert.ok(row, old.id); assert.equal(row.text, old.text); assert.equal(row.module, old.module);
    }
    const added = next.rows.filter(row => row.templateCharacter === plan.number);
    assert.deepEqual(added.map(row => row.module), [3, 4, 5]);
    assert.equal(added[0].text, '1boy,');
    assert.equal(next.rows.find(row => row.text === 'boy next to girl,').kind, 'placement');
    assert.equal(new Set(next.rows.map(row => row.id)).size, next.rows.length);
});

for (let count = 2; count <= 7; count++) for (const globalPosition of ['first', 'last', 'none']) test(`Couple ${count} → ${count + 1}, shared ${globalPosition}`, () => {
    const state = assignStarterTemplate(buildStarterTemplate('couple', { characters: count, globalPosition }));
    const plan = planCharacterAddition(state, { mode: 'couple', globalPosition, count: '1other' });
    assert.equal(plan.supported, true, plan.message);
    const next = applyCharacterAddition(state, plan);
    assert.ok(next);
    assert.equal(plan.proposed.slice(0, plan.at) + plan.proposed.slice(plan.at + plan.fragment.length), state.source);
    assert.equal(next.rows.filter(row => row.text.trim() === '---').length, state.rows.filter(row => row.text.trim() === '---').length + 1);
    assert.ok(next.rows.filter(row => row.text.trim() === '---').every(row => row.protected));
    assert.equal(next.rows.filter(row => row.module === 3 && row.templateSlot).length, count + 1);
    assert.deepEqual(next.rows.filter(row => row.templateCharacter === count + 1).map(row => row.module), [3, 4, 5, 6]);
    for (const old of state.rows.filter(row => row.templateSlot || row.header)) {
        const row = next.rows.find(row => row.id === old.id);
        assert.ok(row, old.id); assert.equal(row.text, old.text); assert.equal(row.templateCharacter, old.templateCharacter);
    }
    const shared = next.rows.filter(row => row.templateSlot && !row.templateCharacter);
    if (globalPosition === 'last') assert.ok(shared.every(row => row.start > next.rows.find(row => row.text === '1other,').start));
    if (globalPosition === 'first') assert.ok(shared.every(row => row.start < next.rows.find(row => row.text === '1other,').start));
    assert.equal(new Set(next.rows.map(row => row.id)).size, next.rows.length);
});

test('repeated additions reach eight owners without changing old source or label identities', () => {
    let state = assignStarterTemplate(buildStarterTemplate('pair'));
    for (let count = 3; count <= 8; count++) {
        const plan = planCharacterAddition(state);
        assert.equal(plan.supported, true, plan.message);
        state = applyCharacterAddition(state, plan);
        assert.equal(state.rows.filter(row => row.templateSlot && row.module === 3).length, count);
    }
    assert.equal(planCharacterAddition(state).supported, false);
});
test('stale plans do not apply after a draft change', () => {
    const state = assignStarterTemplate(buildStarterTemplate('pair'));
    const plan = planCharacterAddition(state);
    assert.equal(applyCharacterAddition({ ...state, source: state.source + 'changed' }, plan), null);
});
test('unsupported layouts, invalid choices and unsafe placement controls block insertion', () => {
    const state = assignStarterTemplate(buildStarterTemplate('pair'));
    for (const placement of ['', 'a\nb', 'BREAK', '---', 'AND']) assert.equal(planCharacterAddition(state, { placement }).supported, false);
    for (const count of ['2girls', '', 'solo']) assert.equal(planCharacterAddition(state, { count }).supported, false);
    assert.equal(planCharacterAddition(assignStarterTemplate(buildStarterTemplate('couple', { characters: 8 })), { mode: 'couple' }).supported, false);
    assert.equal(planCharacterAddition(state, { mode: 'couple' }).supported, false);
    assert.equal(planCharacterAddition({ source: '', rows: [] }).supported, false);
    const raw = updateAssignments(null, '1girl, blue hair, blue dress,', { supported: false });
    assert.equal(planCharacterAddition(raw).supported, false);
});
test('authored content, continued outfits and shared source bytes survive insertion', () => {
    let state = assignStarterTemplate(buildStarterTemplate('pair'));
    for (const module of [4, 6, 7]) {
        const row = state.rows.find(row => row.templateSlot && row.module === module);
        const text = module === 4 ? 'red coat,\nwhite gloves,' : module === 6 ? 'castle, moonlight,' : '<lora:example:0.5>, trigger,';
        const source = state.source.slice(0, row.start) + text + state.source.slice(row.end);
        state = updateAssignments(state, source, { supported: false }, { reason: 'typing', edit: { source: state.source, start: row.start, end: row.end } });
    }
    const next = applyCharacterAddition(state, planCharacterAddition(state));
    for (const text of ['red coat,\nwhite gloves,', 'castle, moonlight,', '<lora:example:0.5>, trigger,']) assert.ok(next.source.includes(text));
    assert.equal(next.rows.filter(row => row.templateContinuation).length, 1);
});
test('a detected ordinary seven-section prompt supports insertion without requiring a starter', () => {
    const source = 'masterpiece,\nstanding,\n1girl, solo, blue hair,\nblue dress,\nsmile,\ncastle,\n<lora:style:0.5>,';
    const state = updateAssignments(null, source, inspectPrompt(source));
    const plan = planCharacterAddition(state);
    assert.equal(plan.supported, true, plan.message);
    assert.equal(plan.number, 2);
    assert.ok(plan.proposed.indexOf('girl next to girl,') < plan.proposed.indexOf('castle,'));
    assert.ok(plan.proposed.includes('1girl, solo, blue hair,'), 'No existing solo tag is silently deleted');
});
test('mixed inline separators and competing regional counts require manual editing', () => {
    for (const source of ['masterpiece,\n---\n1girl, 2girls,\n---\n1boy,', 'masterpiece,\n---\n1girl, inline --- boundary,\n---\n1boy,']) {
        const state = updateAssignments(null, source, { supported: false });
        assert.equal(planCharacterAddition(state, { mode: 'couple' }).supported, false);
    }
});
