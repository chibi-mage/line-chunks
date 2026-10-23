import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarterTemplate, assignStarterTemplate, updateAssignments, setLineAssignment } from '../javascript/mdpf-assignments.mjs';
import { inspectPrompt } from '../javascript/mdpf-core.mjs';
import { inspectStructure } from '../javascript/mdpf-structure.mjs';
import { serializeDraft, parseDraft, restoreDraft } from '../javascript/mdpf-drafts.mjs';
import { planAutoFix } from '../javascript/mdpf-line-organization.mjs';
import { previewOrganization } from '../javascript/mdpf-organize.mjs';

const detect = source => { const d = inspectPrompt(source); return d.supported ? d : inspectStructure(source); };
const layouts = [['solo', {}], ['pair', {}]];
for (let characters = 2; characters <= 8; characters++) for (const globalPosition of ['first', 'last', 'none']) layouts.push(['couple', { characters, globalPosition }]);
const tokens = ['blue hair,', 'gold bracelet,', 'looking up,', 'stone wall,', '日本語, 😀,', '(smile:1.2),', '<lora:example:0.7>,', 'unknown_trigger_891,'];
function generator(seed) { let n = seed; return max => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return Math.floor(n / 0x100000000 * max); }; }
function check(state, where) {
    const physical = updateAssignments(null, state.source, { supported: false }).rows;
    assert.deepEqual(state.rows.map(r => [r.start, r.end, r.text]), physical.map(r => [r.start, r.end, r.text]), where);
    assert.equal(new Set(state.rows.map(r => r.id)).size, state.rows.length, where + ': unique identities');
    for (const row of state.rows) {
        if (row.protected) assert.ok(!row.manual && !row.templateSlot && row.module === null, where + ': control is not editable');
        if (row.header) assert.equal(row.text, '', where + ': no text becomes a heading');
        if (row.templateContinuation) {
            const previous = state.rows[row.index - 1];
            assert.ok(previous?.templateSlot && previous.templateGroup === row.templateGroup && previous.module === row.module && previous.templateCharacter === row.templateCharacter, where + ': continuation is adjacent to its own section');
        }
    }
    const text = serializeDraft(state);
    const restored = restoreDraft(parseDraft(text)).state;
    assert.equal(restored.source, state.source, where + ': full text round trip');
    assert.equal(serializeDraft(restored), text, where + ': stable label serialization');
}
for (const [layout, options] of layouts) for (const seed of [7, 149, 2026, 65537]) test(`editing stress ${layout} ${JSON.stringify(options)} seed ${seed}`, () => {
    const rand = generator(seed), template = buildStarterTemplate(layout, options);
    let state = assignStarterTemplate(template);
    check(state, 'initial');
    for (let step = 0; step < 64; step++) {
        const action = rand(8), where = `${layout} ${JSON.stringify(options)} seed ${seed} step ${step} action ${action}`;
        const editable = state.rows.filter(r => !r.protected && !r.header);
        const row = editable[rand(editable.length)];
        if (action === 5) {
            state = setLineAssignment(state, row.id, rand(3) ? 1 + rand(7) : null);
        } else if (action === 6) {
            state = restoreDraft(parseDraft(serializeDraft(state))).state;
        } else if (action === 7) {
            state = updateAssignments(state, state.source, detect(state.source), { reason: 'redetect' });
        } else {
            const start = row.start + rand(row.text.length + 1);
            const end = action === 2 || action === 3 ? row.end : start;
            const insertion = action === 0 ? tokens[rand(tokens.length)] : action === 1 ? '\n' + tokens[rand(tokens.length)] : action === 2 ? '' : action === 3 ? tokens[rand(tokens.length)] + '\n' + tokens[rand(tokens.length)] : '\nBREAK\n';
            const before = state.source, source = before.slice(0, start) + insertion + before.slice(end);
            state = updateAssignments(state, source, detect(source), { reason: 'typing', edit: { source: before, start, end, inputType: action === 2 ? 'deleteContentForward' : 'insertText' } });
            assert.equal(state.source, source, where + ': exact edit preservation');
        }
        check(state, where);
    }
});

const semantic = [
    'smile, blue dress, 1girl, solo, blue hair, castle, masterpiece, standing, blue dress,',
    'score_7_up, 1boy, solo, black hair, boots, score_9, looking up, forest, coat,',
    '1girl, solo, looking at viewer, gold bracelet, french braid, throne, standing, newest,',
    '1girl, blue hair, unknown_trigger_891, <lora:example:0.7>, best quality, green eyes,',
];
for (const source of semantic) test(`organizer preservation and idempotence: ${source.slice(0, 55)}`, () => {
    const before = source;
    const fixed = planAutoFix(source);
    assert.equal(fixed.supported, true, fixed.message);
    assert.equal(source, before);
    assert.equal(planAutoFix(fixed.proposed).proposed, fixed.proposed, 'Second Auto Fix must not keep changing the result');
    const review = previewOrganization(source, { confirmedSolo: true, deduplicate: false });
    assert.equal(review.supported, true);
    const tokenize = s => s.split(/[,\n]/).map(t => t.trim()).filter(Boolean).sort();
    assert.deepEqual(tokenize(review.proposed), tokenize(source), 'Review without deduplication preserves every whole tag');
});
