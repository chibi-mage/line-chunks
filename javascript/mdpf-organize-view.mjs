import { previewOrganization, previewRegionalOrganization, previewCharacterOrganization, previewBreakImport, detectBreakImport, organizationRows } from './mdpf-organize.mjs?v=0.49.4-alpha.1';
import { MODULES } from './mdpf-core.mjs?v=0.49.4-alpha.1';
import { previewWithLineAssignments, organizedLineAssignments, planAutoFix } from './mdpf-line-organization.mjs?v=0.49.4-alpha.1';
import { reviewOrganizationItems } from './mdpf-review.mjs?v=0.49.4-alpha.1';

// A receipt never guesses a tag's previous section. Groups count as one item;
// LoRA references are not counted as unknown tags. All values render as text.
export function buildAutoFixAudit(result, state, message) {
    const moves = result?.moves ?? [], items = result?.items ?? [];
    const removed = (result?.duplicates ?? []).filter(item => item.removed);
    const unknown = items.filter(item => !item.removedDuplicate && item.evidenceKind === 'unclassified' && item.placement === 'provisional L7');
    const scope = item => item.scopeLabel ? ` · ${item.scopeLabel}` : '';
    const lines = [];
    if (result?.autoFixMode === 'regional') lines.push(`${result.ownerCount} character regions; shared ${result.sharedPosition} unchanged. BREAK membership preserved.`, '');
    if (state === 'blocked') {
        lines.push('Auto Fix did not complete. See the reason below.', message, ...(result?.issues ?? []));
        for (const item of items.filter(item => item.module === null && !item.removedDuplicate))
            lines.push(`${item.text}${scope(item)}: ${item.reason ?? 'Choose a destination in review.'}${item.tentative ? ` Tentative L${item.tentative.module}; confirm in review.` : ''}`);
    }
    if (moves.length) lines.push(state === 'applied' ? 'Organized items and destinations (source item order):' : 'Planned destinations (no completed Auto Fix write):',
        ...moves.map(item => `${item.text} → L${item.module} · ${MODULES[item.module - 1]}${scope(item)} (${item.placement})`), '');
    lines.push(`Removed exact duplicates: ${state === 'applied' ? removed.length : 0}`);
    for (const item of removed) lines.push(`${state === 'applied' ? 'Removed' : 'Would remove'}: ${item.text}${scope(item)} · kept source item ${item.keptIndex + 1}`);
    lines.push('', `${state === 'applied' ? 'Unknown tags provisionally placed in L7' : 'Unknown tags proposed for L7 (not applied)'}: ${unknown.length}`, ...unknown.map(item => `${item.text}${scope(item)}`),
        'Possible triggers are not identified or bound to a LoRA. References and quality/style hints may also use L7; see their destinations above.');
    return { state, organized: state === 'applied' ? moves.length : 0, removed: state === 'applied' ? removed.length : 0, unknown: unknown.length,
        summary: state === 'applied' ? `Organized ${moves.length} ${moves.length === 1 ? 'item' : 'items'} · Removed ${removed.length} ${removed.length === 1 ? 'duplicate' : 'duplicates'} · ${unknown.length} unknown → L7` : message,
        details: lines.join('\n') || message };
}

