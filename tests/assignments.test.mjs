import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPrompt, addHeadingRows } from '../javascript/mdpf-core.mjs';
import { inspectStructure, addStructureHeadingRows } from '../javascript/mdpf-structure.mjs';
import { updateAssignments, setLineAssignment, resetLineAssignments, lineAtOffset } from '../javascript/mdpf-assignments.mjs';

const simple = 'masterpiece,\nstanding,\n1girl, blue hair,\nmedieval dress,\nsmile,\ncastle,\nanime style,';
const detect = source => { const doc = inspectPrompt(source); return doc.supported ? doc : inspectStructure(source); };
const fresh = source => updateAssignments(null, source, detect(source));
const line = (state, text) => state.rows.find(row => row.text === text);

test('regional spacing reuses authored blank rows without losing manual content labels or boundary protection', () => {
    const source = 'masterpiece,\n\nstanding,\n\n---\n\n1boy, green hair,\n\nblack robe,\n\nsmile,\n\n---\n\n1girl, pink hair,\n\nred armor,\n\nangry,';
    const doc = inspectStructure(source);
    let state = fresh(source);
    const row = line(state, 'black robe,');
    state = setLineAssignment(state, row.id, 6);
    const formatted = addStructureHeadingRows(doc);
    const next = updateAssignments(state, formatted, inspectStructure(formatted), { reason: 'spacing' });
    const retained = line(next, 'black robe,');
    assert.equal(retained.id, row.id);
    assert.equal(retained.module, 6);
    assert.equal(retained.manual, true);
    assert.equal(next.rows.filter(row => row.text === '---' && row.protected).length, 2);
    assert.equal(next.rows.filter(row => row.header).length, doc.blocks.filter(block => block.kind !== 'delimiter').length);
    assert.equal(retained.characterId, row.characterId);
});

test('manual labels change metadata only, reset individually, and do not mutate source state', () => {
    const original = fresh(simple);
    const row = line(original, 'medieval dress,');
    const labeled = setLineAssignment(original, row.id, 6);
    assert.equal(original.rows[row.index].module, 4);
    assert.equal(labeled.source, simple);
    assert.equal(labeled.rows[row.index].module, 6);
    assert.equal(labeled.rows[row.index].manual, true);
    assert.equal(labeled.rows[row.index].detectedModule, 4);
    const unknown = setLineAssignment(labeled, row.id, null);
    assert.equal(unknown.rows[row.index].module, null);
    assert.equal(unknown.rows[row.index].manual, true);
    const reset = setLineAssignment(unknown, row.id, undefined);
    assert.equal(reset.rows[row.index].module, 4);
    assert.equal(reset.rows[row.index].manual, false);
    assert.throws(() => setLineAssignment(reset, row.id, 8), /Choose/);
    assert.throws(() => setLineAssignment(reset, 'stale-id', 1), /Select/);
});

test('manual and detected labels remain stable during same-line typing and incomplete syntax', () => {
    const source = simple + '\n1boy, red hair,\nblue shirt,\nfrown,';
    let state = fresh(source);
    const outfit = line(state, 'medieval dress,');
    const edited = source.replace('medieval dress,', 'fancy castle,');
    state = updateAssignments(state, edited, detect(edited), { reason: 'typing' });
    assert.equal(line(state, 'fancy castle,').id, outfit.id);
    assert.equal(line(state, 'fancy castle,').module, 4);
    assert.equal(line(state, 'fancy castle,').detectedModule, 6);
    state = updateAssignments(state, edited, detect(edited), { reason: 'redetect' });
    assert.equal(line(state, 'fancy castle,').module, 6);
    state = setLineAssignment(state, outfit.id, 4);
    const partial = edited.replace('fancy castle,', '(fancy castle,');
    state = updateAssignments(state, partial, detect(partial), { reason: 'typing' });
    assert.equal(line(state, '(fancy castle,').module, 4);
    assert.equal(line(state, '(fancy castle,').manual, true);
    state = updateAssignments(state, partial, detect(partial), { reason: 'redetect' });
    assert.equal(line(state, '(fancy castle,').manual, true);
});

test('edits before a line shift its span without losing identity; duplicate text is not identity', () => {
    const source = simple.replace('medieval dress,', 'smile,');
    let state = fresh(source);
    const outfits = state.rows[3], expressions = state.rows[4];
    state = setLineAssignment(state, outfits.id, 4);
    state = setLineAssignment(state, expressions.id, 5);
    const edited = source.replace('masterpiece,', 'masterpiece, best quality,');
    state = updateAssignments(state, edited, detect(edited), { reason: 'typing' });
    assert.equal(state.rows[3].id, outfits.id);
    assert.equal(state.rows[4].id, expressions.id);
    assert.equal(state.rows[3].module, 4);
    assert.equal(state.rows[4].module, 5);
    assert.equal(state.rows[3].start, edited.indexOf('smile,'));
});

