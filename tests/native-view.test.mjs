import test from 'node:test';
import assert from 'node:assert/strict';
import { attachInlineEditor } from '../javascript/mdpf-inline.mjs';
import { buildStarterTemplate, assignStarterTemplate, updateAssignments } from '../javascript/mdpf-assignments.mjs';
import { serializeDraft } from '../javascript/mdpf-drafts.mjs';
import { attachOrganization } from '../javascript/mdpf-organize-view.mjs';

// Small DOM contract double: checks source ownership and lifecycle, not browser layout.
class Element {
    constructor(tag) {
        this.tag = tag; this.children = []; this.handlers = {}; this.attributes = {};
        const camel = key => key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.style = { setProperty(k, v) { this[camel(k)] = v; }, getPropertyValue(k) { return this[camel(k)] ?? ''; }, getPropertyPriority() { return ''; }, removeProperty(k) { delete this[camel(k)]; } };
        this.classList = { add() {}, remove() {} };
    }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentElement = this; } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(k, v) { this.attributes[k] = v; }
    addEventListener(k, fn) { (this.handlers[k] ??= new Set()).add(fn); }
    removeEventListener(k, fn) { this.handlers[k]?.delete(fn); }
    fire(k, event) { for (const fn of this.handlers[k] ?? []) fn(event); }
    dispatchEvent(event) { this.fire(event.type); return true; }
    click() { this.fire('click'); }
    querySelector() { return null; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
    getBoundingClientRect() { return { height: parseFloat(this.parentElement?.style.lineHeight) || 56 }; }
}

