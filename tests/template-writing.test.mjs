import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarterTemplate, assignStarterTemplate, updateAssignments } from '../javascript/mdpf-assignments.mjs';
import { inspectPrompt } from '../javascript/mdpf-core.mjs';
import { inspectStructure } from '../javascript/mdpf-structure.mjs';

const detect = source => { const doc = inspectPrompt(source); return doc.supported ? doc : inspectStructure(source); };
const edit = (state, start, end, text, reason = 'typing') => {
    const source = state.source.slice(0, start) + text + state.source.slice(end);
    const next = updateAssignments(state, source, detect(source), { reason, edit: { source: state.source, start, end } });
    assert.equal(next.source, source, 'Tracking must preserve exactly what was typed/pasted');
    return next;
};
const content = {
    1: ['masterpiece, best quality,', 'cinematic lighting,'],
    2: ['standing, holding hat,', 'cowboy shot,'],
    3: ['blue hair, green eyes,', 'freckles, long arms,'],
    4: ['blue shirt, gold bracelet,', 'socks, black boots,'],
    5: ['looking at viewer,', 'shy smile,'],
    6: ['castle, stone wall,', 'throne, moonlight,'],
    7: ['<lora:example_style:0.7>,', 'example_style,'],
};
const layouts = [['solo', {}], ['pair', {}]];
for (const characters of [2, 3, 4, 6, 8]) for (const globalPosition of ['first', 'last', 'none']) layouts.push(['couple', { characters, globalPosition }]);

for (const [type, options] of layouts) test(`authoring ${type} ${JSON.stringify(options)}: all section slots survive Enter, multiline paste, join, clearing and long wraps`, () => {
    const template = buildStarterTemplate(type, options);
    for (const slot of template.slots.filter(s => s.module)) {
        let state = assignStarterTemplate(template);
        const initial = state.rows[slot.index], group = initial.templateGroup;
        const untouched = state.rows.filter(r => r.templateSlot && r.templateGroup !== group).map(r => [r.id, r.module, r.templateCharacter]);
        const [a, b] = content[slot.module];
        // Start from either an actual empty slot or the editable count tag.
        const head = initial.text ? initial.text + ' ' : '';
        state = edit(state, initial.start, initial.end, head + a);
        let row = state.rows.find(r => r.id === initial.id);
        state = edit(state, row.end, row.end, '\n');
        let rows = state.rows.filter(r => r.templateGroup === group);
        assert.equal(rows.length, 2);
        assert.equal(rows[0].templateContinuation, false);
        assert.equal(rows[1].templateContinuation, true);
        assert.equal(rows[1].module, slot.module);
        assert.equal(rows[1].templateCharacter, slot.templateCharacter);
        // Paste two physical lines into the new continuation.
        state = edit(state, rows[1].start, rows[1].end, b + '\n' + a);
        rows = state.rows.filter(r => r.templateGroup === group);
        assert.equal(rows.length, 3);
        assert.ok(rows.every(r => r.module === slot.module && r.templateCharacter === slot.templateCharacter));
        // Backspace the newline within this one section; no boundary is crossed.
        state = edit(state, rows[0].end, rows[1].start, '');
        rows = state.rows.filter(r => r.templateGroup === group);
        assert.equal(rows.length, 2);
        assert.equal(rows[0].id, initial.id);
        // Long content wraps visually; it must remain one physical row/owner.
        const long = Array.from({ length: 30 }, () => a).join(' ');
        state = edit(state, rows[0].start, rows.at(-1).end, long);
        rows = state.rows.filter(r => r.templateGroup === group);
        assert.equal(rows.length, 1); assert.equal(rows[0].text, long);
        state = edit(state, rows[0].start, rows[0].end, '');
        rows = state.rows.filter(r => r.templateGroup === group);
        assert.equal(rows.length, 1); assert.equal(rows[0].templateSlot, true);
        assert.equal(rows[0].module, slot.module);
        const refreshed = updateAssignments(state, state.source, detect(state.source), { reason: 'redetect' });
        assert.equal(refreshed.rows.find(r => r.id === initial.id).module, slot.module);
        assert.deepEqual(state.rows.filter(r => r.templateSlot && r.templateGroup !== group).map(r => [r.id, r.module, r.templateCharacter]), untouched);
        assert.equal(new Set(state.rows.map(r => r.id)).size, state.rows.length);
    }
});

