import test from 'node:test';
import assert from 'node:assert/strict';
import { previewOrganization, previewRegionalOrganization, previewCharacterOrganization } from '../javascript/mdpf-organize.mjs';
import { tokenize } from '../javascript/mdpf-core.mjs';
import { attachOrganization } from '../javascript/mdpf-organize-view.mjs';

const plan = (source, options = {}) => previewOrganization(source, { confirmedSolo: true, ...options });
const tokens = source => tokenize(source).tokens.map(token => token.text.trim()).filter(Boolean);
const count = (source, tag) => tokens(source).filter(text => text === tag).length;

for (const eol of ['\n', '\r\n', '\r']) test(`default exact duplicate cleanup is audited and stable: ${JSON.stringify(eol)}`, () => {
    const source = ['solo, standing, smile,', ' standing , solo, smile, smile,'].join(eol);
    const result = plan(source);
    assert.equal(result.source, source); assert.equal(result.supported, true);
    assert.deepEqual(result.duplicates.map(item => [item.index, item.keptIndex, item.text, item.removed]),
        [[3, 1, 'standing', true], [4, 0, 'solo', true], [5, 2, 'smile', true], [6, 2, 'smile', true]]);
    assert.deepEqual(tokens(result.proposed), ['standing', 'solo', 'smile']);
    assert.equal(plan(result.proposed).proposed, result.proposed);
    assert.equal(plan(result.proposed).duplicates.length, 0);
});

test('individual Keep selections and global off preserve deliberate repeats', () => {
    const source = 'solo, smile, smile, smile,';
    const kept = plan(source, { keepDuplicates: [2] });
    assert.equal(count(kept.proposed, 'smile'), 2);
    assert.deepEqual(kept.duplicates.map(item => item.removed), [false, true]);
    const off = plan(source, { deduplicate: false });
    assert.equal(count(off.proposed, 'smile'), 3);
    assert.ok(off.duplicates.every(item => !item.removed));
});

test('case, underscores, synonyms and distinct weights are not silently merged', () => {
    const source = 'solo, blue hair, BLUE HAIR, blue_hair, (smile:1.2), (smile:1.3), smile, happy, grin,';
    const result = plan(source);
    assert.equal(result.supported, true);
    assert.equal(result.duplicates.length, 0);
    assert.deepEqual(tokens(result.proposed).sort(), tokens(source).sort());
});

test('repeated weighted groups, LoRAs, escapes and verified bundles remain opaque', () => {
    const source = 'solo, (smile:1.2), (smile:1.2), <lora:sample:0.7>, <lora:sample:0.7>, smile, smile, custom\\,tag, custom\\,tag,';
    const result = plan(source, { bundles: [{ start: 5, end: 6, module: 5 }] });
    assert.equal(result.supported, true);
    assert.equal(result.duplicates.length, 0);
    assert.deepEqual(tokens(result.proposed).sort(), tokens(source).sort());
});

test('explicitly different destinations preserve both exact strings', () => {
    const result = plan('solo, mystery, mystery,', { placements: { 1: 3, 2: 7 } });
    assert.equal(result.supported, true); assert.equal(count(result.proposed, 'mystery'), 2);
    assert.equal(result.duplicates.length, 0);
});

test('example-derived repeated depth of field, standing and solo are reported without rewriting descriptors', () => {
    for (const source of [
        'masterpiece, adult female, solo, depth of field, beach, depth of field,',
        '1girl, adult female, solo, white shirt, standing, dark skin, standing, solo, hotel bedroom,',
    ]) {
        const result = plan(source); assert.equal(result.supported, true);
        const removed = result.duplicates.filter(item => item.removed).map(item => item.text);
        assert.deepEqual(removed, source.includes('depth of field') ? ['depth of field'] : ['standing', 'solo']);
        assert.equal(result.proposed.includes('huge hotel bedroom'), false);
        assert.equal(result.proposed.includes('dark skin'), source.includes('dark skin'));
    }
    assert.equal(plan('solo, blue dress, large dress, huge dress,').duplicates.length, 0);
});

for (const sharedPosition of ['first', 'last', 'none']) test(`regional deduplication stays local with shared ${sharedPosition}`, () => {
    const shared = '  masterpiece, masterpiece, shared_x,  \r\n';
    const chunks = ['1girl, solo, smile, smile, blue dress,', '1boy, solo, smile, smile, black shirt,'];
    if (sharedPosition === 'first') chunks.unshift(shared);
    if (sharedPosition === 'last') chunks.push(shared);
    const source = chunks.join('\r\n \t--- \r\n');
    const options = { confirmedRegions: true, sharedPosition };
    const result = previewRegionalOrganization(source, options);
    assert.equal(result.supported, true); assert.equal(result.duplicates.length, 2);
    assert.equal(result.duplicates[0].regionIndex === result.duplicates[1].regionIndex, false);
    assert.equal(count(result.proposed.replaceAll(/^[ \t]*---[^\r\n]*/gm, ''), 'smile'), 2);
    if (sharedPosition !== 'none') assert.ok(result.proposed.includes(shared));
    const keep = previewRegionalOrganization(source, { ...options, keepDuplicates: [result.duplicates[1].index] });
    assert.equal(keep.duplicates.filter(item => item.removed).length, 1);
    assert.deepEqual(result.boundaries.map(item => item.text), [...result.proposed.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)].map(match => match[0]).filter(text => text.trim() === '---'));
});

