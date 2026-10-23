import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarterTemplate, assignStarterTemplate, updateAssignments } from '../javascript/mdpf-assignments.mjs';

test('solo starter has seven blank labeled sections and only explicit starter count tags', () => {
    const template = buildStarterTemplate('solo');
    assert.deepEqual(template.slots.map(s => s.module), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(template.source.replaceAll('\n', ''), '1girl, solo,');
});
test('ordinary pair places its relationship between independent character sections', () => {
    const template = buildStarterTemplate('pair');
    assert.deepEqual(template.slots.map(s => s.module), [1, 2, 3, 4, 5, null, 3, 4, 5, 6, 7]);
    assert.equal(template.source.replaceAll('\n', ''), '1girl,man next to girl,1boy,');
    assert.ok(!template.source.includes('---'));
    assert.deepEqual(template.slots.filter(s => s.module === 5).map(s => s.templateCharacter), [1, 2]);
});
for (let count = 2; count <= 8; count++) for (const globalPosition of ['first', 'last', 'none']) {
    test(`Couple starter supports ${count} owners, shared ${globalPosition}`, () => {
        const template = buildStarterTemplate('couple', { characters: count, globalPosition });
        const chunks = template.source.split('---');
        assert.equal(chunks.length, count + (globalPosition === 'none' ? 0 : 1));
        assert.equal((template.source.match(/1girl,/g) ?? []).length, count);
        assert.deepEqual(template.slots.filter(s => s.module === 3).map(s => s.templateCharacter), Array.from({ length: count }, (_, i) => i + 1));
        const state = assignStarterTemplate(template);
        assert.equal(state.rows.filter(r => r.templateSlot).length, template.slots.length);
        assert.equal(state.rows.filter(r => r.header).length, template.slots.length);
        assert.ok(state.rows.filter(r => r.text === '---').every(r => r.protected));
    });
}
test('blank slot labels and headers survive typing and Detect, external replacement clears them', () => {
    const template = buildStarterTemplate('pair');
    let state = assignStarterTemplate(template);
    const outfit = state.rows.find(r => r.templateCharacter === 2 && r.module === 4);
    const edited = template.source.slice(0, outfit.start) + 'blue shirt,' + template.source.slice(outfit.end);
    state = updateAssignments(state, edited, { supported: false }, { reason: 'typing' });
    assert.equal(state.rows.find(r => r.text === 'blue shirt,').module, 4);
    assert.equal(state.rows.find(r => r.text === 'blue shirt,').templateCharacter, 2);
    state = updateAssignments(state, edited, { supported: false }, { reason: 'redetect' });
    assert.equal(state.rows.filter(r => r.header).length, template.slots.length);
    assert.equal(state.headingRows, true);
    state = updateAssignments(state, '1girl, replacement,', { supported: false });
    assert.equal(state.rows.some(r => r.templateSlot), false);
});
test('invalid template configuration is rejected', () => {
    for (const characters of [1, 9, 2.5, NaN]) assert.throws(() => buildStarterTemplate('couple', { characters }));
    assert.throws(() => buildStarterTemplate('couple', { globalPosition: 'unknown' }));
    assert.throws(() => buildStarterTemplate('unknown'));
});