test('compact defaults on mode entry; observers preserve source and spacing Undo is guarded', async () => {
    const keys = ['document', 'window', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle'];
    const originals = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
    const body = new Element('body');
    const document = { body, createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }), querySelector: () => null };
    const frames = new Map(); let sequence = 0;
    Object.assign(globalThis, {
        document, window: new Element('window'), ResizeObserver: class { observe() {} disconnect() {} },
        requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; }, cancelAnimationFrame: id => frames.delete(id),
        getComputedStyle: node => ({ paddingTop: '8px', paddingLeft: '12px', paddingRight: '8px', lineHeight: node.style.lineHeight === '1.5' ? '24px' : '56px', fontSize: '16px' }),
    });
    const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
    try {
        const host = new Element('div'), wrapper = new Element('label'), native = new Element('textarea');
        native.clientWidth = 600; native.clientHeight = 96; native.scrollTop = 0; native.offsetTop = native.offsetLeft = native.clientTop = native.clientLeft = 0;
        native.readOnly = false; native.wrap = 'soft';
        native.style.paddingLeft = '12px';
        native.style.lineHeight = '24px';
        native.style.minHeight = '160px';
        let value = 'masterpiece,\nstanding,\n1girl, blue hair,\nblue dress,\nsmile,\ncastle,\nanime style,';
        let allowFormatting = false, writes = 0;
        Object.defineProperty(native, 'value', { get: () => value, set: next => {
            assert.equal(allowFormatting, true, 'Decoration assigned the native prompt without explicit formatting');
            writes++; value = next;
        } });
        host.ownerDocument = document; wrapper.append(native); host.append(wrapper);
        const controller = attachInlineEditor(native, host, 'txt2img', { getExtraQuality: () => false, setExtraQuality() {} });
        const [toggle, detect] = controller.shell.children[0].children;
        // Newline-separated Forge Couple must block automatic whitespace formatting.
        document.querySelector = () => ({ querySelector: selector => selector.includes('checkbox') ? { checked: true } : selector.includes('separator') ? { value: '\\n' } : { value: 'None' } });
        detect.fire('click'); flush();
        assert.equal(native.parentElement, wrapper);
        assert.equal(wrapper.parentElement, host);
        assert.equal(wrapper.children[0], native);
        assert.equal(native.readOnly, false);
        assert.equal(native.style.minHeight, '160px', 'MDPF must retain the host minimum height');
        assert.equal(toggle.attributes['aria-checked'], 'true');
        assert.equal(wrapper.children[1].children.length, 7);
        assert.equal(wrapper.children[1].children[0].textContent, 'L1 · Quality & medium');
        assert.equal(wrapper.children[1].children[3].textContent, 'L4 · Outfit (top to bottom)');
        assert.equal(wrapper.children[1].style.width, '600px');
        assert.equal(wrapper.children[1].children[0].style.left, '12px');
        assert.equal(wrapper.children[1].children[0].style.top, '9px');
        assert.equal(wrapper.children[1].children[1].style.top, '65px');
        assert.match(native.style.backgroundImage, /linear-gradient/);
        const beforeScroll = native.style.backgroundImage;
        native.scrollTop = 48; native.fire('scroll'); flush();
        assert.notEqual(native.style.backgroundImage, beforeScroll);
        assert.equal(writes, 0);
        const undoSpacing = controller.shell.children[0].children[4];
        assert.equal(controller.shell.children[0].children.length, 6);
        const original = value;
        document.querySelector = () => null;
        controller.observe(true);
        assert.equal(writes, 0, 'Changing integration state must not format from an observer');
        allowFormatting = true;
        native.scrollTop = 0;
        toggle.fire('click'); // Off.
        toggle.fire('click'); flush(); // On applies the compact default.
        assert.equal(writes, 1);
        assert.equal(native.style.lineHeight, '1.5');
        assert.equal(native.style.minHeight, '160px');
        native.style.height = '220px';
        assert.equal(value, '\n' + original.replaceAll('\n', '\n\n'));
        assert.equal(wrapper.children[1].children[0].style.top, '9px');
        assert.equal(wrapper.children[1].children[1].style.top, '57px');
        assert.equal(undoSpacing.disabled, false);
        allowFormatting = false;
        const assignButton = controller.shell.children[0].children[5];
        assignButton.fire('click');
        const panel = controller.shell.children[5];
        assert.equal(panel.hidden, false);
        const rowSelect = panel.children[0].children[0];
        const moduleSelect = panel.children[1].children[0];
        rowSelect.value = rowSelect.children.find(option => option.textContent.includes('blue dress,')).value;
        rowSelect.fire('change');
        moduleSelect.value = '6'; moduleSelect.fire('change'); flush();
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'L6 · Background · manual'));
        assert.equal(writes, 1, 'Assigning a label must not change the prompt');
        const suggestion = panel.children[5];
        assert.equal(suggestion.children[2].disabled, true, 'Manual corrections must block suggestion acceptance');
        moduleSelect.value = 'detected'; moduleSelect.fire('change'); flush();
        value = value.replace('blue dress,', 'stone dungeon, fancy castle,');
        native.fire('input', { isTrusted: true }); flush();
        assert.equal(moduleSelect.value, 'detected');
        assert.match(suggestion.children[0].textContent, /Suggested: L6/);
        assert.equal(suggestion.children[2].disabled, false);
        const overview = controller.shell.children[6];
        assert.match(overview.children[0].textContent, /1 label suggestion/);
        assignButton.fire('click'); // Close before opening through the overview.
        overview.children[1].fire('click');
        assert.equal(panel.hidden, false);
        assert.equal(panel.children[6].open, true);
        assert.ok(rowSelect.children.find(option => option.value === rowSelect.value).textContent.includes('stone dungeon'));
        assert.equal(panel.children[7].children[2].disabled, true, 'Unreviewed category must not export as a reviewed case');
        const beforeAccept = value;
        suggestion.children[2].fire('click'); flush();
        assert.equal(value, beforeAccept, 'Accepting a suggestion must not rewrite tags');
        assert.equal(writes, 1);
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'L6 · Background · manual'));
        assert.match(overview.children[0].textContent, /0 label suggestions/);
        assert.equal(overview.children[1].disabled, true);
        const casePanel = panel.children[7];
        casePanel.children[2].fire('click');
        assert.equal(casePanel.children[5].hidden, false);
        assert.equal(JSON.parse(casePanel.children[5].textContent).expected.module, 6);
        assert.equal(JSON.parse(casePanel.children[5].textContent).positiveLine, 'stone dungeon, fancy castle,');
        assert.equal(JSON.parse(casePanel.children[5].textContent).review.intent, 'pending');
        const intentSelect = casePanel.children[1].children[0].children[0];
        intentSelect.value = 'section'; intentSelect.fire('change');
        assert.equal(casePanel.children[5].hidden, true, 'Changing review intent must clear the prepared snapshot');
        casePanel.children[2].fire('click');
        assert.equal(JSON.parse(casePanel.children[5].textContent).review.intent, 'section');
        assert.equal(casePanel.children[5].tag, 'pre', 'Review output must not introduce a second textarea into the native prompt component');
        assert.equal(writes, 1, 'Preparing a case must not write native prompt text');
        moduleSelect.value = '4'; moduleSelect.fire('change');
        assert.equal(casePanel.children[5].hidden, true, 'Changing the reviewed label must clear the stale prepared case');
        moduleSelect.value = '6'; moduleSelect.fire('change');
        casePanel.children[2].fire('click');
        // Restore the exact spacing snapshot through a local edit for the existing Undo checks.
        value = value.replace('stone dungeon, fancy castle,', 'blue dress,');
        native.fire('input', { isTrusted: true }); flush();
        assert.equal(casePanel.children[5].hidden, true, 'Changing prompt text must clear the prepared case');
        detect.fire('click'); controller.observe(true); flush();
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'L6 · Background · manual'));
        assert.equal(writes, 1, 'Repeated detection must not add more heading rows');
        assert.equal(native.style.height, '220px', 'Detection must preserve the manually resized height');
        toggle.fire('click'); toggle.fire('click'); flush();
        assert.equal(writes, 1, 'Off/On must not reformat an already compact prompt');
        allowFormatting = true;
        undoSpacing.fire('click'); flush();
        assert.equal(value, original);
        assert.equal(writes, 2);
        assert.equal(toggle.attributes['aria-checked'], 'false');
        assert.equal(native.style.lineHeight, '24px');
        detect.fire('click'); flush();
        allowFormatting = false;
        value = 'an unfinished prompt ('; native.fire('input'); flush();
        assert.equal(toggle.attributes['aria-checked'], 'true');
        assert.equal(native.style.backgroundImage, 'none');
        value = 'external replacement'; controller.observe(); flush();
        assert.equal(undoSpacing.disabled, true);
        undoSpacing.fire('click');
        assert.equal(value, 'external replacement');
        toggle.fire('click');
        assert.equal(native.style.paddingLeft, '12px');
        assert.equal(native.style.lineHeight, '24px');
        assert.equal(native.style.minHeight, '160px');
        assert.equal(native.style.backgroundImage, undefined);
        // Literal standalone Forge Couple regions use compact default spacing.
        value = 'masterpiece,\nstanding,\n<lora:style:1>,\n---\n1boy, green hair,\nblack robe,\nsmirk,\nblue background,\n---\n1girl, pink hair,\nred armor,\nangry,\nred background,';
        const regionalBefore = value;
        document.querySelector = () => ({ querySelector: selector => selector.includes('checkbox') ? { checked: true } : selector.includes('separator') ? { value: '---' } : { value: 'First Line' } });
        allowFormatting = true;
        controller.observe(true);
        const beforeRegionalWrites = writes;
        detect.fire('click'); flush();
        assert.equal(writes, beforeRegionalWrites + 1);
        assert.equal(native.style.lineHeight, '1.5');
        assert.equal(value.split('---').length, 3);
        assert.equal(value.replaceAll('\n', ''), regionalBefore.replaceAll('\n', ''));
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'C2 \u00b7 L5 \u00b7 Gaze & expression'));
        const regionalAfter = value;
        detect.fire('click'); flush();
        assert.equal(value, regionalAfter);
        assert.equal(writes, beforeRegionalWrites + 1);
        undoSpacing.fire('click'); flush();
        assert.equal(value, regionalBefore);
        assert.equal(toggle.attributes['aria-checked'], 'false');
        // A spaced solo reuses authored gaps; only its first heading row is missing.
        document.querySelector = () => null;
        value = 'masterpiece,\n\nstepping,\n\nsolo,\n\nlong skirt,\n\nsleepy eyes,\n\nnight, balcony,\n\nlineart,\n';
        const spacedBefore = value, writesBeforeSpaced = writes;
        controller.observe(true); detect.fire('click'); flush();
        assert.equal(value, '\n' + spacedBefore);
        assert.equal(writes, writesBeforeSpaced + 1);
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'L6 \u00b7 Background'));
        detect.fire('click'); flush(); assert.equal(writes, writesBeforeSpaced + 1);
        undoSpacing.fire('click'); flush(); assert.equal(value, spacedBefore);
        value = 'masterpiece,\nstanding,\n---\n1girl, blue hair,\nblue dress,\nsmile,\nBREAK\n---\nBREAK\n1boy, green hair,\nwhite shirt,\nserious,\n---\n1girl, white hair,\nred dress,\nsmirk,';
        const breakSource = value;
        controller.observe(true); detect.fire('click'); flush();
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'BREAK · text chunk boundary'));
        assert.ok(wrapper.children[1].children.some(label => label.textContent.startsWith('C3 · L3')));
        const breakFormatted = value, breakWrites = writes;
        controller.observe(true); flush(); assert.equal(writes, breakWrites);
        assert.equal((breakFormatted.match(/^BREAK$/gm) ?? []).length, 2);
        undoSpacing.fire('click'); flush(); assert.equal(value, breakSource);
        const templates = controller.templates;
        const starter = templates.children.find(node => node.className === 'mdpf-template-starter');
        const [, type, countLabel, sharedLabel, , , replaceLabel, insert, undo] = starter.children;
        assert.equal(starter.open, false, 'Existing drafts keep replacement collapsed');
        type.value = 'pair'; type.fire('change');
        assert.match(insert.attributes['aria-description'], /Confirm replacement/);
        insert.fire('click'); assert.equal(value, breakSource, 'Insertion must require explicit replacement consent for a draft');
        replaceLabel.children[0].checked = true; replaceLabel.children[0].fire('change');
        insert.fire('click'); flush();
        assert.ok(value.includes('man next to girl,'));
        const addition = templates.children.find(node => node.className === 'mdpf-add-character');
        const [, addMode, addCount, addGlobal, addPlacement, , previewAdd, applyAdd, undoAdd] = addition.children;
        assert.equal(addition.open, true);
        assert.match(applyAdd.attributes['aria-description'], /Preview/);
        const beforeAdd = value;
        previewAdd.fire('click'); assert.equal(value, beforeAdd, 'Addition preview must be read-only');
        assert.equal(applyAdd.disabled, false);
        native.fire('compositionstart'); applyAdd.fire('click'); assert.equal(value, beforeAdd, 'Composition blocks insertion');
        assert.equal(insert.disabled, true); assert.match(insert.title, /composing/);
        native.fire('compositionend'); previewAdd.fire('click');
        addCount.value = '1boy'; addCount.fire('change'); assert.equal(applyAdd.disabled, true, 'Changed options require another preview');
        assert.match(applyAdd.attributes['aria-description'], /changed/);
        previewAdd.fire('click'); applyAdd.fire('click'); flush();
        assert.ok(wrapper.children[1].children.some(label => label.textContent.startsWith('C3 · L3')));
        assert.equal(value, addition.children[10].textContent, 'Apply must match the exact preview once');
        assert.equal(undoAdd.disabled, false);
        undoAdd.fire('click'); flush(); assert.equal(value, beforeAdd, 'Addition Undo restores exact original source');
        previewAdd.fire('click'); value += 'edited'; native.fire('input', { isTrusted: true });
        const laterDraft = value; applyAdd.fire('click'); assert.equal(value, laterDraft, 'Stale preview cannot overwrite later typing');
        value = beforeAdd; native.fire('input', { isTrusted: true }); flush();
        assert.equal(native.style.lineHeight, '1.5');
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'C2 · L5 · Gaze & expression'));
        const emptyOutfit = controller.getLineAssignments().rows.find(row => row.module === 4 && row.templateCharacter === 2);
        const beforeEnter = value;
        native.selectionStart = native.selectionEnd = emptyOutfit.start;
        native.fire('beforeinput');
        value = value.slice(0, emptyOutfit.start) + '\n' + value.slice(emptyOutfit.start);
        native.fire('input', { isTrusted: true }); flush();
        assert.equal(controller.getLineAssignments().rows.filter(row => row.templateGroup === emptyOutfit.templateGroup).length, 2);
        assert.equal(wrapper.children[1].children.filter(label => label.textContent === 'C2 · L4 · Outfit (top to bottom)').length, 1, 'Continuation must not duplicate its section heading');
        native.selectionStart = native.selectionEnd = emptyOutfit.start + 1;
        native.fire('beforeinput', { inputType: 'deleteWordBackward' });
        value = beforeEnter; native.fire('input', { isTrusted: true }); flush();
        assert.equal(controller.getLineAssignments().rows.filter(row => row.templateGroup === emptyOutfit.templateGroup).length, 1, 'Word deletion must use the actual continuation caret');
        native.selectionStart = native.selectionEnd = emptyOutfit.start;
        native.fire('beforeinput');
        value = value.slice(0, emptyOutfit.start) + '\n' + value.slice(emptyOutfit.start);
        native.fire('input', { isTrusted: true }); flush();
        native.selectionStart = emptyOutfit.start; native.selectionEnd = emptyOutfit.start + 1;
        native.fire('beforeinput'); value = beforeEnter; native.fire('input', { isTrusted: true }); flush();
        assert.equal(controller.getLineAssignments().rows.filter(row => row.templateGroup === emptyOutfit.templateGroup).length, 1);
        detect.fire('click'); flush();
        const pairSource = value;
        undo.fire('click'); flush(); assert.equal(value, breakSource, 'Template Undo must restore the original draft exactly');
        type.value = 'couple'; countLabel.children[0].value = '4'; sharedLabel.children[0].value = 'last'; type.fire('change');
        replaceLabel.children[0].checked = true; insert.fire('click'); flush();
        assert.equal((value.match(/1girl,/g) ?? []).length, 4);
        assert.ok(wrapper.children[1].children.some(label => label.textContent.startsWith('C4 · L3')));
        value += 'edited'; native.fire('input', { isTrusted: true }); flush();
        const modified = value; undo.fire('click'); assert.equal(value, modified, 'Undo must not overwrite later edits');
        assert.notEqual(value, pairSource);
        const draftBox = templates.children.find(node => node.className === 'mdpf-draft-files');
        assert.equal(draftBox.open, true);
        const [, saveDraft, fileLabel, previewDraft, replaceDraftLabel, loadDraft, undoLoad, , draftStatus] = draftBox.children;
        const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
        let savedBlob;
        try {
            URL.createObjectURL = blob => { savedBlob = blob; return 'blob:mdpf-offline-save-test'; };
            URL.revokeObjectURL = () => {};
            const fullPromptBeforeSave = value;
            saveDraft.fire('click');
            assert.ok(savedBlob, 'Save must prepare a draft containing the current native prompt');
            assert.equal(JSON.parse(await savedBlob.text()).prompt, fullPromptBeforeSave, 'Save must include the full existing textbox, not only starter/default sections');
            assert.equal(value, fullPromptBeforeSave, 'Saving must not edit the native prompt');
        } finally { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; }
        const file = fileLabel.children[0];
        assert.match(loadDraft.attributes['aria-description'], /Choose a saved/);
        const saved = serializeDraft(assignStarterTemplate(buildStarterTemplate('pair')));
        file.files = [{ size: saved.length, async text() { return saved; } }];
        const beforeFile = value;
        await [...file.handlers.change][0]();
        assert.match(loadDraft.attributes['aria-description'], /Confirm replacement/);
        assert.equal(value, beforeFile, 'Reading a local file is preview-only');
        loadDraft.fire('click'); assert.equal(value, beforeFile, 'Replacing a draft requires explicit consent');
        replaceDraftLabel.children[0].checked = true; replaceDraftLabel.children[0].fire('change');
        value += 'later edit'; native.fire('input', { isTrusted: true });
        loadDraft.fire('click'); assert.equal(value, beforeFile + 'later edit', 'Stale file previews must not overwrite new text');
        previewDraft.fire('click'); replaceDraftLabel.children[0].checked = true; replaceDraftLabel.children[0].fire('change');
        native.fire('compositionstart'); loadDraft.fire('click'); assert.equal(value, beforeFile + 'later edit'); native.fire('compositionend');
        loadDraft.fire('click'); flush();
        assert.equal(value, JSON.parse(saved).prompt);
        assert.ok(wrapper.children[1].children.some(label => label.textContent === 'C2 · L5 · Gaze & expression'));
        undoLoad.fire('click'); flush(); assert.equal(value, beforeFile + 'later edit', 'Load Undo restores exact previous text');
        previewDraft.fire('click'); replaceDraftLabel.children[0].checked = true; loadDraft.fire('click'); flush();
        const loadedLabel = controller.getLineAssignments().rows.find(row => row.module === 4);
        controller.setLineAssignments({ source: value, rows: [{ ...loadedLabel, module: 6 }] });
        const loadedSource = value; undoLoad.fire('click'); assert.equal(value, loadedSource, 'Undo must not discard later manual label changes');
        assert.ok(controller.getLineAssignments().rows.some(row => row.start === loadedLabel.start && row.module === 6));
        file.files = [{ size: 9, async text() { return 'invalid'; } }];
        await [...file.handlers.change][0](); assert.equal(value, loadedSource); assert.match(draftStatus.textContent, /not valid JSON/);
        let completeOldRead;
        file.files = [{ size: 10, text() { return new Promise(resolve => { completeOldRead = resolve; }); } }];
        const oldRead = [...file.handlers.change][0]();
        file.files = [{ size: saved.length, async text() { return saved; } }]; await [...file.handlers.change][0]();
        completeOldRead('bad old file'); await oldRead;
        assert.match(draftStatus.textContent, /Ready to load/, 'A late file read cannot replace the newer selection');
        const organizationHost = new Element('div');
        const organization = attachOrganization(native, organizationHost, {
            getLineAssignments: () => controller.getLineAssignments(), setLineAssignments: snapshot => controller.setLineAssignments(snapshot),
            getEditorSnapshot: () => controller.getEditorSnapshot(), restoreEditorSnapshot: snapshot => controller.restoreEditorSnapshot(snapshot),
        });
        for (const layout of ['solo', 'first', 'last', 'none']) {
            const template = layout === 'solo' ? buildStarterTemplate('solo') : buildStarterTemplate('couple', { characters: 3, globalPosition: layout });
            const initialWorkflow = assignStarterTemplate(template);
            const outfitRow = initialWorkflow.rows.find(row => row.templateSlot && row.module === 4);
            const duplicateSource = initialWorkflow.source.slice(0, outfitRow.start) + 'blue coat, blue coat,' + initialWorkflow.source.slice(outfitRow.end);
            let workflowState = updateAssignments(initialWorkflow, duplicateSource, { supported: false }, { reason: 'typing', edit: { source: initialWorkflow.source, start: outfitRow.start, end: outfitRow.end } });
            const qualityRow = workflowState.rows.find(row => row.templateSlot && row.module === 1);
            if (qualityRow) {
                const qualitySource = workflowState.source.slice(0, qualityRow.start) + 'masterpiece,' + workflowState.source.slice(qualityRow.end);
                workflowState = updateAssignments(workflowState, qualitySource, { supported: false }, { reason: 'typing', edit: { source: workflowState.source, start: qualityRow.start, end: qualityRow.end } });
            }
            const savedWorkflow = serializeDraft(workflowState);
            file.files = [{ size: savedWorkflow.length, async text() { return savedWorkflow; } }]; await [...file.handlers.change][0]();
            replaceDraftLabel.children[0].checked = true; loadDraft.fire('click'); flush();
            if (layout === 'none') toggle.fire('click'); // Revert must also restore an Off editor.
            const originalEditor = controller.getEditorSnapshot();
            const savedBeforeOrganization = serializeDraft(originalEditor.labels, { enabled: originalEditor.active, compact: originalEditor.compact, extraQualityLine: originalEditor.extra });
            const context = layout === 'solo' ? {} : { couple: { state: 'enabled', mode: 'Basic', separator: '---', globalPosition: layout, tileEnabled: false, commonSyntax: 'off' } };
            const organized = organization.autoFix(context);
            assert.equal(organized.applied, true, organized.message);
            assert.equal(organization.revertAutoFix(), true);
            flush();
            const afterRevert = controller.getEditorSnapshot();
            assert.equal(serializeDraft(afterRevert.labels, { enabled: afterRevert.active, compact: afterRevert.compact, extraQualityLine: afterRevert.extra }), savedBeforeOrganization, 'Revert must restore the full savable draft, including blank headings and owner labels');
            assert.equal(controller.restoreEditorSnapshot({ ...afterRevert, source: value + 'stale' }), false);
            const invalidSnapshot = structuredClone(afterRevert); invalidSnapshot.labels.rows[0].end++;
            assert.equal(controller.restoreEditorSnapshot(invalidSnapshot), false);
            if (layout === 'solo') {
                const confirmation = organization.panel.children[2].children[0];
                const [prepareReview, applyReview, revertReview] = organization.panel.children[3].children;
                confirmation.checked = true; confirmation.fire('change'); prepareReview.fire('click');
                assert.equal(applyReview.disabled, false);
                applyReview.fire('click'); revertReview.fire('click'); flush();
                const restoredReview = controller.getEditorSnapshot();
                assert.equal(serializeDraft(restoredReview.labels, { enabled: restoredReview.active, compact: restoredReview.compact, extraQualityLine: restoredReview.extra }), savedBeforeOrganization, 'Reviewed Apply/Revert also restores the complete draft');
            }
        }
        organization.destroy();
        controller.destroy();
        assert.equal(native.parentElement, wrapper);
        assert.equal(wrapper.children.length, 1);
        assert.equal(body.children.length, 0);
        assert.equal(native.handlers.input.size, 0);
        assert.equal(native.handlers.beforeinput.size, 0);
    } finally {
        for (const key of keys) if (originals[key] === undefined) delete globalThis[key]; else globalThis[key] = originals[key];
    }
});