export function attachOrganization(native, container, { unknownStyle = true, getLineAssignments = () => null, setLineAssignments = () => {}, getEditorSnapshot = () => null, restoreEditorSnapshot = () => false, getAutoFixContext = () => ({}) } = {}) {
    const make = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
    const panel = make('details'); panel.className = 'mdpf-organize';
    panel.append(make('summary', 'Organize · prompt preview'));
    const description = make('p', 'Preview grouping into L1–L7. Explicit Assign line labels are respected; reset a line label to let scoring choose again. Unrecognized text and standalone LoRAs otherwise receive provisional L7 placement. Choices do not train the classifier or verify trigger associations.'); panel.append(description);
    const label = make('label'), solo = make('input'); solo.type = 'checkbox';
    const confirmationText = document.createTextNode(' This prompt describes one character'); label.append(solo, confirmationText);
    const prepare = make('button', 'Preview organization'), apply = make('button', 'Apply organization'), revert = make('button', 'Revert organization');
    for (const button of [prepare, apply, revert]) button.type = 'button';
    apply.disabled = revert.disabled = true;
    const actions = make('div'); actions.className = 'mdpf-toolbar'; actions.append(prepare, apply, revert);
    const status = make('p', 'Positive prompt unchanged.'); status.setAttribute('role', 'status');
    const review = make('pre'), original = make('pre'), proposed = make('pre');
    const comparison = make('details'); comparison.append(make('summary', 'Compare exact original and proposed text'), make('p', 'Original'), original, make('p', 'Proposed'), proposed); comparison.hidden = true;
    panel.append(label, actions, status, review, comparison); container.append(panel);
    const choices = make('details'); choices.className = 'mdpf-organization-choices'; choices.hidden = true;
    panel.append(choices);
    const blockControls = make('details'); blockControls.className = 'mdpf-organization-choices'; blockControls.hidden = true; panel.append(blockControls);
    const duplicateControls = make('details'); duplicateControls.className = 'mdpf-organization-choices'; panel.append(duplicateControls);
    const importControls = make('details'); importControls.className = 'mdpf-organization-choices'; importControls.hidden = true; panel.append(importControls);
    let importRoles = [], importSource = null, importRevision = 0;
    let placements = {}, bundles = [], choiceSource = null, characterRanges = [], keepDuplicates = [];
    let deduplicate = true;
    let reviewMode = 'auto', choiceRevision = 0, disposed = false;
    let snapshot = null, undo = null, composing = false, writing = false, observed = native.value;
    let observedLabels;
    const clearChoices = () => { choiceRevision++; placements = {}; bundles = []; keepDuplicates = []; choiceSource = null; characterRanges = []; importRoles = []; importSource = null; if (scope.select.value === 'break-import') solo.checked = false; reviewMode = 'auto'; choices.replaceChildren(); choices.hidden = true; renderBlockControls(); renderImportControls(); renderDuplicates(); };
    const invalidateChoices = () => { snapshot = null; apply.disabled = true; status.textContent = 'Choices changed. Preview again to review the new proposal.'; };
    function observe() {
        if (writing) return;
        const sourceChanged = native.value !== observed;
        if (native.value !== observed) {
            observed = native.value; snapshot = null; apply.disabled = true;
            clearChoices();
            status.textContent = 'Prompt changed. Preview again before applying. Previous comparison is retained.';
        }
        const labels = JSON.stringify(getLineAssignments());
        if (!sourceChanged && observedLabels !== undefined && labels !== observedLabels) {
            choiceRevision++;
            placements = {}; bundles = []; keepDuplicates = []; choiceSource = native.value;
            choices.replaceChildren(); choices.hidden = true; renderDuplicates();
            snapshot = null; apply.disabled = true;
            status.textContent = 'Manual line labels changed. Preview again; previous item choices were cleared.';
        }
        observedLabels = labels;
        revert.disabled = composing || !undo || native.value !== undo.after;
    }
    function write(text) {
        writing = true;
        try {
            native.value = text;
            if (typeof updateInput === 'function') updateInput(native);
            else native.dispatchEvent(new Event('input', { bubbles: true }));
        } finally { writing = false; observed = native.value; }
    }
    const invalidate = () => { snapshot = null; apply.disabled = true; status.textContent = 'Confirmation changed. Preview again.'; };
    solo.addEventListener('change', invalidate);
    function selectField(text, options, value) {
        const label = make('label', text), select = make('select'); select.setAttribute('aria-label', text);
        for (const [key, name] of options) { const option = make('option', name); option.value = String(key); select.append(option); }
        select.value = String(value); label.append(select); return { label, select };
    }
    const destinations = MODULES.map((name, index) => [index + 1, `L${index + 1} · ${name}`]);
    const scope = selectField('Organization scope', [['solo', 'Solo'], ['regional', 'Regional · standalone ---'], ['characters', 'Character blocks · confirmed line ranges'], ['break-import', 'BREAK import · confirm blocks']], 'solo');
    const shared = selectField('Shared chunk', [['unverified', 'Choose explicitly'], ['first', 'First chunk'], ['last', 'Last chunk'], ['none', 'None']], 'unverified');
    shared.label.hidden = true; description.append(scope.label, shared.label);
    const plan = () => previewWithLineAssignments(
        scope.select.value === 'regional' ? previewRegionalOrganization : scope.select.value === 'characters' ? previewCharacterOrganization : scope.select.value === 'break-import' ? previewBreakImport : previewOrganization,
        native.value, { confirmedSolo: solo.checked, confirmedRegions: solo.checked, confirmedCharacters: solo.checked,
            confirmedImport: solo.checked && importSource === native.value, importRoles,
            sharedPosition: shared.select.value, characterRanges, placements, bundles, unknownStyle, deduplicate, keepDuplicates }, getLineAssignments());
    function renderDuplicates(result = null, applied = false) {
        duplicateControls.replaceChildren(make('summary', applied ? 'Removed duplicates · last Apply' : 'Duplicate tags · review removals'));
        const label = make('label'), toggle = make('input'); toggle.type = 'checkbox'; toggle.checked = deduplicate;
        label.append(toggle, document.createTextNode(' Remove exact duplicate tags')); toggle.disabled = applied;
        toggle.addEventListener('change', () => { deduplicate = toggle.checked; invalidateChoices(); renderDuplicates(plan()); });
        duplicateControls.append(label, make('p', 'Only exact repeated plain tags in the same editable character/region, BREAK segment and destination are removed. Weighted groups, LoRAs, verified bundles and locked shared text stay intact. No synonym merging. Changes happen only on Apply.'));
        const entries = result?.duplicates ?? [];
        duplicateControls.append(make('p', applied ? `${entries.filter(entry => entry.removed).length} repeated occurrence(s) removed. Revert organization restores the exact original, including repeats; preview again and select Keep for any intentional occurrence. You can also copy the tags below.`
            : `${entries.filter(entry => entry.removed).length} repeated occurrence(s) marked for removal. Select Keep to retain an occurrence, then Preview again.`));
        for (const entry of entries) {
            if (applied && !entry.removed) continue;
            const text = `item ${entry.index + 1}: ${entry.text}${entry.scopeLabel ? ' · ' + entry.scopeLabel : ''} (first at item ${entry.keptIndex + 1})`;
            if (applied) duplicateControls.append(make('p', text));
            else {
                const label = make('label'), keep = make('input'); keep.type = 'checkbox'; keep.checked = keepDuplicates.includes(entry.index);
                label.append(keep, document.createTextNode(' Keep repeat ' + text));
                keep.addEventListener('change', () => {
                    keepDuplicates = keep.checked ? [...new Set([...keepDuplicates, entry.index])] : keepDuplicates.filter(index => index !== entry.index);
                    invalidateChoices(); renderDuplicates(plan());
                }); duplicateControls.append(label);
            }
        }
        if (entries.length) duplicateControls.open = true;
    }
    renderDuplicates();
    scope.select.addEventListener('change', () => {
        clearChoices(); solo.checked = false; shared.label.hidden = scope.select.value !== 'regional';
        confirmationText.textContent = scope.select.value === 'regional' ? ' I verified each editable chunk describes one character'
            : scope.select.value === 'characters' ? ' I verified each editable character block describes one character'
            : scope.select.value === 'break-import' ? ' I verified every shared and character block and the BREAK boundaries' : ' This prompt describes one character';
        invalidate();
    });
    shared.select.addEventListener('change', () => { clearChoices(); solo.checked = false; invalidate(); });
    function renderImportControls() {
        const revision = ++importRevision;
        importControls.replaceChildren(); importControls.hidden = scope.select.value !== 'break-import';
        if (importControls.hidden) return;
        importControls.open = true;
        importControls.append(make('summary', 'Review BREAK import blocks'), make('p', 'Use row-leading uppercase BREAK, either alone or before text on the same row. Detect is read-only. Review every suggested Shared/Character role, confirm above, then Preview and Apply. Shared text and BREAK bytes stay locked; character blocks organize L3–L7. No Forge Couple settings or LoRA associations are inferred.'));
        const source = native.value, detect = make('button', 'Detect candidate blocks'); detect.type = 'button';
        const current = () => { observe(); return !disposed && !composing && importRevision === revision && native.value === source && scope.select.value === 'break-import'; };
        detect.addEventListener('click', () => {
            if (!current()) return;
            const detected = detectBreakImport(source);
            placements = {}; bundles = []; keepDuplicates = []; choiceSource = source; snapshot = null; apply.disabled = true; solo.checked = false;
            choices.replaceChildren(); choices.hidden = true;
            importSource = source; importRoles = detected.issues.length ? [] : detected.chunks.map(chunk => chunk.suggestedRole);
            renderImportControls(); renderDuplicates();
            status.textContent = detected.issues.length ? detected.issues.join(' ') : 'Candidates detected only. Review each role and confirm ownership before Preview. No prompt changes made.';
        });
        importControls.append(detect);
        if (importSource !== source) return;
        const detected = detectBreakImport(source);
        if (detected.issues.length) { importControls.append(make('p', detected.issues.join(' '))); return; }
        importControls.append(make('p', `${importRoles.filter(role => role === 'character').length} candidate characters; ${importRoles.filter(role => role === 'shared').length} shared blocks. Counts and boundaries still need your confirmation.`));
        detected.chunks.forEach((chunk,index) => {
            const role = selectField(`Role for BREAK block ${index + 1}`, [['shared','Shared · keep exact text'],['character','Character · organize L3–L7']], importRoles[index]);
            role.select.addEventListener('change', () => {
                if (!current() || !['shared','character'].includes(role.select.value)) return;
                importRoles[index] = role.select.value; solo.checked = false; placements = {}; bundles = []; keepDuplicates = []; choiceRevision++;
                choices.replaceChildren(); choices.hidden = true; invalidateChoices(); renderDuplicates(); renderImportControls();
            });
            importControls.append(role.label, make('pre', chunk.text));
        });
    }
    function renderBlockControls() {
        blockControls.replaceChildren(); blockControls.hidden = scope.select.value !== 'characters';
        if (blockControls.hidden) return;
        blockControls.open = true;
        blockControls.append(make('summary', 'Confirm character line ranges'), make('p', 'Add two to eight nonoverlapping ranges. Start each on its 1girl/1boy/1other row. Include only that character’s intended lines. Text outside the ranges stays locked. Blocks are ordered by source position. These are text groups, not regional conditioning.'));
        const renderedSource = native.value, rows = organizationRows(renderedSource);
        const firstOptions = rows.filter(row => /^\s*1(?:girl|boy|other)\s*(?:,|$)/i.test(row.text)).map(row => [row.index, `Line ${row.index + 1} · ${row.text}`]);
        const lastOptions = rows.filter(row => row.text.trim()).map(row => [row.index, `Line ${row.index + 1} · ${row.text}`]);
        const first = selectField('First character line', firstOptions, firstOptions[0]?.[0] ?? '');
        const last = selectField('Last character line', lastOptions, firstOptions[0]?.[0] ?? '');
        const verified = make('input'); verified.type = 'checkbox';
        for (const field of [first, last]) field.select.addEventListener('change', () => { verified.checked = false; });
        const verification = make('label'); verification.append(verified, document.createTextNode(' I verified this character block’s line range'));
        const add = make('button', 'Confirm character range'); add.type = 'button'; add.disabled = !firstOptions.length || characterRanges.length >= 8;
        const changed = () => {
            placements = {}; bundles = []; keepDuplicates = []; choiceSource = native.value; snapshot = null; apply.disabled = true; solo.checked = false;
            renderDuplicates();
            choices.replaceChildren(); choices.hidden = true; renderBlockControls();
            status.textContent = 'Character ranges changed. Confirm ownership, then Preview again.';
        };
        add.addEventListener('click', () => {
            observe(); if (composing || native.value !== renderedSource || !firstOptions.length || characterRanges.length >= 8) return;
            if (!verified.checked) { status.textContent = 'Verify the selected character line range before confirming it.'; return; }
            const range = { first: Number(first.select.value), last: Number(last.select.value) };
            if (range.last < range.first || characterRanges.some(item => range.first <= item.last && range.last >= item.first)) { status.textContent = 'Select an ordered, nonoverlapping character range.'; return; }
            characterRanges.push(range); changed();
        });
        blockControls.append(first.label, last.label, verification, add);
        if (!firstOptions.length) blockControls.append(make('p', 'No explicit single-character starting row was found. Flat or ambiguous prompts remain manual.'));
        for (const [index, range] of characterRanges.entries()) {
            const entry = make('p', `Confirmed range ${index + 1}: lines ${range.first + 1}–${range.last + 1} `);
            const remove = make('button', `Remove character range ${index + 1}`); remove.type = 'button';
            remove.addEventListener('click', () => { characterRanges.splice(index, 1); changed(); }); entry.append(remove); blockControls.append(entry);
        }
    }
    function renderChoices(result) {
        const renderedRevision = ++choiceRevision;
        choices.replaceChildren(make('summary', 'Select items · destinations and verified bundles'));
        choices.hidden = !result.items.length;
        const evidenceLabels = { 'recognized-style': 'Recognized style evidence', 'lora-reference': 'LoRA reference · role and triggers unverified',
            unclassified: 'Unclassified text · possible trigger; association unknown', 'quality-style-ambiguity': 'Ambiguous evidence · L1 / L7' };
        const l7 = result.items.filter(item => item.module === 7 && !item.removedDuplicate);
        const countLabels = { 'recognized-style': 'recognized style', 'lora-reference': 'LoRA references (unverified role)', unclassified: 'unclassified text', 'quality-style-ambiguity': 'L1 / L7 ambiguity' };
        const counts = Object.keys(evidenceLabels).map(kind => `${countLabels[kind]}: ${l7.filter(item => item.evidenceKind === kind).length}`);
        choices.append(make('p', `Previewed L7 destinations · ${counts.join(' · ')}. Manual or bundled placements can also have other evidence.`));
        if (result.items.some(item => !item.removedDuplicate && ['unclassified', 'quality-style-ambiguity'].includes(item.evidenceKind))) choices.open = true;
        const renderedSource = native.value;
        const groups = reviewOrganizationItems(result.items);
        const currentMode = reviewMode === 'auto' ? groups.attention.length ? 'attention' : groups.manual.length ? 'manual' : 'all' : reviewMode;
        const filter = selectField('Organization review view', [['attention', `Needs attention (${groups.attention.length})`], ['manual', `Manual line placements (${groups.manual.length})`], ['all', `All items (${groups.all.length})`]], currentMode);
        const filterNote = make('p'); filterNote.setAttribute('role', 'status');
        const renderedRows = [];
        const selected = new Set();
        const canSelect = item => !item.lineAssignment && item.bundleIndex === null && !item.removedDuplicate;
        const selection = make('div'); selection.className = 'mdpf-item-selection';
        const selectedCount = make('p'); selectedCount.setAttribute('role', 'status');
        const bulkDestination = selectField('Move selected items to', [['', 'Automatic destinations'],
            ...destinations.filter(([module]) => !result.characterBlocks || module >= 3)], 3);
        const selectShown = make('button', 'Select shown items'), clearSelected = make('button', 'Clear selection'), moveSelected = make('button', 'Set destination');
        for (const button of [selectShown, clearSelected, moveSelected]) button.type = 'button';
        const currentSource = () => {
            observe(); return !disposed && !composing && choiceRevision === renderedRevision && choiceSource === native.value && native.value === renderedSource;
        };
        const syncSelection = () => {
            const hidden = renderedRows.filter(({item,row}) => row.hidden && selected.has(item.index)).length;
            selectedCount.textContent = `${selected.size} selected${hidden ? ` · ${hidden} hidden by this view` : ''}. Selection is for this preview only.`;
            moveSelected.disabled = clearSelected.disabled = selected.size === 0;
            selectShown.disabled = !renderedRows.some(({item,row}) => !row.hidden && canSelect(item));
            for (const {item,check} of renderedRows) check.checked = selected.has(item.index);
        };
        selectShown.addEventListener('click', () => {
            if (!currentSource()) return;
            for (const {item,row} of renderedRows) if (!row.hidden && canSelect(item)) selected.add(item.index);
            syncSelection();
        });
        clearSelected.addEventListener('click', () => { if (!currentSource()) return; selected.clear(); syncSelection(); });
        moveSelected.addEventListener('click', () => {
            if (!currentSource() || !selected.size) return;
            const value = bulkDestination.select.value;
            if (value !== '' && !destinations.some(([module]) => String(module) === value && (!result.characterBlocks || module >= 3))) return;
            let count = 0;
            for (const {item,field,syncQuick,hintButton} of renderedRows) if (selected.has(item.index) && canSelect(item)) {
                if (value === '') delete placements[item.index]; else placements[item.index] = Number(value);
                field.select.value = value; syncQuick();
                if (hintButton) hintButton.disabled = Object.hasOwn(placements, item.index);
                count++;
            }
            selected.clear(); syncSelection(); invalidateChoices();
            status.textContent = `${count} item destination(s) ${value === '' ? 'reset to automatic' : 'set to L' + value} for this prompt. Preview again, then Apply. Character regions and intact groups stay protected.`;
        });
        selection.append(selectedCount, bulkDestination.label, selectShown, clearSelected, moveSelected,
            make('p', 'Select one or more items, including recognized tags in All items. Set a destination, Preview again, then Apply. Manual line labels, verified bundles and repeats marked for removal cannot be selected; reset their label, remove the bundle or Keep the repeat first. Weighted groups move as one intact item.'));
        const rows = make('div'); rows.className = 'mdpf-organization-items';
        for (const item of result.items) {
            const row = make('div'); row.append(make('p', `${item.index + 1}. ${item.text}${item.regionIndex === undefined ? '' : ` · ${item.scopeLabel ?? 'Chunk ' + (item.regionIndex + 1)}`}`));
            const selectionLabel = make('label', `Select item ${item.index + 1}`), check = make('input'); check.type = 'checkbox';
            check.setAttribute('aria-label', `Select item ${item.index + 1}: ${item.text}`); check.disabled = !canSelect(item);
            selectionLabel.append(check); row.append(selectionLabel);
            check.addEventListener('change', () => {
                if (!currentSource() || !canSelect(item)) return;
                if (check.checked) selected.add(item.index); else selected.delete(item.index);
                syncSelection();
            });
            if (item.lineAssignment) row.append(make('p', `Manual line ${item.lineAssignment.line} · ${item.lineAssignment.module === null ? 'Unassigned' : 'L' + item.lineAssignment.module}. Reset or change it in Assign line to choose another destination.`));
            if (item.removedDuplicate) row.append(make('p', 'Exact repeat · marked for removal. Use Duplicate tags · review removals to Keep this occurrence.'));
            if (evidenceLabels[item.evidenceKind]) { const badge = make('p', evidenceLabels[item.evidenceKind]); badge.className = 'mdpf-evidence-label'; row.append(badge); }
            const fallbackLabel = item.evidenceKind === 'lora-reference' ? 'LoRA reference' : item.evidenceKind === 'quality-style-ambiguity' ? 'L1 / L7 ambiguity' : 'unclassified';
            const provisional = item.automatic === 7 && ['lora-reference', 'unclassified', 'quality-style-ambiguity'].includes(item.evidenceKind);
            const automatic = item.bundleIndex !== null ? `Bundle ${item.bundleIndex + 1} · L${item.module}` : provisional ? `Provisional L7 · ${fallbackLabel}` : item.automatic ? `Automatic · L${item.automatic}` : 'Needs review';
            const field = selectField(`Destination for item ${item.index + 1}`, [['', automatic], ...destinations], placements[item.index] ?? '');
            const quickButtons = [];
            const syncQuick = () => { for (const [button, module] of quickButtons) button.setAttribute('aria-pressed', String(placements[item.index] === module)); };
            let hintButton;
            if (item.lineAssignment) { field.select.disabled = true; field.select.value = String(item.lineAssignment.module ?? ''); }
            if (item.bundleIndex !== null) {
                field.select.disabled = true;
                row.append(make('p', `Bundle ${item.bundleIndex + 1} · L${item.module} (remove the bundle to place this item separately)`));
            }
            field.select.addEventListener('change', () => {
                if (item.lineAssignment) return;
                observe(); if (composing || choiceSource !== native.value || native.value !== renderedSource) return;
                if (field.select.value === '') delete placements[item.index]; else placements[item.index] = Number(field.select.value);
                if (hintButton) hintButton.disabled = Object.hasOwn(placements, item.index);
                syncQuick();
                invalidateChoices();
            });
            if (!item.lineAssignment && item.bundleIndex === null && !item.removedDuplicate && ['unclassified', 'quality-style-ambiguity'].includes(item.evidenceKind)) {
                const quick = make('div'); quick.className = 'mdpf-quick-placements';
                const names = ['Quality', 'Camera/pose', 'Character', 'Outfit', 'Expression', 'Background', 'Style'];
                names.forEach((name, index) => {
                    const module = index + 1;
                    if (result.characterBlocks && module < 3) return;
                    const button = make('button', `L${module} ${name}`); button.type = 'button'; button.setAttribute('aria-label', `Place item ${item.index + 1} in L${module}`);
                    button.addEventListener('click', () => {
                        observe(); if (composing || choiceSource !== native.value || native.value !== renderedSource) return;
                        placements[item.index] = module; field.select.value = String(module); syncQuick();
                        invalidateChoices(); status.textContent = 'Destination chosen for this preview. Preview again before applying.';
                    }); quickButtons.push([button, module]); quick.append(button);
                });
                syncQuick(); row.append(quick);
                if (result.characterBlocks) row.append(make('p', result.breakImport ? 'Confirmed import character blocks allow L3–L7. Shared quality and camera text stays locked.' : 'Confirmed character ranges allow L3–L7. Keep quality and camera content outside these ranges.'));
            }
            if (!item.lineAssignment && item.tentative && item.bundleIndex === null && item.placement !== 'manual' && !item.removedDuplicate) {
                const module = item.tentative.module;
                row.append(make('p', `Tentative · L${module} · ${MODULES[module - 1]}. Matched: ${item.tentative.evidence.map(match => match.tag).join(', ')}. Evidence is below the automatic threshold; no destination is selected.`));
                if (result.characterBlocks && module < 3) {
                    row.append(make('p', 'Keep camera and quality content outside confirmed character ranges. Adjust the range or prompt before organizing.'));
                } else {
                    hintButton = make('button', `Use tentative L${module} for item ${item.index + 1}`); hintButton.type = 'button';
                    hintButton.addEventListener('click', () => {
                        observe(); if (composing || choiceSource !== native.value || Object.hasOwn(placements, item.index)) return;
                        placements[item.index] = module; field.select.value = String(module); hintButton.disabled = true;
                        invalidateChoices(); status.textContent = 'Tentative destination accepted as a manual choice. Preview again before applying.';
                    }); row.append(hintButton);
                }
            }
            row.append(field.label); rows.append(row); renderedRows.push({ item, row, check, field, syncQuick, hintButton });
        }
        const showView = () => {
            const visible = new Set(groups[filter.select.value].map(item => item.index));
            for (const { item, row } of renderedRows) row.hidden = !visible.has(item.index);
            filterNote.textContent = `${visible.size} of ${result.items.length} preview items shown. ${visible.size ? '' : 'No items in this view; choose All items to inspect the complete list. '}Views use the last preview and do not change its placements or Apply eligibility. Bundle ranges still include hidden items. Unknown items shown here may be intentional.`;
            syncSelection();
        };
        filter.select.addEventListener('change', () => {
            observe(); if (choiceSource !== native.value || native.value !== renderedSource || !Object.hasOwn(groups, filter.select.value)) return;
            reviewMode = filter.select.value; showView();
        });
        showView();
        choices.append(make('p', 'Explicit Assign line labels take priority over scoring and item choices. Applied item choices and bundles are retained as session line labels. Locked shared text remains unchanged. These choices do not teach the classifier; source edits clear pending item choices.'), filter.label, filterNote, selection, rows);
        const heading = make('p', 'Bundle a contiguous range. Every item between the first and last moves together, preserving its order. A LoRA without trigger tags can be a one-item bundle. We never infer associations.'); choices.append(heading);
        const ranges = result.items.map(item => [item.index, `${item.index + 1}. ${item.text}`]);
        const first = selectField('First bundle item', ranges, result.items[0]?.index ?? 0);
        const last = selectField('Last bundle item', ranges, result.items[0]?.index ?? 0);
        const destination = selectField('Bundle destination', destinations, 3);
        const verified = make('input'); verified.type = 'checkbox';
        verified.setAttribute('aria-label', 'Verify bundle range and associations');
        for (const field of [first, last, destination]) field.select.addEventListener('change', () => { verified.checked = false; });
        const verification = make('label'); verification.append(verified, document.createTextNode(' I verified this range and any LoRA–trigger associations'));
        const add = make('button', 'Confirm bundle'); add.type = 'button';
        add.addEventListener('click', () => {
            observe(); if (composing || choiceSource !== native.value) return;
            const start = Number(first.select.value), end = Number(last.select.value), module = Number(destination.select.value);
            if (!verified.checked) { status.textContent = 'Verify the selected range and associations before confirming the bundle.'; return; }
            if (end < start || bundles.some(bundle => start <= bundle.end && end >= bundle.start)) { status.textContent = 'Select an ordered range that does not overlap another bundle.'; return; }
            if (result.items.find(item => item.index === start)?.regionIndex !== result.items.find(item => item.index === end)?.regionIndex) { status.textContent = result.characterBlocks ? 'Bundles cannot cross character/shared boundaries.' : 'Bundles cannot cross regional boundaries.'; return; }
            bundles.push({ start, end, module });
            for (let index = start; index <= end; index++) delete placements[index];
            invalidateChoices(); renderChoices(plan()); choices.open = true;
        });
        choices.append(first.label, last.label, destination.label, verification, add);
        for (const [index, bundle] of bundles.entries()) {
            const entry = make('p', `Bundle ${index + 1}: items ${bundle.start + 1}–${bundle.end + 1} → L${bundle.module} `);
            const remove = make('button', `Remove bundle ${index + 1}`); remove.type = 'button';
            remove.addEventListener('click', () => {
                bundles.splice(index, 1); invalidateChoices();
                renderChoices(plan()); choices.open = true;
            }); entry.append(remove); choices.append(entry);
        }
    }
    prepare.addEventListener('click', () => {
        observe(); if (composing) return;
        if (choiceSource !== native.value) { clearChoices(); choiceSource = native.value; }
        const result = plan(); snapshot = result;
        renderDuplicates(result);
        renderChoices(result); if (result.review.length) choices.open = true;
        original.textContent = result.source; proposed.textContent = result.proposed ?? 'No applicable proposal. Review the placement controls or resolve unsupported syntax in the main prompt.';
        comparison.hidden = false; comparison.open = true;
        review.textContent = result.supported
            ? (result.regional || result.characterBlocks || result.segmented ? result.regions.map(region => `${region.title ?? 'Chunk ' + (region.index + 1)}: ${region.shared ? 'shared · unchanged' : region.empty ? 'empty · unchanged' : 'organized within confirmed boundary'}`).join('\n')
                + (result.segmented ? '\nBREAK controls and tag membership on each side are preserved. BREAK does not establish character ownership.' : result.characterBlocks ? '\nText grouping does not isolate generation conditioning. Illustrious may share facial expressions. Forge Couple or later inpainting may help; consider the main character’s expression for a shared-expression first pass.' : '\nCheck Forge Couple uses --- and the chosen shared position. This preview does not change its settings or guarantee expression separation.')
                : result.sections.map(section => `L${section.module} · ${section.name}: ${section.tags.length} item(s)`).join('\n'))
                + '\n\nProposed placements (original item order):\n' + result.moves.map(item => `${item.originalIndex + 1}. ${item.text} → L${item.module}${item.regionIndex === undefined ? '' : ` · ${item.scopeLabel ?? 'Chunk ' + (item.regionIndex + 1)}`} (${item.lineAssignment ? 'manual line ' + item.lineAssignment.line + '; ' : ''}${item.placement})`).join('\n')
            : [...result.issues, ...result.review.map(item => `${item.text}: ${item.reason}`)].join('\n');
        apply.disabled = !result.supported || result.proposed === result.source;
        status.textContent = result.supported ? 'Review the exact proposal. Formatting and tag order will change only when you Apply.' : 'Review needed. Positive prompt unchanged.';
    });
    function applyResult(fresh) {
        undo = { before: native.value, after: fresh.proposed, beforeLabels: getLineAssignments(), beforeEditor: getEditorSnapshot() }; snapshot = null; apply.disabled = true;
        write(undo.after);
        const carriedLabels = organizedLineAssignments(fresh);
        const retainedLabels = native.value === undo.after && carriedLabels?.rows.length && setLineAssignments(carriedLabels) === true;
        clearChoices(); observe(); renderDuplicates(fresh, true);
        status.textContent = native.value === undo.after ? 'Organization applied to the positive prompt. Revert is available while this text remains current.'
            + (retainedLabels ? ' Reviewed destinations are retained as line labels; reset them in Assign line to let scoring choose again.' : '')
            : 'Another extension changed the result. Inspect the positive prompt; automatic Revert is unavailable.';
    }
    apply.addEventListener('click', () => {
        observe(); if (composing || !snapshot || native.value !== snapshot.source || !solo.checked) return;
        const fresh = plan();
        if (!fresh.supported || fresh.proposed !== snapshot.proposed || fresh.proposed === native.value) return;
        applyResult(fresh);
    });
    let autoUndo = null;
    function revertResult() {
        observe(); if (composing || !undo || native.value !== undo.after) return false;
        const before = undo.before, beforeLabels = undo.beforeLabels, beforeEditor = undo.beforeEditor; undo = null; snapshot = null; apply.disabled = true; write(before);
        if (native.value === before && !(beforeEditor && restoreEditorSnapshot(beforeEditor)) && beforeLabels) setLineAssignments(beforeLabels);
        clearChoices(); observe();
        status.textContent = native.value === before ? 'Restored the exact prompt from before organization.' : 'Another extension changed the restored text. Inspect the positive prompt.';
        autoUndo = null;
        return native.value === before;
    }
    revert.addEventListener('click', revertResult);
    function autoFix(options = null) {
        observe();
        const fail = (message, result = null, state = 'blocked') => {
            status.textContent = message;
            const audit = buildAutoFixAudit(result, state, message);
            if (state === 'blocked') { review.textContent = audit.details; comparison.hidden = true; }
            return { applied: false, message, audit };
        };
        if (composing) return fail('Finish composing text before Auto Fix. Positive prompt unchanged.');
        const context = options ?? getAutoFixContext(), contextKey = JSON.stringify(context);
        if (scope.select.value !== 'solo' && !(scope.select.value === 'regional' && context.couple?.state === 'enabled')) return fail('Auto Fix needs Solo scope or an enabled configured Basic Couple prompt. Positive prompt unchanged.');
        const source = native.value, labels = JSON.stringify(getLineAssignments());
        const result = planAutoFix(source, getLineAssignments(), context);
        if (!result.supported) return fail('Auto Fix left the prompt unchanged. ' + (result.issues[0] ?? result.review[0]?.reason ?? 'Use Organize to resolve placements.')
            + (result.review[0]?.text ? ` (${result.review[0].text})` : ''), result);
        if (native.value !== source || JSON.stringify(getLineAssignments()) !== labels || options === null && JSON.stringify(getAutoFixContext()) !== contextKey) return fail('Prompt, labels or Couple configuration changed during Auto Fix. Try again.');
        if (result.proposed === source) return fail('Already organized. Positive prompt unchanged.', result, 'unchanged');
        applyResult(result);
        const applied = native.value === result.proposed;
        autoUndo = applied ? undo : null;
        original.textContent = source; proposed.textContent = result.proposed;
        comparison.hidden = false;
        review.textContent = (result.autoFixMode === 'regional' ? `${result.ownerCount} Couple regions; shared ${result.sharedPosition}; region order, shared text and BREAK membership preserved.\n` : '')
            + 'Auto Fix placements (original item order):\n' + result.moves.map(item => `${item.originalIndex + 1}. ${item.text} → L${item.module}${item.scopeLabel ? ' · ' + item.scopeLabel : ''} (${item.lineAssignment ? 'manual line ' + item.lineAssignment.line : item.placement})`).join('\n');
        const removed = result.duplicates?.filter(entry => entry.removed).length ?? 0;
        const provisional = result.moves.filter(item => item.placement === 'provisional L7').length;
        const message = applied ? `Auto Fix applied. ${result.autoFixMode === 'regional' ? result.ownerCount + ' Couple regions; shared ' + result.sharedPosition + ' unchanged. ' : ''}${removed} exact duplicate(s) removed; ${provisional} provisional L7 placement(s). Revert Auto Fix restores the original. See Organize for details.` : status.textContent;
        status.textContent = message;
        return { applied, message, audit: buildAutoFixAudit(result, applied ? 'applied' : 'blocked', message) };
    }
    const start = () => { composing = true; apply.disabled = revert.disabled = true; };
    const end = () => { composing = false; observe(); apply.disabled = !snapshot?.supported || native.value !== snapshot.source || snapshot.proposed === native.value; };
    native.addEventListener('input', observe); native.addEventListener('change', observe);
    native.addEventListener('compositionstart', start); native.addEventListener('compositionend', end);
    return { panel, observe, autoFix, openReview() {
        observe(); panel.open = true; panel.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); prepare.focus?.();
    }, getAutoFixState() {
        return { canRevert: !composing && !!autoUndo && undo === autoUndo && native.value === undo.after };
    }, revertAutoFix() {
        if (!autoUndo || undo !== autoUndo) return false;
        return revertResult();
    }, destroy() {
        disposed = true; choiceRevision++;
        native.removeEventListener('input', observe); native.removeEventListener('change', observe);
        native.removeEventListener('compositionstart', start); native.removeEventListener('compositionend', end); panel.remove();
    } };
}