test('Enter on an empty slot uses the actual caret rather than guessing among adjacent blank rows', () => {
    const initial = assignStarterTemplate(buildStarterTemplate('pair'));
    for (const target of initial.rows.filter(r => r.templateSlot && !r.text)) {
        const state = edit(initial, target.start, target.end, '\n');
        const rows = state.rows.filter(r => r.templateGroup === target.templateGroup);
        assert.equal(rows.length, 2);
        assert.equal(rows[1].module, target.module);
        assert.equal(rows[1].templateCharacter, target.templateCharacter);
    }
});
for (const control of ['---', 'BREAK', 'BREAK 1girl,', 'AND', '[SEP]']) test(`pasting ${control} cannot inherit a template section`, () => {
    const state = assignStarterTemplate(buildStarterTemplate('solo'));
    const row = state.rows.find(r => r.module === 4 && r.templateSlot);
    const next = edit(state, row.start, row.end, `blue dress,\n${control}\n1girl,`);
    assert.ok(!next.rows.find(r => r.text === control).templateSlot);
});
test('cross-section and cross-owner edits do not inherit a single section', () => {
    for (const type of ['solo', 'pair', 'couple']) {
        const state = assignStarterTemplate(buildStarterTemplate(type, { characters: 4 }));
        const a = state.rows.find(r => r.module === 4 && r.templateSlot);
        const b = state.rows.find(r => r.start > a.start && r.module === 5 && r.templateSlot);
        const next = edit(state, a.start, b.end, 'mixed content,\nmore mixed content,');
        assert.ok(!next.rows.find(r => r.text === 'mixed content,').templateSlot);
        assert.ok(!next.rows.find(r => r.text === 'more mixed content,').templateSlot);
    }
});
test('external replacement never inherits template metadata even with a supplied edit range', () => {
    const state = assignStarterTemplate(buildStarterTemplate('solo'));
    const row = state.rows.find(r => r.module === 4 && r.templateSlot);
    const next = edit(state, row.start, row.end, 'blue shirt,\nblack boots,', 'external');
    assert.ok(next.rows.every(r => !r.templateSlot));
});
test('a stale beforeinput range is rejected instead of binding content to a wrong slot', () => {
    const state = assignStarterTemplate(buildStarterTemplate('pair'));
    const row = state.rows.find(r => r.text === '1boy,');
    const source = state.source.replace('1boy,', '1boy, green hair,');
    const next = updateAssignments(state, source, detect(source), { reason: 'typing', edit: { source: 'stale', start: 1, end: 1 } });
    assert.equal(next.rows.find(r => r.text === '1boy, green hair,').id, row.id);
    assert.equal(next.rows.find(r => r.text === '1boy, green hair,').templateCharacter, 2);
});
test('adding another regional character keeps existing owners but does not inherit the preceding section', () => {
    const state = assignStarterTemplate(buildStarterTemplate('couple', { characters: 2 }));
    const next = edit(state, state.source.length, state.source.length, '\n---\n\n1boy, green hair,\nblack shirt,\nsmile,');
    assert.ok(!next.rows.find(row => row.text === '1boy, green hair,').templateGroup);
    assert.equal(next.rows.filter(row => row.templateSlot && row.module === 3).length, 2);
    assert.equal(next.rows.filter(row => row.text === '---').length, 3);
    assert.ok(next.rows.filter(row => row.text === '---').every(row => row.protected));
});
test('all optional expression rows may stay empty while each character and outfit is authored', () => {
    for (const [type, options] of layouts) {
        let state = assignStarterTemplate(buildStarterTemplate(type, options));
        const ids = state.rows.filter(row => row.templateSlot && [3, 4, 6].includes(row.module)).map(row => row.id);
        for (const id of ids) {
            const row = state.rows.find(row => row.id === id);
            state = edit(state, row.start, row.end, row.text + ' ' + content[row.module][0]);
        }
        const expressions = state.rows.filter(row => row.templateSlot && row.module === 5);
        assert.ok(expressions.length > 0);
        assert.ok(expressions.every(row => row.text === '' && !row.header));
    }
});
for (const inputType of ['deleteContentBackward', 'deleteContentForward']) test(`${inputType} resolves the actual blank-row edit location`, () => {
    const initial = assignStarterTemplate(buildStarterTemplate('pair'));
    const target = initial.rows.find(row => row.templateSlot && row.module === 4 && row.templateCharacter === 1);
    const expanded = edit(initial, target.start, target.end, '\n');
    const group = expanded.rows.filter(row => row.templateGroup === target.templateGroup);
    const start = group[0].end, end = group[1].start;
    const source = expanded.source.slice(0, start) + expanded.source.slice(end);
    const caret = inputType === 'deleteContentBackward' ? end : start;
    const result = updateAssignments(expanded, source, detect(source), { reason: 'typing', edit: { source: expanded.source, start: caret, end: caret, inputType } });
    assert.equal(result.rows.filter(row => row.templateGroup === target.templateGroup).length, 1);
    assert.deepEqual(result.rows.filter(row => row.templateSlot && row.templateGroup !== target.templateGroup).map(row => [row.id, row.module, row.templateCharacter]), initial.rows.filter(row => row.templateSlot && row.templateGroup !== target.templateGroup).map(row => [row.id, row.module, row.templateCharacter]));
});