// Forge transfers can emit input/change or replace .value silently. Exercise
// those delivery contracts without depending on PNG files or generation.
function replacementEnvironment(run) {
    const keys = ['document', 'window', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle'];
    const originals = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
    const body = new Element('body');
    const document = { body, createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }), querySelector: () => null };
    const frames = new Map(); let sequence = 0;
    Object.assign(globalThis, {
        document, window: new Element('window'), ResizeObserver: class { observe() {} disconnect() {} },
        requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; }, cancelAnimationFrame: id => frames.delete(id),
        getComputedStyle: () => ({ paddingTop: '8px', paddingLeft: '12px', paddingRight: '8px', lineHeight: '24px', fontSize: '16px' }),
    });
    const instances = [];
    const mount = (source, id) => {
        const host = new Element('div'), wrapper = new Element('label'), native = new Element('textarea');
        native.value = source; native.clientWidth = 600; native.clientHeight = 160; native.scrollTop = 0;
        native.selectionStart = native.selectionEnd = 0;
        native.offsetTop = native.offsetLeft = native.clientTop = native.clientLeft = 0;
        host.ownerDocument = document; wrapper.append(native); host.append(wrapper);
        let extra = false;
        const inline = attachInlineEditor(native, host, id, { getExtraQuality: () => extra, setExtraQuality: value => { extra = value; } });
        const organization = attachOrganization(native, new Element('div'), {
            getLineAssignments: () => inline.getLineAssignments(), setLineAssignments: state => inline.setLineAssignments(state),
            getEditorSnapshot: () => inline.getEditorSnapshot(), restoreEditorSnapshot: state => inline.restoreEditorSnapshot(state),
        });
        const instance = { native, inline, organization, replace(text, delivery) {
            native.value = text;
            if (delivery !== 'poll') native.fire(delivery, { isTrusted: false });
            inline.observe(); organization.observe();
        } };
        instances.push(instance); return instance;
    };
    try { run(mount); }
    finally {
        for (const { inline, organization } of instances) { organization.destroy(); inline.destroy(); }
        for (const key of keys) if (originals[key] === undefined) delete globalThis[key]; else globalThis[key] = originals[key];
    }
}

