import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeDraft, parseDraft, restoreDraft, DRAFT_MAX_BYTES } from '../javascript/mdpf-drafts.mjs';
import { buildStarterTemplate, assignStarterTemplate, updateAssignments, setLineAssignment, planCharacterAddition, applyCharacterAddition } from '../javascript/mdpf-assignments.mjs';

const layouts = [['solo', {}], ['pair', {}]];
for (let characters = 2; characters <= 8; characters++) for (const globalPosition of ['first', 'last', 'none']) layouts.push(['couple', { characters, globalPosition }]);
for (const [type, options] of layouts) test(`draft round trip ${type} ${JSON.stringify(options)}`, () => {
    const state = assignStarterTemplate(buildStarterTemplate(type, options));
    const hint = type === 'couple' ? { separator: '---', sharedPosition: options.globalPosition } : null;
    const text = serializeDraft(state, { enabled: true, compact: true, extraQualityLine: false, coupleHint: hint });
    const parsed = parseDraft(text), restored = restoreDraft(parsed);
    assert.equal(restored.state.source, state.source);
    assert.deepEqual(restored.editor, { enabled: true, compact: true, extraQualityLine: false });
    assert.deepEqual(restored.coupleHint, hint);
    assert.deepEqual(restored.state.rows.map(r => [r.text, r.module, r.kind, r.manual, r.header, r.templateSlot, r.templateCharacter]), state.rows.map(r => [r.text, r.module, r.kind, r.manual, r.header, !!r.templateSlot, r.templateCharacter ?? null]));
    assert.equal(serializeDraft(restored.state, { ...restored.editor, coupleHint: restored.coupleHint }), text);
    assert.ok(!text.includes('nextId')); assert.ok(!text.includes('seed')); assert.ok(!text.includes('checkpoint'));
});
test('continued sections and newly added owners retain working group identities after load', () => {
    let state = assignStarterTemplate(buildStarterTemplate('pair'));
    const row = state.rows.find(r => r.module === 4 && r.templateCharacter === 2);
    const source = state.source.slice(0, row.start) + 'blue coat,\nwhite gloves,' + state.source.slice(row.end);
    state = updateAssignments(state, source, { supported: false }, { reason: 'typing', edit: { source: state.source, start: row.start, end: row.end } });
    state = applyCharacterAddition(state, planCharacterAddition(state));
    const restored = restoreDraft(parseDraft(serializeDraft(state))).state;
    assert.equal(restored.source, state.source);
    const gloves = restored.rows.find(r => r.text === 'white gloves,');
    assert.equal(gloves.templateContinuation, true); assert.equal(gloves.templateCharacter, 2);
    assert.equal(gloves.templateGroup, restored.rows.find(r => r.text === 'blue coat,').templateGroup);
    assert.equal(planCharacterAddition(restored).number, 4);
    const more = restored.source.slice(0, gloves.end) + '\nblack boots,' + restored.source.slice(gloves.end);
    const next = updateAssignments(restored, more, { supported: false }, { reason: 'typing', edit: { source: restored.source, start: gloves.end, end: gloves.end } });
    assert.equal(next.rows.find(r => r.text === 'black boots,').module, 4);
    assert.equal(next.rows.find(r => r.text === 'black boots,').templateCharacter, 2);
});
test('raw prompts, special characters and control rows stay exact without executing or changing scope', () => {
    const source = '1girl, <lora:test:0.7>,\nBREAK\n日本語, 😀, <script>alert(1)</script>,\n---\nunknown_trigger,';
    const state = updateAssignments(null, source, { supported: false });
    const result = restoreDraft(parseDraft(serializeDraft(state, { enabled: false, compact: false, extraQualityLine: true })));
    assert.equal(result.state.source, source);
    assert.ok(result.state.rows.filter(r => ['BREAK', '---'].includes(r.text)).every(r => r.protected));
    assert.equal(result.editor.enabled, false); assert.equal(result.editor.extraQualityLine, true);
});
test('manual unassigned labels and changed template labels can be saved', () => {
    let state = assignStarterTemplate(buildStarterTemplate('solo'));
    const row = state.rows.find(r => r.module === 4);
    state = setLineAssignment(state, row.id, null);
    const restored = restoreDraft(parseDraft(serializeDraft(state))).state.rows.find(r => r.index === row.index);
    assert.equal(restored.module, null); assert.equal(restored.manual, true);
    state = setLineAssignment(state, row.id, undefined);
    assert.doesNotThrow(() => serializeDraft(state));
});
test('malformed, oversized and unknown-schema drafts are rejected', () => {
    assert.throws(() => parseDraft('not json'));
    assert.throws(() => parseDraft(' '.repeat(DRAFT_MAX_BYTES + 1)));
    const base = JSON.parse(serializeDraft(assignStarterTemplate(buildStarterTemplate('solo'))));
    for (const mutate of [
        x => x.schemaVersion = 99, x => x.format = 'other', x => x.editor.enabled = 'true',
        x => x.lines.pop(), x => x.lines[1].module = 8, x => x.lines[1].character = -1,
        x => x.lines[1].group = -1, x => x.lines[1].header = 'yes',
        x => x.lines[5].header = true, x => x.lines[1].continuation = true,
        x => x.prompt += '\r', x => x.prompt = 'a'.repeat(100001),
        x => x.lines[1].characterId = '<script>', x => x.generation = { seed: 1 },
        x => x.coupleHint = { separator: '---', sharedPosition: 'invalid' },
        x => x.lines[1].execute = 'code',
    ]) {
        const value = structuredClone(base); mutate(value);
        assert.throws(() => parseDraft(JSON.stringify(value)));
    }
});
test('stale spans cannot be exported and protected control rows cannot be forged into editable sections', () => {
    const state = assignStarterTemplate(buildStarterTemplate('solo'));
    assert.throws(() => serializeDraft({ ...state, source: state.source + 'changed' }));
    const raw = JSON.parse(serializeDraft(updateAssignments(null, '---\nBREAK', { supported: false })));
    raw.lines[0].module = 4; raw.lines[0].manual = true;
    assert.throws(() => parseDraft(JSON.stringify(raw)));
});