test('ordinary confirmed blocks preserve interleaved/shared repeats and per-character expressions', () => {
    const source = 'masterpiece, masterpiece,\n1girl, solo, smile, smile,\nshared_x, shared_x,\n1boy, solo, smile, smile,\nforest, forest,';
    const result = previewCharacterOrganization(source, { confirmedCharacters: true, characterRanges: [{ first: 1, last: 1 }, { first: 3, last: 3 }] });
    assert.equal(result.supported, true); assert.equal(result.duplicates.length, 2);
    assert.equal(count(result.proposed, 'smile'), 2);
    for (const slice of ['masterpiece, masterpiece,', 'shared_x, shared_x,', 'forest, forest,']) assert.ok(result.proposed.includes(slice));
});

test('duplicate choices cannot bypass syntax/count/limit guards or target shared text', () => {
    for (const options of [{ keepDuplicates: '2' }, { keepDuplicates: [-1] }, { keepDuplicates: [99] }, { deduplicate: 'yes' }]) assert.equal(plan('solo, smile, smile,', options).supported, false);
    for (const source of ['1girl, 1girl, smile,', 'solo, BREAK, BREAK,', 'solo,, smile, smile,', 'solo, (smile, (smile,']) assert.equal(plan(source).proposed, null);
    assert.equal(plan('solo,' + Array(201).fill('smile').join(',')).supported, false, 'Limits apply before deduplication');
    assert.equal(previewRegionalOrganization('masterpiece, masterpiece,\n---\n1girl, smile,\n---\n1boy, smile,', { confirmedRegions: true, sharedPosition: 'first', keepDuplicates: [1] }).supported, false);
});

class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.handlers = {}; this.value = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    setAttribute(key, value) { (this.attributes ??= {})[key] = value; }
    addEventListener(type, fn) { (this.handlers[type] ??= new Set()).add(fn); }
    removeEventListener(type, fn) { this.handlers[type]?.delete(fn); }
    dispatchEvent(event) { for (const fn of this.handlers[event.type] ?? []) fn(event); }
    fire(type) { this.dispatchEvent({ type }); }
    remove() {}
}
const flatten = node => [node, ...(node.children ?? []).flatMap(flatten)];
test('duplicate review controls invalidate previews, retain applied audit, restore repeats and reset source-bound choices', () => {
    const previous = globalThis.document;
    globalThis.document = { createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) };
    try {
        const native = new Element('textarea'), source = 'solo, smile, smile, smile,'; native.value = source;
        const view = attachOrganization(native, new Element('div'));
        const button = text => flatten(view.panel).find(node => node.tag === 'button' && node.textContent === text);
        const check = text => flatten(view.panel).find(node => node.tag === 'label' && node.children.some(child => child.textContent?.includes(text))).children.find(node => node.tag === 'input');
        const solo = view.panel.children[2].children[0]; solo.checked = true; button('Preview organization').fire('click');
        assert.equal(native.value, source);
        let keep = check('Keep repeat item 3'); keep.checked = true; keep.fire('change');
        assert.equal(button('Apply organization').disabled, true);
        button('Apply organization').fire('click'); assert.equal(native.value, source);
        button('Preview organization').fire('click'); button('Apply organization').fire('click');
        assert.equal(count(native.value, 'smile'), 2);
        assert.ok(flatten(view.panel).some(node => node.textContent === 'Removed duplicates · last Apply'));
        assert.ok(flatten(view.panel).some(node => node.textContent?.includes('item 4: smile')));
        button('Revert organization').fire('click'); assert.equal(native.value, source);
        button('Preview organization').fire('click');
        assert.equal(check('Keep repeat item 3').checked, false);
        const off = check('Remove exact duplicate tags'); off.checked = false; off.fire('change');
        button('Preview organization').fire('click'); button('Apply organization').fire('click'); assert.equal(count(native.value, 'smile'), 3);
        native.value += ' external,'; native.fire('input'); button('Revert organization').fire('click');
        assert.ok(native.value.endsWith(' external,'));
        assert.equal(flatten(view.panel).some(node => node.textContent === 'Removed duplicates · last Apply'), false);
        view.destroy();
    } finally { globalThis.document = previous; }
});