const replacementLayouts = [buildStarterTemplate('solo'), buildStarterTemplate('pair'),
    buildStarterTemplate('couple', { characters: 2, globalPosition: 'first' }),
    buildStarterTemplate('couple', { characters: 4, globalPosition: 'last' }),
    buildStarterTemplate('couple', { characters: 3, globalPosition: 'none' })];
for (const delivery of ['input', 'change', 'poll']) test(`Forge ${delivery} replacement clears old labels and leaves the other tab unchanged`, () => {
    replacementEnvironment(mount => {
        for (const [targetId, otherId] of [['txt2img', 'img2img'], ['img2img', 'txt2img']])
        for (const template of replacementLayouts) for (const replacement of ['', '1boy, green hair, black coat, forest,',
            'masterpiece,\nstanding,\n1girl, blue hair,\nblue dress,\nsmile,\ncastle,\nanime style,',
            'masterpiece,\n---\n1boy,\nblack coat,\nfrown,\n---\n1girl,\nblue dress,\nsmile,',
            'cinematic lighting, ' + template.source, template.source + ', watercolor,']) {
            const a = mount(template.source, targetId), b = mount(template.source, otherId);
            for (const view of [a, b]) assert.equal(view.inline.restoreEditorSnapshot({
                source: template.source, labels: assignStarterTemplate(template), active: true, compact: true, extra: false,
            }), true);
            const untouched = b.inline.getEditorSnapshot();
            assert.ok(a.inline.getLineAssignments().rows.length);
            a.replace(replacement, delivery);
            assert.equal(a.native.value, replacement, 'Observing an import must not format or rewrite it');
            assert.deepEqual(a.inline.getLineAssignments().rows, [], 'Old labels must not attach to the imported prompt');
            assert.deepEqual(b.inline.getEditorSnapshot(), untouched, `${targetId} import must not modify ${otherId} state`);
        }
    });
});

