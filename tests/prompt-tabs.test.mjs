import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPromptTabs } from '../javascript/mdpf-inline.mjs';

class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.handlers = {}; this.classList = { add() {} }; }
    append(...nodes) { for (const node of nodes) { if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node); this.children.push(node); node.parentElement = this; } }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, callback) { this.handlers[key] = callback; }
    focus() { this.focused = true; }
}
function fixture(id = 'txt2img') {
    const panel = new Element('details'), summary = new Element('summary'), control = new Element('select'), templates = new Element('details');
    control.value = 'regional'; panel.append(summary, control);
    const tabs = attachPromptTabs(panel, templates, id);
    return { panel, summary, control, templates, tabs, bar: panel.children[1], review: panel.children[2] };
}
test('below-prompt tabs preserve the organization controls and their state', () => {
    const previous = globalThis.document;
    globalThis.document = { createElement: tag => new Element(tag) };
    try {
        const f = fixture(), [reviewTab, templateTab] = f.bar.children;
        assert.equal(f.panel.children[0], f.summary);
        assert.equal(f.review.children[0], f.control);
        assert.equal(f.review.hidden, false); assert.equal(f.templates.hidden, true);
        templateTab.handlers.click();
        assert.equal(f.review.hidden, true); assert.equal(f.templates.hidden, false);
        assert.equal(templateTab.attributes['aria-selected'], 'true'); assert.equal(reviewTab.tabIndex, -1);
        reviewTab.handlers.click(); assert.equal(f.control.value, 'regional');
        assert.equal(f.review.children[0], f.control, 'Switching must retain existing controls, snapshots and handlers');
        assert.equal(f.templates.open, true);
    } finally { globalThis.document = previous; }
});
test('keyboard tab navigation and Open review reveal the appropriate panel', () => {
    const previous = globalThis.document;
    globalThis.document = { createElement: tag => new Element(tag) };
    try {
        const f = fixture(), [reviewTab, templateTab] = f.bar.children;
        let prevented = 0;
        reviewTab.handlers.keydown({ key: 'ArrowRight', preventDefault() { prevented++; } });
        assert.equal(templateTab.focused, true); assert.equal(f.templates.hidden, false);
        templateTab.handlers.keydown({ key: 'Home', preventDefault() { prevented++; } });
        assert.equal(reviewTab.focused, true); assert.equal(f.review.hidden, false);
        reviewTab.handlers.keydown({ key: 'End', preventDefault() { prevented++; } });
        assert.equal(f.templates.hidden, false);
        f.tabs.showReview(); assert.equal(f.review.hidden, false); assert.equal(f.templates.hidden, true);
        assert.equal(prevented, 3);
    } finally { globalThis.document = previous; }
});
test('txt2img and img2img tabs have unique accessible relationships and independent selection', () => {
    const previous = globalThis.document;
    globalThis.document = { createElement: tag => new Element(tag) };
    try {
        const a = fixture(), b = fixture('img2img');
        a.bar.children[1].handlers.click();
        assert.equal(a.templates.hidden, false); assert.equal(b.templates.hidden, true);
        assert.notEqual(a.review.id, b.review.id);
        assert.equal(a.bar.attributes.role, 'tablist');
        assert.equal(a.bar.attributes['aria-label'], 'Line Chunks tools');
        assert.equal(a.bar.children[0].attributes['aria-controls'], a.review.id);
        assert.equal(a.review.attributes['aria-labelledby'], a.bar.children[0].id);
    } finally { globalThis.document = previous; }
});