test('splitting or joining assigned lines clears ambiguous labels but retains unaffected lines', () => {
    let state = fresh(simple);
    const outfit = line(state, 'medieval dress,');
    const background = line(state, 'castle,');
    state = setLineAssignment(state, outfit.id, 4);
    state = setLineAssignment(state, background.id, 6);
    const split = simple.replace('medieval dress,', 'medieval\ndress,');
    const result = updateAssignments(state, split, detect(split), { reason: 'typing' });
    assert.equal(line(result, 'medieval').manual, false);
    assert.equal(line(result, 'dress,').manual, false);
    assert.equal(line(result, 'castle,').id, background.id);
    assert.equal(line(result, 'castle,').manual, true);
    const joined = simple.replace('medieval dress,\nsmile,', 'medieval dress,smile,');
    assert.equal(line(updateAssignments(state, joined, detect(joined), { reason: 'typing' }), 'medieval dress,smile,').manual, false);
});

test('external replacement clears overrides even when some source lines are unchanged', () => {
    let state = fresh(simple);
    const old = line(state, 'castle,');
    state = setLineAssignment(state, old.id, 4);
    const replacement = simple.replace('blue hair', 'green hair');
    const next = updateAssignments(state, replacement, detect(replacement));
    assert.equal(next.reset, true);
    assert.equal(next.rows.some(row => row.manual), false);
    assert.notEqual(line(next, 'castle,').id, old.id);
    assert.equal(line(next, 'castle,').module, 6);
});

test('default spacer formatting and its Undo rebase manual labels without source text matching guesses', () => {
    let state = fresh(simple);
    const outfit = line(state, 'medieval dress,');
    state = setLineAssignment(state, outfit.id, 6);
    const spaced = addHeadingRows(inspectPrompt(simple));
    state = updateAssignments(state, spaced, detect(spaced), { reason: 'spacing' });
    assert.equal(line(state, 'medieval dress,').id, outfit.id);
    assert.equal(line(state, 'medieval dress,').module, 6);
    assert.equal(state.rows.filter(row => row.header).length, 7);
    const header = state.rows[0];
    assert.equal(lineAtOffset(state, header.start).text, 'masterpiece,');
    assert.throws(() => setLineAssignment(state, header.id, 3), /spacer/);
    const restored = updateAssignments(state, simple, detect(simple), { reason: 'spacing' });
    assert.equal(line(restored, 'medieval dress,').id, outfit.id);
    assert.equal(line(restored, 'medieval dress,').manual, true);
});

test('regional boundaries are protected and manual categories retain scoped metadata', () => {
    const source = 'masterpiece,\nstanding,\n---\n1girl, blue hair,\nred dress,\nsmile,\ncastle,\n---\n1boy, red hair,\nblue shirt,\nfrown,\nbeach,';
    let state = fresh(source);
    const boundary = state.rows.find(row => row.protected);
    assert.ok(boundary);
    assert.throws(() => setLineAssignment(state, boundary.id, 6), /boundary/);
    const shirt = line(state, 'blue shirt,');
    state = setLineAssignment(state, shirt.id, 6);
    assert.equal(line(state, 'blue shirt,').characterId, shirt.characterId);
    assert.equal(line(state, 'blue shirt,').regionId, shirt.regionId);
    assert.equal(state.source, source);
});

test('manual labels support starting from an empty prompt and survive typing on that line', () => {
    let state = fresh('');
    state = setLineAssignment(state, state.rows[0].id, 3);
    const id = state.rows[0].id;
    state = updateAssignments(state, '1boy,', detect('1boy,'), { reason: 'typing' });
    assert.equal(state.rows[0].id, id);
    assert.equal(state.rows[0].module, 3);
    assert.equal(state.rows[0].manual, true);
    state = resetLineAssignments(state, detect('1boy,'));
    assert.equal(state.rows[0].manual, false);
    assert.equal(state.rows[0].module, null);
});

test('mixed-newline caret offsets and shifted line identity stay consistent', () => {
    const source = simple.replaceAll('\n', '\r\n');
    let state = fresh(source);
    const row = line(state, 'medieval dress,');
    assert.equal(lineAtOffset(state, row.end + 1).id, row.id);
    state = setLineAssignment(state, row.id, 6);
    const next = source.replace('standing,', 'standing, upper body,');
    state = updateAssignments(state, next, detect(next), { reason: 'typing' });
    assert.equal(line(state, 'medieval dress,').id, row.id);
    assert.equal(line(state, 'medieval dress,').module, 6);
});

test('a configured separator stays protected even during incomplete regional detection', () => {
    const source = '1girl,\n***\nincomplete second character,';
    const doc = { supported: false, protectedSeparator: '***' };
    const state = updateAssignments(null, source, doc);
    assert.equal(state.rows[1].protected, true);
    assert.throws(() => setLineAssignment(state, state.rows[1].id, 6), /boundary/);
});