for (const delivery of ['input', 'change', 'poll']) test(`Forge ${delivery} replacement invalidates preview and guards prior Auto Fix Revert`, () => {
    replacementEnvironment(mount => {
        const source = 'smile, blue dress, 1girl, solo, blue hair, castle, masterpiece, standing, blue dress,';
        const view = mount(source, 'txt2img');
        const panel = view.organization.panel;
        const confirm = panel.children[2].children[0];
        const [preview, apply, revert] = panel.children[3].children;
        confirm.checked = true; confirm.fire('change'); preview.fire('click');
        assert.equal(apply.disabled, false);
        const imported = '1boy, green hair, black coat, forest,';
        view.replace(imported, delivery);
        assert.equal(apply.disabled, true);
        apply.fire('click'); assert.equal(view.native.value, imported);
        // Recreate the source and apply a new edit so this case also has Undo.
        view.replace(source, delivery);
        assert.equal(view.organization.autoFix().applied, true);
        assert.equal(view.organization.getAutoFixState().canRevert, true);
        view.replace('', delivery);
        assert.equal(revert.disabled, true);
        assert.equal(view.organization.getAutoFixState().canRevert, false);
        assert.equal(view.organization.revertAutoFix(), false);
        assert.equal(view.native.value, '', 'Old Undo must never replace a cleared prompt');
    });
});
