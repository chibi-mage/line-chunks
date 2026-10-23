import test from 'node:test';
import assert from 'node:assert/strict';
import { templateContext } from '../javascript/mdpf-inline.mjs';

function fixture() {
    const starter = { children: [{}], contains: node => node === 'starter' };
    const add = { contains: node => node === 'add' }, files = { contains: node => node === 'files' }, note = {};
    return { starter, add, files, note, update: templateContext(starter, add, files, note) };
}
test('empty prompts emphasize starters; drafts emphasize continuation and saved files', () => {
    const old = globalThis.document; globalThis.document = { activeElement: null };
    try {
        const f = fixture(); f.update(false);
        assert.equal(f.starter.open, true); assert.equal(f.add.open, false); assert.equal(f.files.open, false);
        assert.equal(f.starter.children[0].textContent, 'Start from a template');
        f.update(true);
        assert.equal(f.starter.open, false); assert.equal(f.add.open, true); assert.equal(f.files.open, true);
        assert.equal(f.starter.children[0].textContent, 'Replace draft with a template');
        assert.match(f.note.textContent, /Continue your draft/);
        f.update(false); assert.equal(f.starter.open, true); assert.equal(f.files.open, false);
    } finally { globalThis.document = old; }
});
test('polling retains user expansion choices and chooser objects', () => {
    const old = globalThis.document; globalThis.document = { activeElement: null };
    try {
        const f = fixture(); f.update(true);
        const chooser = { value: 'couple' }; f.starter.children.push(chooser);
        f.starter.open = true; f.add.open = false; f.files.open = false;
        for (let n = 0; n < 100; n++) f.update(true);
        assert.equal(f.starter.open, true); assert.equal(f.add.open, false); assert.equal(f.files.open, false);
        assert.equal(f.starter.children[1], chooser); assert.equal(chooser.value, 'couple');
    } finally { globalThis.document = old; }
});
test('context transitions never collapse a focused group', () => {
    const old = globalThis.document; globalThis.document = { activeElement: 'starter' };
    try {
        const f = fixture(); f.starter.open = true; f.update(true);
        assert.equal(f.starter.open, true, 'Insert template must leave its focused Undo reachable');
        document.activeElement = 'files'; f.update(false);
        assert.equal(f.files.open, true, 'Load/Undo transitions retain focused file controls');
    } finally { globalThis.document = old; }
});
