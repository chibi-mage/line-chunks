import test from 'node:test';
import assert from 'node:assert/strict';
import { previewOrganization } from '../javascript/mdpf-organize.mjs';
import { inspectPrompt, tokenize } from '../javascript/mdpf-core.mjs';
const plan = source => previewOrganization(source, { confirmedSolo: true, unknownStyle: false, deduplicate: false });

test('solo organization with duplicate cleanup off preserves weighted token text and duplicates, stable within categories', () => {
    const source = 'smile, blue dress, (blue hair:1.25), masterpiece, 1girl, standing, forest, lineart, smile,';
    const result = plan(source);
    assert.equal(result.supported, true);
    const doc = inspectPrompt(result.proposed);
    assert.equal(doc.supported, true);
    assert.equal(doc.modules[2].text, '(blue hair:1.25), 1girl,');
    assert.equal(doc.modules[4].text, 'smile, smile,');
    const contents = text => tokenize(text).tokens.map(token => token.text.trim()).filter(Boolean).sort();
    assert.deepEqual(contents(source), contents(result.proposed));
    assert.equal(plan(result.proposed).proposed, result.proposed);
});
test('confirmation is required; region controls and multiple characters cannot be organized', () => {
    assert.equal(previewOrganization('solo, smile,').supported, false);
    for (const source of ['2girls, smile,', '1girl, 1boy, smile,', 'solo,\n---\nsmile,', 'solo, BREAK, smile,', 'solo, [smile:sad:0.5],']) assert.equal(plan(source).supported, false, source);
});
test('unknown, ambiguous and LoRA associations block the whole transformation', () => {
    for (const source of ['solo, unknown_trigger, smile,', 'solo, medieval,', 'solo, <lora:example:1>, smile,', 'solo, anime style,', 'solo, (smile, blue dress:1.2),']) {
        const result = plan(source); assert.equal(result.proposed, null); assert.equal(result.supported, false, source);
    }
});
test('malformed and cross-line groups are rejected; homogeneous weighted groups remain intact', () => {
    for (const source of ['solo,, smile,', 'solo, (smile:1.2,', 'solo\nsmile', 'solo, (smile,\nhappy:1.2),']) assert.equal(plan(source).supported, false, source);
    assert.ok(plan('solo, (smile, happy:1.2),').proposed.includes('(smile, happy:1.2)'));
});
test('terminal comma choice and empty module rows are explicit; CRLF source stays available for exact revert', () => {
    const source = 'smile,\r\nsolo'; const result = plan(source);
    assert.equal(result.source, source); assert.equal(result.supported, true);
    assert.equal(result.proposed.trimEnd().endsWith(','), false);
    assert.equal(inspectPrompt(result.proposed).supported, true);
    assert.equal(plan('').supported, false);
});
