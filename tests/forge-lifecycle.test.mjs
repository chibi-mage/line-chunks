import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual Forge entry with host/controller doubles. This checks
// navigation lifecycle and discovery, not browser cache eligibility or layout.
function fixture() {
    const handlers = new Map(), timers = new Map();
    let nextTimer = 0, mounts = 0, observations = 0;
    const native = { value: '1girl, solo,' };
    const panel = { isConnected: true, remove() {}, classList: { add() {} } };
    const host = { querySelector: () => native, closest: () => null, after() {} };
    const document = {
        querySelector: selector => selector === '#txt2img_prompt' ? host : null,
        getElementById: () => null, createElement: () => ({ ...panel }), head: { append() {} },
    };
    const context = {
        document, URL,
        window: { addEventListener(name, handler, options) {
            const list = handlers.get(name) ?? []; list.push({ handler, once: options?.once }); handlers.set(name, list);
        } },
        setInterval(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
        clearInterval(id) { timers.delete(id); },
        attachInlineEditor() {
            mounts++;
            return { shell: { isConnected: true }, templates: {}, observe() { observations++; }, destroy() {},
                getLineAssignments() {}, setLineAssignments() {}, getEditorSnapshot() {}, restoreEditorSnapshot() {}, getCoupleState() {} };
        },
        attachOrganization() { return { panel, observe() { observations++; }, destroy() {} }; },
        attachPromptTabs() { return { showReview() {} }; },
    };
    let source = readFileSync(new URL('../javascript/mdpf-forge.mjs', import.meta.url), 'utf8');
    // Keep entry code intact; resolve only its two imports through these doubles.
    source = source.replace(/^import .*;\r?\n/gm, '')
        .replaceAll('import.meta.url', JSON.stringify('https://forge.test/extensions/mdpf-editor/javascript/mdpf-forge.mjs'));
    vm.runInNewContext(source, context);
    return {
        timers, native,
        emit(name) {
            const list = handlers.get(name) ?? [];
            handlers.set(name, list.filter(item => !item.once));
            for (const { handler } of list) handler({ persisted: true });
        },
        tick() { for (const fn of [...timers.values()]) fn(); },
        get mounts() { return mounts; }, get observations() { return observations; },
    };
}

test('Forge discovery resumes after returning to a cached page without remounting or editing the prompt', () => {
    const f = fixture();
    assert.equal(f.mounts, 1);
    assert.equal(f.timers.size, 1);
    const initial = f.observations;
    f.emit('pagehide');
    assert.equal(f.timers.size, 0);
    f.native.value = '1girl, solo, blue hair,';
    f.emit('pageshow');
    assert.equal(f.timers.size, 1, 'Returning to the page must restart background discovery');
    assert.ok(f.observations > initial, 'Reconcile current source immediately on return');
    const returned = f.observations;
    f.tick();
    assert.ok(f.observations > returned, 'Programmatic host edits remain observable after return');
    assert.equal(f.mounts, 1, 'Returning must reuse existing controls');
    assert.equal(f.native.value, '1girl, solo, blue hair,');
});

test('repeated navigation pauses and resumes exactly one Forge discovery timer', () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) {
        f.emit('pageshow'); f.emit('pageshow');
        assert.equal(f.timers.size, 1);
        f.emit('pagehide'); f.emit('pagehide');
        assert.equal(f.timers.size, 0);
        const paused = f.observations;
        f.tick();
        assert.equal(f.observations, paused);
        f.emit('pageshow');
        assert.equal(f.timers.size, 1);
    }
    assert.equal(f.mounts, 1);
});
