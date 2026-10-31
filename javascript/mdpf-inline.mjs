import { MODULES, inspectPrompt, addHeadingRows } from './mdpf-core.mjs?v=0.50.0-alpha.1';
import { inspectStructure, structureAdvisories, addStructureHeadingRows } from './mdpf-structure.mjs?v=0.50.0-alpha.1';
import { updateAssignments, setLineAssignment, resetLineAssignments, lineAtOffset, buildStarterTemplate, assignStarterTemplate, planCharacterAddition, applyCharacterAddition } from './mdpf-assignments.mjs?v=0.50.0-alpha.1';
import { scoreLine } from './mdpf-classifier.mjs?v=0.50.0-alpha.1';
import { reviewLines, prepareReviewCase } from './mdpf-review.mjs?v=0.50.0-alpha.1';
import { serializeDraft, parseDraft, restoreDraft, DRAFT_MAX_BYTES } from './mdpf-drafts.mjs?v=0.50.0-alpha.1';

export function coupleState(host, id) {
    const app = typeof gradioApp === 'function' ? gradioApp() : host.ownerDocument;
    const area = app.querySelector(`#forge_couple_${id === 'txt2img' ? 't2i' : 'i2i'}`);
    const enable = area?.querySelector('.fc-checkbox input[type="checkbox"]');
    if (!enable) return { state: 'unknown' };
    const raw = area.querySelector('.fc_separator textarea, .fc_separator input')?.value ?? '';
    const separator = raw.replaceAll('\\n', '\n').replaceAll('\\t', ' ');
    const global = area.querySelector('.fc_global_effect input:checked')?.value;
    const mode = area.querySelector('input[type="radio"][value="Basic"]:checked, input[type="radio"][value="Advanced"]:checked, input[type="radio"][value="Mask"]:checked')?.value;
    const commonSyntax = area.querySelector(`#forge_couple_cmp_${id === 'txt2img' ? 't2i' : 'i2i'} input[type="radio"]:checked`)?.value;
    const tileLabel = [...(area.querySelectorAll?.('label') ?? [])].find(label => label.textContent.trim() === 'Enable Tile Mode');
    const tile = tileLabel?.querySelector('input[type="checkbox"]');
    return { state: enable.checked ? 'enabled' : 'disabled', separator: separator.trim() ? separator : '\n',
        globalPosition: { 'First Line': 'first', 'Last Line': 'last', None: 'none' }[global] ?? 'unknown',
        mode: ['Basic', 'Advanced', 'Mask'].includes(mode) ? mode : 'unknown', commonSyntax: commonSyntax ?? 'unknown',
        tileEnabled: tileLabel ? tile?.checked ?? null : false };
}

const colors = ['181,139,40', '49,131,199', '67,144,91', '186,92,62', '182,84,138', '123,142,148', '144,85,207'];
function make(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}

// Combine secondary tools below the prompt; switching views never writes text.
export function attachPromptTabs(panel, templates, id) {
    const review = make('section', 'mdpf-workspace-review');
    review.append(...[...panel.children].slice(1));
    const tabs = make('div', 'mdpf-workspace-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Line Chunks tools');
    const reviewTab = make('button', '', 'Organize & review');
    const templateTab = make('button', '', 'Templates');
    const pairs = [[reviewTab, review, 'review'], [templateTab, templates, 'templates']];
    for (const [tab, view, key] of pairs) {
        tab.type = 'button'; tab.id = `${id}_mdpf_${key}_tab`;
        view.id = `${id}_mdpf_${key}_panel`;
        tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', view.id);
        view.setAttribute('role', 'tabpanel'); view.setAttribute('aria-labelledby', tab.id);
        tab.addEventListener('click', () => select(key));
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? pairs[0] : event.key === 'End' ? pairs[1] : pairs.find(pair => pair[0] !== tab);
            select(next[2]); next[0].focus();
        });
    }
    function select(key) {
        for (const [tab, view, name] of pairs) {
            const selected = name === key;
            tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
            view.hidden = !selected;
        }
    }
    templates.open = true;
    panel.classList.add('mdpf-workspace');
    tabs.append(reviewTab, templateTab); panel.append(tabs, review, templates);
    select('review');
    return { showReview() { select('review'); } };
}

// Choose defaults only when the draft context changes, never on every poll.
export function templateContext(starter, add, files, note) {
    let previous = null;
    return hasDraft => {
        if (previous === hasDraft) return;
        previous = hasDraft;
        starter.children[0].textContent = hasDraft ? 'Replace draft with a template' : 'Start from a template';
        note.textContent = hasDraft ? 'Continue your draft below, or open template replacement to start over.' : 'Choose a blank starter below, or open Save / load draft to resume a saved file.';
        for (const [box, open] of [[starter, !hasDraft], [add, hasDraft], [files, hasDraft]]) {
            // Do not collapse controls while someone is using them.
            if (!box.contains?.(document.activeElement)) box.open = open;
        }
    };
}

function actionAvailability(button, reason) {
    button.disabled = !!reason;
    button.title = reason || '';
    button.setAttribute('aria-description', reason || 'Ready.');
}

export function attachAutoFixSummary(native, id, { getAutoFixState = () => ({ canRevert: false }), onRevertAutoFix, onOpenReview } = {}) {
    const element = make('section', 'mdpf-auto-fix-summary'); element.hidden = true;
    element.setAttribute('aria-label', 'Auto Fix result');
    const row = make('div', 'mdpf-auto-fix-row');
    const status = make('p', 'mdpf-auto-fix-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    const detailsButton = make('button', '', 'Details'); detailsButton.type = 'button'; detailsButton.setAttribute('aria-expanded', 'false');
    const reviewButton = make('button', '', 'Open review'); reviewButton.type = 'button'; reviewButton.hidden = true;
    const revertButton = make('button', '', 'Revert Auto Fix'); revertButton.type = 'button'; revertButton.hidden = true;
    revertButton.title = 'Restore the last successful Auto Fix while its exact result remains current.';
    const details = make('pre', 'mdpf-auto-fix-details'); details.hidden = true; details.id = `${id}_mdpf_auto_fix_details`;
    details.setAttribute('tabindex', '0'); details.setAttribute('aria-label', 'Auto Fix details'); detailsButton.setAttribute('aria-controls', details.id);
    row.append(status, detailsButton, reviewButton, revertButton); element.append(row, details);
    let receipt = null, source = '';
    function observe() {
        if (!receipt) return;
        const current = native.value === source;
        const text = current ? receipt.summary : 'Earlier Auto Fix result — prompt changed. Run Auto Fix again.';
        const body = (current ? '' : 'Historical result; the prompt has changed.\n\n') + receipt.details;
        // Polling must not rebuild controls, steal focus or retrigger live-region announcements.
        if (status.textContent !== text) status.textContent = text;
        if (details.textContent !== body) details.textContent = body;
        revertButton.hidden = !getAutoFixState().canRevert;
        reviewButton.hidden = receipt.state !== 'blocked' || typeof onOpenReview !== 'function';
    }
    detailsButton.addEventListener('click', () => {
        details.hidden = !details.hidden; detailsButton.setAttribute('aria-expanded', String(!details.hidden));
    });
    reviewButton.addEventListener('click', () => onOpenReview?.());
    revertButton.addEventListener('click', () => {
        const restored = onRevertAutoFix?.() === true;
        receipt = { state: restored ? 'reverted' : 'blocked', summary: restored ? 'Restored the exact prompt from before Auto Fix.' : 'Revert unavailable: the prompt changed. Your current text was kept.',
            details: restored ? 'Original prompt restored. Previous placements and duplicate cleanup were undone.' : 'No text was overwritten. Run Auto Fix again or open review.' };
        source = native.value; observe();
    });
    return { element, observe, show(result) {
        if (!result) return;
        if (result.audit?.state === 'unchanged' && receipt?.state === 'applied' && native.value === source && getAutoFixState().canRevert) { observe(); return; }
        receipt = result.audit ?? { state: result.applied ? 'applied' : 'blocked', summary: result.message, details: result.message };
        source = native.value; element.hidden = false; details.hidden = true; detailsButton.setAttribute('aria-expanded', 'false'); observe();
    } };
}

// Keep the native textarea. Formatting, Auto Fix and their guarded undo paths
// require a click; observers only read prompt text and update decorations.
export function attachInlineEditor(native, host, id, { getExtraQuality, setExtraQuality, onAutoFix, onRevertAutoFix, onOpenReview, getAutoFixState = () => ({ canRevert: false }) }) {
    const shell = make('section', 'mdpf-inline');
    shell.id = `${id}_mdpf_inline`;
    const toolbar = make('div', 'mdpf-inline-toolbar');
    const toggle = make('button', 'mdpf-mode-switch', 'Line Chunks · Off');
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', 'false');
    toggle.setAttribute('aria-label', 'Line Chunks');
    const detect = make('button', '', 'Detect / View');
    const fix = make('button', '', 'Auto Fix');
    fix.disabled = typeof onAutoFix !== 'function';
    fix.title = 'Organize a supported solo or configured Basic Forge Couple prompt immediately. Ambiguous placements leave the whole prompt unchanged.';
    const fixSummary = attachAutoFixSummary(native, id, { getAutoFixState, onRevertAutoFix, onOpenReview });
    fix.addEventListener('click', () => {
        const result = onAutoFix?.();
        fixSummary.show(result);
        observe(true);
    });
    const info = make('button', 'mdpf-info-button', 'ⓘ');
    info.setAttribute('aria-label', 'Line Chunks information');
    info.setAttribute('aria-expanded', 'false');
    const undoSpacing = make('button', '', 'Undo spacing');
    undoSpacing.disabled = true;
    const assignButton = make('button', '', 'Assign line');
    assignButton.disabled = true;
    assignButton.setAttribute('aria-expanded', 'false');
    assignButton.title = 'Assign a line label or review tag-based section suggestions.';
    for (const button of [toggle, detect, fix, info, undoSpacing, assignButton]) button.type = 'button';
    toolbar.append(toggle, detect, fix, info, undoSpacing, assignButton);
    const help = make('div', 'mdpf-inline-help');
    help.hidden = true;
    help.append(make('p', '', 'Edit directly in Forge’s original positive prompt. Enabling Line Chunks or selecting Detect / View uses compact spacing for supported simple and multi-character prompts, including Forge Couple with standalone literal separators. Existing blank rows are reused; missing heading rows are added. Standalone uppercase BREAK rows are protected text-chunk boundaries; organization and duplicate cleanup stay within each segment. Inline BREAK forms remain in raw mode. Headings themselves are never sent to generation. Native autocomplete, selection and copying use the original textbox; tag text is unchanged.'));
    help.append(make('p', '', 'Blank heading rows appear in copied prompts and saved metadata. Existing blank rows and regional separators are preserved. Undo spacing restores the exact pre-format prompt and turns Line Chunks off, until another edit replaces the snapshot. Turning mode Off alone keeps formatting. Background updates and typing never add rows. Newline-based and inline regional separators keep their existing spacing.'));
    help.append(make('p', '', 'L means Line Chunk: a semantic section, not every wrapped row. L1 Quality · L2 Camera / pose · L3 Character · L4 Outfit · L5 Expression · L6 Background · L7 Style. C1 / C2 / C3 / C4 and onward identify character candidates. Labels are suggestions; unknown rows stay editable. Use Organize · prompt preview below for conservative grouping.'));
    help.append(make('p', '', 'Different character expressions can bleed in Illustrious generations. Forge Couple or later inpainting may help. ADetailer prompts remain manual.'));
    help.append(make('p', '', 'Assign line changes a line’s section label only. Labels stay with a line during normal typing; splitting or joining lines clears ambiguous assignments. Manual labels remain when you use Detect, until you choose Detected label or Reset labels. Labels are page-local; use Save / load draft to export and reopen them across reloads. These corrections do not yet train a tag dictionary or change character/region binding.'));
    help.append(make('p', '', 'Auto Fix immediately organizes supported solo prompts or Basic Forge Couple prompts with exact standalone --- separators and a readable Global Effect position. Each editable Couple region needs one explicit 1girl/1boy/1other tag. Shared text, separator order and BREAK scopes stay locked. Manual labels take priority; unknown triggers/standalone LoRAs may use provisional L7. Ambiguous, weak or unsupported items block the whole change. Revert Auto Fix restores the exact original. Custom/newline separators, Mask/Advanced, Tile Mode and active Common Prompts constructs use Organize. Couple settings are read only.'));
    const extraLabel = make('label', 'mdpf-inline-extra');
    const extra = make('input', '');
    extra.type = 'checkbox';
    extra.checked = getExtraQuality();
    extraLabel.append(extra, document.createTextNode(' First two lines belong to L1 (quality + rendering)'));
    help.append(extraLabel);
    const status = make('p', 'mdpf-inline-status');
    status.setAttribute('role', 'status');
    const advisory = make('div', 'mdpf-structure-advisory');
    advisory.hidden = true;
    shell.append(toolbar, fixSummary.element, help, status, advisory);
    const templates = make('details', 'mdpf-templates');
    templates.append(make('summary', '', 'Templates · blank starters'));
    const templateIntro = make('p', 'mdpf-template-context');
    const starterBox = make('details', 'mdpf-template-starter');
    starterBox.append(make('summary', '', 'Start from a template'));
    templates.append(templateIntro, starterBox);
    const templateType = make('select', ''); templateType.setAttribute('aria-label', 'Prompt template');
    for (const [value, title] of [['solo', 'Solo'], ['pair', 'Two characters · placement line'], ['couple', 'Forge Couple · multi-character']]) {
        const option = make('option', '', title); option.value = value; templateType.append(option);
    }
    const countLabel = make('label', '', 'Characters ');
    const templateCount = make('select', ''); templateCount.setAttribute('aria-label', 'Template character count');
    for (let n = 2; n <= 8; n++) { const option = make('option', '', String(n)); option.value = String(n); templateCount.append(option); }
    countLabel.append(templateCount);
    const sharedLabel = make('label', '', 'Shared region ');
    const templateGlobal = make('select', ''); templateGlobal.setAttribute('aria-label', 'Template shared region');
    for (const [value, title] of [['first', 'First'], ['last', 'Last'], ['none', 'None']]) { const option = make('option', '', title); option.value = value; templateGlobal.append(option); }
    sharedLabel.append(templateGlobal);
    templateType.value = 'solo'; templateCount.value = '2'; templateGlobal.value = 'first';
    const templatePreview = make('pre', ''); templatePreview.setAttribute('aria-label', 'Template outline');
    const replaceLabel = make('label', ''); const replaceDraft = make('input', ''); replaceDraft.type = 'checkbox';
    replaceLabel.append(replaceDraft, document.createTextNode(' Replace the current draft (Undo template restores it until another edit)'));
    const insertTemplate = make('button', '', 'Insert template'); insertTemplate.type = 'button';
    const undoTemplate = make('button', '', 'Undo template'); undoTemplate.type = 'button'; undoTemplate.disabled = true;
    const templateNote = make('p', '', 'Blank sections contain no placeholder tags. Solo starts with 1girl, solo; the ordinary pair uses 1girl / 1boy and man next to girl. Couple regions start with 1girl each. Edit those starter tags as needed. Empty expression sections are optional. Save / load draft can preserve labels across reloads; templates never configure Forge Couple.');
    const templateResult = make('p', ''); templateResult.setAttribute('role', 'status');
    starterBox.append(templateType, countLabel, sharedLabel, templatePreview, templateNote, replaceLabel, insertTemplate, undoTemplate, templateResult);
    const starterGuidance = make('p', 'mdpf-action-guidance'); starterBox.append(starterGuidance);
    let templateSnapshot = null;
    const addBox = make('details', 'mdpf-add-character'); addBox.append(make('summary', '', 'Add character to this draft'));
    const addMode = make('select', ''); addMode.setAttribute('aria-label', 'Add character layout');
    for (const [value, title] of [['ordinary', 'Ordinary · placement line'], ['couple', 'Forge Couple · standalone ---']]) { const option = make('option', '', title); option.value = value; addMode.append(option); }
    const addCount = make('select', ''); addCount.setAttribute('aria-label', 'New character count tag');
    for (const value of ['1girl', '1boy', '1other']) { const option = make('option', '', value); option.value = value; addCount.append(option); }
    const addGlobal = make('select', ''); addGlobal.setAttribute('aria-label', 'Existing shared region position');
    for (const [value, title] of [['first', 'Shared region first'], ['last', 'Shared region last'], ['none', 'No shared region']]) { const option = make('option', '', title); option.value = value; addGlobal.append(option); }
    const addPlacement = make('input', ''); addPlacement.type = 'text'; addPlacement.setAttribute('aria-label', 'New character placement line'); addPlacement.value = 'girl next to girl,';
    addMode.value = 'ordinary'; addCount.value = '1girl'; addGlobal.value = 'first';
    const previewAdd = make('button', '', 'Preview added character'), applyAdd = make('button', '', 'Add character'), undoAdd = make('button', '', 'Undo added character');
    for (const button of [previewAdd, applyAdd, undoAdd]) button.type = 'button';
    applyAdd.disabled = undoAdd.disabled = true;
    const addNote = make('p', '', 'Inserts blank character/outfit/expression sections; Couple also gets a regional background. Existing text stays exact. Edit the placement and count tag for your scene. Remove solo if it no longer applies, and update shared scene counts and Forge Couple region settings manually. Eight characters maximum.');
    const addResult = make('p', ''); addResult.setAttribute('role', 'status');
    const addPreview = make('pre', ''); addPreview.setAttribute('aria-label', 'Exact prompt after adding character'); addPreview.hidden = true;
    addBox.append(addMode, addCount, addGlobal, addPlacement, addNote, previewAdd, applyAdd, undoAdd, addResult, addPreview); templates.append(addBox);
    const addGuidance = make('p', 'mdpf-action-guidance'); addBox.append(addGuidance);
    let addPlan = null, addUndo = null, addComposing = false;
    const addOptions = () => ({ mode: addMode.value, count: addCount.value, globalPosition: addGlobal.value, placement: addPlacement.value });
    const addKey = () => JSON.stringify([addOptions(), labels?.rows.map(row => [row.start, row.end, row.module, row.kind, row.manual, row.templateCharacter]), coupleState(host, id)]);
    function addContextProblem() {
        if (addComposing || destroyed) return 'Finish composing text before adding a character.';
        const couple = coupleState(host, id);
        if (addMode.value === 'couple' && couple.state === 'enabled' && (couple.mode !== 'Basic' || couple.separator !== '---' || couple.globalPosition !== addGlobal.value)) return 'Match the enabled Basic Forge Couple separator (---) and shared-region position before previewing. Settings were not changed.';
        if (addMode.value === 'ordinary' && couple.state === 'enabled') return 'Disable Forge Couple yourself or choose its regional insertion layout. Settings were not changed.';
        return null;
    }
    function refreshAdd() {
        addGlobal.hidden = addMode.value !== 'couple'; addPlacement.hidden = addMode.value === 'couple';
        const issue = addContextProblem() || (!hasCurrentDraft() ? 'Start or load a draft before adding a character.' : '');
        actionAvailability(previewAdd, issue);
        const reason = issue || (!addPlan ? 'Preview the added character first.' : native.value !== addPlan.plan.source || addPlan.key !== addKey() ? 'Draft, labels, options or Couple settings changed. Preview again.' : '');
        actionAvailability(applyAdd, reason);
        actionAvailability(undoAdd, addComposing ? 'Finish composing text first.' : !addUndo ? 'No character addition to undo.' : native.value !== addUndo.after ? 'The prompt changed after adding a character; Undo is unavailable.' : '');
        if (addGuidance.textContent !== reason) addGuidance.textContent = reason;
        if (addPlan && applyAdd.disabled) { addPreview.hidden = true; addResult.textContent = 'Draft, labels, options or Couple settings changed. Preview again before adding a character.'; }
    }
    for (const control of [addMode, addCount, addGlobal, addPlacement]) {
        control.addEventListener('change', refreshAdd); control.addEventListener('input', refreshAdd);
    }
    previewAdd.addEventListener('click', () => {
        observe(true);
        const issue = addContextProblem();
        const plan = issue ? { supported: false, message: issue } : planCharacterAddition(labels, addOptions());
        addPlan = plan.supported ? { plan, key: addKey() } : null;
        addResult.textContent = plan.message;
        addPreview.hidden = !plan.supported; addPreview.textContent = plan.supported ? plan.proposed : '';
        refreshAdd();
    });
    applyAdd.addEventListener('click', () => {
        observe(true);
        if (!addPlan || native.value !== addPlan.plan.source || addPlan.key !== addKey() || addContextProblem()) { refreshAdd(); return; }
        const next = applyCharacterAddition(labels, addPlan.plan);
        if (!next) { addResult.textContent = 'Draft changed; preview again. No text was replaced.'; return; }
        addUndo = { before: native.value, beforeLabels: structuredClone(labels), wasActive: active, wasCompact: compactLayout, after: next.source };
        writeSpacing(next.source); labels = next; compactLayout = true; setActive(true, false); observe(true); schedule();
        addPlan = null; addPreview.hidden = true; addResult.textContent = 'Added blank character sections. Existing text was preserved; shared counts and Couple settings remain manual.'; refreshAdd();
    });
    undoAdd.addEventListener('click', () => {
        if (addComposing || !addUndo || native.value !== addUndo.after) return;
        const snapshot = addUndo; addUndo = null;
        writeSpacing(snapshot.before); labels = snapshot.beforeLabels; compactLayout = snapshot.wasCompact;
        setActive(snapshot.wasActive, false); observe(true); schedule(); addPlan = null; addPreview.hidden = true;
        addResult.textContent = 'Restored the exact draft from before Add character.'; refreshAdd();
    });
    const draftBox = make('details', 'mdpf-draft-files'); draftBox.append(make('summary', '', 'Save / load draft'));
    const saveDraft = make('button', '', 'Save draft file'); saveDraft.type = 'button';
    const fileLabel = make('label', '', 'Draft file ');
    const draftFile = make('input', ''); draftFile.type = 'file'; draftFile.accept = '.json,application/json'; draftFile.setAttribute('aria-label', 'Line Chunks draft file'); fileLabel.append(draftFile);
    const previewDraft = make('button', '', 'Preview draft'); previewDraft.type = 'button'; previewDraft.disabled = true;
    const replaceFileLabel = make('label', ''); const replaceFile = make('input', ''); replaceFile.type = 'checkbox';
    replaceFileLabel.append(replaceFile, document.createTextNode(' Replace the current prompt and labels with this draft'));
    const loadDraft = make('button', '', 'Load draft'), undoLoad = make('button', '', 'Undo loaded draft');
    loadDraft.type = undoLoad.type = 'button'; loadDraft.disabled = undoLoad.disabled = true;
    const draftNote = make('p', '', 'Save a local JSON file with this positive prompt, blank sections and line labels. Choose a saved file to preview it, then Load draft. No automatic recovery or browser storage. Loading never changes generation or Forge Couple settings.');
    const draftStatus = make('p', ''); draftStatus.setAttribute('role', 'status');
    const draftPreview = make('pre', ''); draftPreview.hidden = true; draftPreview.setAttribute('aria-label', 'Saved draft prompt preview');
    draftBox.append(saveDraft, fileLabel, previewDraft, replaceFileLabel, loadDraft, undoLoad, draftNote, draftStatus, draftPreview); templates.append(draftBox);
    const draftGuidance = make('p', 'mdpf-action-guidance'); draftBox.append(draftGuidance);
    const updateTemplateContext = templateContext(starterBox, addBox, draftBox, templateIntro);
    let draftCandidate = null, draftStage = null, draftUndo = null, draftRead = 0;
    const draftUrls = new Map();
    const draftKey = () => JSON.stringify([native.value, labels?.rows.map(row => [row.start, row.end, row.module, row.kind, row.manual, row.header, row.templateSlot, row.templateCharacter, row.templateGroup, row.templateContinuation]), active, compactLayout, getExtraQuality()]);
    function refreshDraft() {
        actionAvailability(saveDraft, addComposing ? 'Finish composing text before saving.' : '');
        actionAvailability(previewDraft, addComposing ? 'Finish composing text first.' : !draftCandidate ? 'Choose a valid Line Chunks draft file first.' : '');
        replaceFileLabel.hidden = !hasCurrentDraft();
        const reason = addComposing ? 'Finish composing text first.' : !draftCandidate ? 'Choose a saved Line Chunks draft file to preview it.' : !draftStage || draftStage.key !== draftKey() ? 'Preview draft again before loading.' : !replaceFileLabel.hidden && !replaceFile.checked ? 'Confirm replacement above to load this draft.' : '';
        actionAvailability(loadDraft, reason);
        actionAvailability(undoLoad, addComposing ? 'Finish composing text first.' : !draftUndo ? 'No loaded draft to undo.' : draftUndo.afterKey !== draftKey() ? 'The prompt or labels changed after loading; Undo is unavailable.' : '');
        if (draftGuidance.textContent !== reason) draftGuidance.textContent = reason;
        if (draftStage && draftStage.key !== draftKey()) {
            draftPreview.hidden = true;
            draftStatus.textContent = 'Current prompt or labels changed. Preview draft again before loading.';
        }
    }
    function stageDraft() {
        observe(true);
        if (!draftCandidate || addComposing || destroyed) return;
        draftStage = { key: draftKey(), value: draftCandidate };
        replaceFile.checked = false;
        draftPreview.textContent = draftCandidate.prompt; draftPreview.hidden = false;
        const hint = draftCandidate.coupleHint;
        draftStatus.textContent = `Ready to load ${draftCandidate.lines.length} source lines and ${draftCandidate.lines.filter(row => row.module).length} section labels. Current prompt unchanged.${hint ? ` Saved Couple guidance: separator ${JSON.stringify(hint.separator)}, shared ${hint.sharedPosition}. Configure it manually.` : ''}`;
        refreshDraft();
    }
    previewDraft.addEventListener('click', stageDraft);
    replaceFile.addEventListener('change', refreshDraft);
    draftFile.addEventListener('change', async () => {
        const revision = ++draftRead;
        draftCandidate = draftStage = null; draftPreview.hidden = true; replaceFile.checked = false; refreshDraft();
        const file = draftFile.files?.[0];
        if (!file) { draftStatus.textContent = 'No file selected. Current prompt unchanged.'; return; }
        if (file.size > DRAFT_MAX_BYTES) { draftStatus.textContent = 'Choose a Line Chunks JSON draft file up to 2 MB. Current prompt unchanged.'; return; }
        draftStatus.textContent = 'Reading the selected local draft…';
        try {
            const text = await file.text();
            if (destroyed || revision !== draftRead) return;
            draftCandidate = parseDraft(text); stageDraft();
        } catch (error) {
            if (destroyed || revision !== draftRead) return;
            draftStatus.textContent = `${error.message} Current prompt unchanged.`; refreshDraft();
        }
    });
    saveDraft.addEventListener('click', () => {
        observe(true);
        if (addComposing || destroyed) return;
        try {
            const couple = coupleState(host, id);
            const text = serializeDraft(labels, { enabled: active, compact: compactLayout, extraQualityLine: getExtraQuality(),
                coupleHint: couple.state === 'enabled' ? { separator: couple.separator, sharedPosition: couple.globalPosition } : null });
            const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
            const link = make('a', ''); link.href = url; link.download = 'line-chunks-draft.json'; document.body.append(link); link.click(); link.remove();
            const timer = setTimeout(() => { URL.revokeObjectURL(url); draftUrls.delete(url); }, 1000); draftUrls.set(url, timer);
            draftStatus.textContent = 'Draft download requested: line-chunks-draft.json. Keep the file to reopen its prompt and labels later.';
        } catch (error) { draftStatus.textContent = `${error.message} Current prompt unchanged.`; }
    });
    loadDraft.addEventListener('click', () => {
        observe(true);
        if (destroyed || addComposing || !draftStage || draftStage.key !== draftKey() || !replaceFileLabel.hidden && !replaceFile.checked) { refreshDraft(); return; }
        const loaded = restoreDraft(draftStage.value);
        const snapshot = { source: native.value, labels: structuredClone(labels), active, compact: compactLayout, extra: getExtraQuality() };
        setExtraQuality(loaded.editor.extraQualityLine); writeSpacing(loaded.state.source);
        labels = loaded.state; compactLayout = loaded.editor.compact;
        setActive(loaded.editor.enabled, false, 'external'); observe(true); schedule();
        draftUndo = { ...snapshot, afterKey: draftKey() }; draftStage = null; draftPreview.hidden = true; replaceFile.checked = false;
        draftStatus.textContent = 'Loaded prompt and section labels. Generation and Forge Couple settings were not changed.'; refreshDraft();
    });
    undoLoad.addEventListener('click', () => {
        if (destroyed || addComposing || !draftUndo || draftUndo.afterKey !== draftKey()) return;
        const snapshot = draftUndo; draftUndo = null;
        setExtraQuality(snapshot.extra); writeSpacing(snapshot.source); labels = snapshot.labels; compactLayout = snapshot.compact;
        setActive(snapshot.active, false, 'external'); observe(true); schedule(); draftStage = null; draftPreview.hidden = true;
        draftStatus.textContent = 'Restored the exact prompt and labels from before Load draft.'; refreshDraft();
    });
    function selectedTemplate() { return buildStarterTemplate(templateType.value, { characters: Number(templateCount.value), globalPosition: templateGlobal.value }); }
    function hasCurrentDraft() { return !!native.value.trim() || labels?.source === native.value && labels.rows.some(row => row.manual || row.templateSlot); }
    function refreshTemplates() {
        const hasDraft = !!hasCurrentDraft();
        updateTemplateContext(hasDraft);
        const isCouple = templateType.value === 'couple'; countLabel.hidden = sharedLabel.hidden = !isCouple;
        const template = selectedTemplate();
        const outline = template.slots.map(slot => `${slot.templateCharacter ? `C${slot.templateCharacter} · ` : ''}${slot.module ? `L${slot.module} · ${MODULES[slot.module - 1]}` : 'Placement between characters'}${template.source.split('\n')[slot.index] ? `: ${template.source.split('\n')[slot.index]}` : ''}`).join('\n');
        if (templatePreview.textContent !== outline) templatePreview.textContent = outline;
        replaceLabel.hidden = !hasDraft;
        const reason = addComposing ? 'Finish composing text first.' : hasDraft && !replaceDraft.checked ? 'Confirm replacement above to insert a template.' : '';
        actionAvailability(insertTemplate, reason);
        actionAvailability(undoTemplate, addComposing ? 'Finish composing text first.' : !templateSnapshot ? 'No template insertion to undo.' : native.value !== templateSnapshot.after ? 'The prompt changed after insertion; Undo is unavailable.' : '');
        if (starterGuidance.textContent !== reason) starterGuidance.textContent = reason;
        refreshAdd();
        refreshDraft();
    }
    for (const control of [templateType, templateCount, templateGlobal, replaceDraft]) control.addEventListener('change', refreshTemplates);
    insertTemplate.addEventListener('click', () => {
        if (addComposing || hasCurrentDraft() && !replaceDraft.checked) return;
        const template = selectedTemplate();
        const before = native.value, beforeLabels = labels ? structuredClone(labels) : null, wasActive = active, wasCompact = compactLayout;
        writeSpacing(template.source);
        labels = assignStarterTemplate(template);
        templateSnapshot = { before, beforeLabels, wasActive, wasCompact, after: template.source };
        compactLayout = true; setActive(true); observe(true); schedule();
        replaceDraft.checked = false;
        templateResult.textContent = template.type === 'couple' ? 'Inserted blank regions. Match Forge Couple separator --- and Shared region position manually; settings were not changed.' : 'Inserted blank starter. Write in the labeled rows; placement and count tags are editable.';
        refreshTemplates();
    });
    undoTemplate.addEventListener('click', () => {
        if (addComposing || !templateSnapshot || native.value !== templateSnapshot.after) return;
        const snapshot = templateSnapshot; templateSnapshot = null;
        writeSpacing(snapshot.before); labels = snapshot.beforeLabels; compactLayout = snapshot.wasCompact;
        setActive(snapshot.wasActive, false); observe(true); schedule();
        templateResult.textContent = 'Restored the draft from before template insertion.'; refreshTemplates();
    });
    const assignmentPanel = make('div', 'mdpf-line-assignment');
    assignmentPanel.hidden = true;
    assignmentPanel.id = `${id}_mdpf_assignment_panel`;
    assignButton.setAttribute('aria-controls', assignmentPanel.id);
    const rowLabel = make('label', '', 'Prompt line');
    const rowSelect = make('select', '');
    rowSelect.setAttribute('aria-label', 'Prompt line to label');
    rowLabel.append(rowSelect);
    const moduleLabel = make('label', '', 'Section label');
    const moduleSelect = make('select', '');
    moduleSelect.setAttribute('aria-label', 'Section label');
    for (const [value, text] of [['detected', 'Detected label (reset this line)'], ['unassigned', 'Unassigned'], ...MODULES.map((name, index) => [String(index + 1), `L${index + 1} · ${name}`])]) {
        const option = make('option', '', text); option.value = value; moduleSelect.append(option);
    }
    moduleLabel.append(moduleSelect);
    const resetLabels = make('button', '', 'Reset labels');
    resetLabels.type = 'button';
    const closeAssignment = make('button', '', 'Close');
    closeAssignment.type = 'button';
    const assignmentNote = make('p', 'mdpf-assignment-note', 'Labels only: no tags moved or rewritten. Corrections last for this prompt in this page.');
    assignmentPanel.append(rowLabel, moduleLabel, resetLabels, closeAssignment, assignmentNote);
    const suggestionBox = make('div', 'mdpf-suggestion');
    suggestionBox.setAttribute('aria-label', 'Section suggestion');
    const suggestionHeading = make('p', 'mdpf-suggestion-heading');
    const suggestionNote = make('p', 'mdpf-assignment-note');
    const useSuggestion = make('button', '', 'Use suggested label');
    useSuggestion.type = 'button';
    useSuggestion.disabled = true;
    const suggestionDetails = make('details', 'mdpf-suggestion-details');
    suggestionDetails.append(make('summary', '', 'Why this suggestion?'));
    const suggestionEvidence = make('div', '');
    suggestionDetails.append(suggestionEvidence);
    suggestionBox.append(suggestionHeading, suggestionNote, useSuggestion, suggestionDetails);
    assignmentPanel.append(suggestionBox);
    const reviewBox = make('details', 'mdpf-review-overview');
    reviewBox.append(make('summary', '', 'Review prompt lines'));
    const filterLabel = make('label', '', 'Show');
    const reviewFilter = make('select', '');
    reviewFilter.setAttribute('aria-label', 'Lines to review');
    for (const [value, title] of [['suggestion', 'Actionable suggestions'], ['unresolved', 'Unresolved lines'], ['all', 'All content lines']]) {
        const option = make('option', '', title); option.value = value; reviewFilter.append(option);
    }
    reviewFilter.value = 'suggestion';
    filterLabel.append(reviewFilter);
    const reviewNote = make('p', 'mdpf-assignment-note', 'Unresolved is informational: intentional style/meta terms may need no change. Selecting a row opens its evidence; it does not accept a label.');
    const reviewList = make('div', 'mdpf-review-list');
    reviewBox.append(filterLabel, reviewNote, reviewList);
    assignmentPanel.append(reviewBox);
    const caseBox = make('details', 'mdpf-review-case');
    caseBox.append(make('summary', '', 'Prepare a classification review case'));
    const caseDescription = make('p', 'mdpf-assignment-note', 'Choose the intended Section label and review intent, then prepare a case to copy. It includes only this positive-prompt line, its scope and scoring evidence. Nothing is saved, sent or used to train rules automatically.');
    caseBox.append(caseDescription);
    const prepareCase = make('button', '', 'Prepare review case'); prepareCase.type = 'button';
    const clearCase = make('button', '', 'Clear prepared case'); clearCase.type = 'button';
    const caseText = make('pre', ''); caseText.hidden = true;
    caseText.setAttribute('role', 'textbox'); caseText.setAttribute('aria-readonly', 'true'); caseText.setAttribute('tabindex', '0');
    caseText.setAttribute('aria-label', 'Prepared classification review case');
    clearCase.hidden = true;
    const caseNote = make('p', 'mdpf-assignment-note');
    caseBox.append(prepareCase, clearCase, caseNote, caseText);
    const intentLabel = make('label', '', 'What should classification do?');
    const intentSelect = make('select', '');
    intentSelect.setAttribute('aria-label', 'Classification review intent');
    for (const [value, title] of [['pending', 'Not reviewed yet'], ['section', 'Recognize the chosen section'], ['unresolved', 'Keep unresolved'], ['mixed', 'Recognize mixed content'], ['placement', 'Intentional placement only'], ['needs-context', 'Needs more context']]) {
        const option = make('option', '', title); option.value = value; intentSelect.append(option);
    }
    intentSelect.value = 'pending'; intentLabel.append(intentSelect);
    caseDescription.append(intentLabel);
    assignmentPanel.append(caseBox);
    shell.append(assignmentPanel);
    const overview = make('div', 'mdpf-review-summary');
    overview.hidden = true;
    const overviewText = make('span', '');
    const reviewButton = make('button', '', 'Review suggestions'); reviewButton.type = 'button';
    overview.append(overviewText, reviewButton);
    shell.append(overview);
    host.append(shell);
    host.classList.add('mdpf-prompt-host');
    native.classList.add('mdpf-native-source');

    const wrapper = native.parentElement;
    wrapper.classList.add('mdpf-native-wrapper');
    const gutter = make('div', 'mdpf-native-gutter');
    gutter.setAttribute('aria-hidden', 'true');
    gutter.hidden = true;
    wrapper.append(gutter);
    const mirror = make('div', 'mdpf-measure');
    mirror.setAttribute('aria-hidden', 'true');
    document.body.append(mirror);
    const saved = Object.fromEntries(['padding-left', 'line-height', 'background-image', 'background-origin', 'background-repeat', 'background-size'].map(name => [name, [native.style.getPropertyValue(name), native.style.getPropertyPriority(name)]]));
    let active = false, sourceDoc = null, signature = '', frame = 0, destroyed = false;
    let spacingSnapshot = null, compactLayout = false;
    let labels = null, selectedLine = null, spacingWrite = false, localEditUntil = 0;
    let assignmentReset = false;
    let reviewCache = null, preparedCaseSource = null, preparedCaseKey = null, lastIntentLine = null;
    function currentReview() {
        if (reviewCache?.state !== labels) reviewCache = { state: labels, ...reviewLines(labels) };
        return reviewCache;
    }
    function clearPreparedCase() {
        preparedCaseSource = null; preparedCaseKey = null; caseText.textContent = ''; caseText.hidden = true; clearCase.hidden = true;
    }
    function syncReview() {
        const review = currentReview();
        if (lastIntentLine !== selectedLine) { intentSelect.value = 'pending'; lastIntentLine = selectedLine; }
        const selected = labels.rows.find(row => row.id === selectedLine);
        if (preparedCaseKey !== null && preparedCaseKey !== JSON.stringify([selectedLine, selected?.module, selected?.manual, intentSelect.value])) clearPreparedCase();
        overview.hidden = !active;
        overviewText.textContent = `${review.counts.suggestion} label suggestion${review.counts.suggestion === 1 ? '' : 's'} · ${review.counts.unresolved} unresolved · ${review.counts.manual} manual`;
        reviewButton.disabled = !review.counts.suggestion;
        prepareCase.disabled = !labels.rows.some(row => row.id === selectedLine && row.manual && !row.header && !row.protected && row.text.trim()) || intentSelect.value === 'section' && selected?.module === null;
        caseNote.textContent = prepareCase.disabled ? 'Choose a manual content-line label; recognizing a section needs L1–L7.'
            : intentSelect.value === 'pending' ? 'Pending cases are excluded from evaluation until you choose an intent.'
            : intentSelect.value === 'placement' ? 'Placement records your layout choice; it does not require the scorer to recognize that section.'
            : 'Your review intent and manual label will be recorded for this example only.';
        const filtered = review.entries.filter(entry => reviewFilter.value === 'all' || entry.category === reviewFilter.value);
        const nodes = filtered.slice(0, 20).map(entry => {
            const target = entry.result.module ? `L${entry.result.module}` : entry.result.status;
            const current = entry.currentModule ? `L${entry.currentModule}` : 'Unassigned';
            const button = make('button', '', `Line ${entry.line} · ${current}${entry.category === 'suggestion' ? ` → ${target}` : ` · ${entry.category === 'manual' ? 'manual' : entry.result.status}`} · ${entry.text.trim().slice(0, 80)}`);
            button.type = 'button'; button.title = entry.text;
            button.setAttribute('aria-pressed', String(entry.id === selectedLine));
            button.addEventListener('click', () => {
                observe();
                if (!currentReview().entries.some(row => row.id === entry.id && row.text === entry.text)) return;
                selectedLine = entry.id; syncAssignmentPanel();
            });
            return button;
        });
        if (!nodes.length) nodes.push(make('p', 'mdpf-assignment-note', 'No lines in this view.'));
        if (filtered.length > 20) nodes.push(make('p', 'mdpf-assignment-note', `${filtered.length - 20} more lines are available in the Prompt line menu.`));
        reviewList.replaceChildren(...nodes);
    }
    function syncAssignmentPanel(followCaret = false) {
        if (!labels) return;
        if (followCaret) selectedLine = lineAtOffset(labels, native.selectionStart ?? 0)?.id;
        if (!labels.rows.some(row => row.id === selectedLine && !row.header && !row.protected)) selectedLine = labels.rows.find(row => !row.header && !row.protected)?.id ?? null;
        rowSelect.replaceChildren(...labels.rows.filter(row => !row.header && !row.protected).map(row => {
            const option = make('option', '', `Line ${row.index + 1} · ${row.text.trim().slice(0, 90) || '(empty line)'}`);
            option.value = row.id; return option;
        }));
        rowSelect.value = selectedLine ?? '';
        const row = labels.rows.find(row => row.id === selectedLine);
        moduleSelect.disabled = !row;
        moduleSelect.value = row?.manual ? row.module === null ? 'unassigned' : String(row.module) : 'detected';
        const current = row?.module ? `L${row.module} · ${MODULES[row.module - 1]}` : 'Unassigned';
        assignmentNote.textContent = row
            ? `${current}${row.manual ? ' · manual' : ' · detected / retained while typing'}. Labels only; no tags moved. Reloads or external replacement reset corrections.${assignmentReset ? ' Previous manual labels were cleared after prompt replacement.' : ''}`
            : 'Select a content line. Regional boundaries and heading spacer rows cannot be labeled.';
        resetLabels.disabled = !labels.rows.some(row => row.manual);
        const result = row ? scoreLine(row.text, { protected: row.protected }) : null;
        const ranked = result?.scores.map((score, index) => ({ module: index + 1, score })).filter(item => item.score > 0).sort((a, b) => b.score - a.score) ?? [];
        suggestionHeading.textContent = result?.status === 'suggested'
            ? `Suggested: L${result.module} · ${MODULES[result.module - 1]} · ${result.strength} evidence`
            : result?.status === 'mixed' ? 'Mixed evidence · More than one section is represented'
            : result?.status === 'uncertain' ? 'Uncertain · Not enough evidence to choose one section'
            : result?.status === 'incomplete' ? 'Suggestion paused · Finish or review the prompt syntax'
            : result?.status === 'empty' ? 'Start typing to see section suggestions'
            : 'No suggestion yet · No matching section evidence';
        suggestionNote.textContent = row?.manual
            ? 'Your manual label takes priority. Use the Section label menu to change it.'
            : result?.status === 'suggested' && result.module === row?.module
                ? 'The evidence agrees with the current label. Tags stay in place.'
                : 'Suggestions do not change labels while you type. Accept a label explicitly; tags stay in place.';
        useSuggestion.disabled = !row || row.manual || result?.status !== 'suggested' || result.module === row.module;
        suggestionDetails.hidden = !result || !result.evidence.length && !result.unknown.length && !result.ignored.length;
        const reasons = [];
        if (result) {
            reasons.push(`Matched ${result.evidence.length} of ${result.evidence.length + result.unknown.length} distinct eligible tags. Repeats count once; prompt emphasis weights do not change these evidence scores.`);
            if (ranked.length) reasons.push('Evidence points: ' + ranked.map(item => `L${item.module} ${MODULES[item.module - 1]}: ${item.score}`).join('; ') + '. These are not probabilities.');
            for (const match of result.evidence) reasons.push(`${match.raw} → ${Object.entries(match.scores).map(([module, weight]) => `L${module} +${weight}`).join(', ')} (${match.rule}).`);
            if (result.unknown.length) reasons.push('Not recognized: ' + result.unknown.join(', '));
            if (result.ignored.length) reasons.push('Not used as category evidence: ' + result.ignored.join(', '));
        }
        suggestionEvidence.replaceChildren(...reasons.map(reason => make('p', '', reason)));
        syncReview();
    }
    function restore() {
        for (const [name, [value, priority]] of Object.entries(saved)) {
            if (value) native.style.setProperty(name, value, priority); else native.style.removeProperty(name);
        }
    }
    function paint() {
        frame = 0;
        if (!active || destroyed || !native.clientWidth) return;
        const css = getComputedStyle(native);
        const padTop = parseFloat(css.paddingTop) || 0;
        const padLeft = parseFloat(css.paddingLeft) || 0;
        const padRight = parseFloat(css.paddingRight) || 0;
        for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform', 'tabSize', 'wordBreak', 'overflowWrap']) mirror.style[key] = css[key];
        mirror.style.width = `${Math.max(1, native.clientWidth - padLeft - padRight)}px`;
        mirror.style.whiteSpace = native.wrap === 'off' ? 'pre' : 'pre-wrap';
        mirror.replaceChildren();
        const rows = [];
        let offset = 0;
        for (const part of native.value.split(/\r\n|\r|\n/)) {
            const line = make('div', '', part || '\u200b');
            mirror.append(line);
            rows.push({ line, start: offset, end: offset + part.length });
            offset += part.length + 1; // HTML textarea values normalize newlines to LF.
        }
        const blocks = labels?.rows ?? [];
        gutter.replaceChildren();
        gutter.style.top = `${native.offsetTop + native.clientTop}px`;
        gutter.style.left = `${native.offsetLeft + native.clientLeft}px`;
        gutter.style.height = `${native.clientHeight}px`;
        gutter.style.width = `${native.clientWidth}px`;
        const gradients = [];
        let y = padTop - native.scrollTop;
        let previousHeight = 0;
        for (const row of rows) {
            const height = row.line.getBoundingClientRect().height;
            const block = blocks.find(item => item.start === row.start);
            if (block?.kind === 'control' && block.protected) {
                const label = make('span', 'mdpf-line-label mdpf-control-label', 'BREAK · text chunk boundary');
                label.style.top = `${y + 1}px`; label.style.right = '12px'; label.style.left = 'auto';
                label.style.color = '#9aa5b1'; gutter.append(label);
            }
            if (block && !block.header && !block.protected && (block.manual || block.module || block.kind === 'placement' || labels.detectedSupported) && (block.templateSlot || row.line.textContent !== '\u200b')) {
                const n = block.module;
                const character = sourceDoc?.characters?.find(item => item.id === block.characterId);
                const name = n ? `L${n} · ${MODULES[n - 1]}` : block.kind === 'delimiter' ? '— Region boundary' : block.kind === 'placement' ? 'Placement' : 'Unassigned';
                const hasSpacer = !block.templateContinuation && blocks.some(item => item.end === row.start - 1 && item.text === '');
                const headingTop = compactLayout && hasSpacer ? y - previousHeight : y;
                if (!block.templateContinuation && (!compactLayout || hasSpacer)) {
                    const number = block.templateCharacter ?? character?.number;
                    const label = make('span', 'mdpf-line-label', `${number ? `C${number} · ` : ''}${name}${block.manual && !block.templateSlot ? ' · manual' : ''}`);
                    label.style.top = `${headingTop + 1}px`;
                    label.style.left = `${padLeft}px`;
                    label.style.color = n ? `rgb(${colors[n - 1]})` : 'inherit';
                    gutter.append(label);
                }
                const start = Math.max(0, headingTop), end = Math.min(native.clientHeight, y + height);
                if (end > start) gradients.push(`linear-gradient(to bottom, transparent ${start}px, rgba(${colors[n - 1] ?? '128,128,128'},.17) ${start}px, rgba(${colors[n - 1] ?? '128,128,128'},.17) ${end}px, transparent ${end}px)`);
            }
            y += height;
            previousHeight = height;
        }
        native.style.backgroundImage = gradients.length ? gradients.join(',') : 'none';
        native.style.backgroundOrigin = 'padding-box';
        native.style.backgroundRepeat = 'no-repeat';
        native.style.backgroundSize = '100% 100%';
    }
    function schedule() { if (!frame && !destroyed) frame = requestAnimationFrame(paint); }
    function observe(force = false, reason = 'external', edit = null) {
        fixSummary.observe();
        refreshTemplates();
        if (destroyed) return;
        const integration = coupleState(host, id);
        const next = JSON.stringify([native.value, getExtraQuality(), integration]);
        if (next === signature && !force) return;
        signature = next;
        extra.checked = getExtraQuality();
        undoSpacing.disabled = !spacingSnapshot || native.value !== spacingSnapshot.after;
        const options = { extraQualityLine: getExtraQuality() };
        const literalRegions = integration.state === 'enabled' && integration.separator !== '\n' && native.value.includes(integration.separator);
        sourceDoc = literalRegions ? { supported: false } : inspectPrompt(native.value, options);
        if (!sourceDoc.supported) sourceDoc = inspectStructure(native.value, {
            ...options,
            ...(integration.state === 'enabled' && integration.separator !== '\n' ? { separator: integration.separator, globalPosition: integration.globalPosition } : {}),
        });
        sourceDoc.protectedSeparator = integration.state === 'enabled' ? integration.separator : undefined;
        labels = updateAssignments(labels, native.value, sourceDoc, { reason, edit });
        if (preparedCaseSource !== null && preparedCaseSource !== native.value) clearPreparedCase();
        assignmentReset = labels.reset;
        syncAssignmentPanel();
        if (!active) return;
        if (labels.rows.some(row => row.templateSlot)) compactLayout = true;
        else if (sourceDoc.supported) compactLayout = !!sourceDoc.headingRows && !(integration.state === 'enabled' && /[\r\n]/.test(integration.separator));
        native.style.lineHeight = compactLayout ? '1.5' : 'calc(1.5em + 32px)';
        status.textContent = !sourceDoc.supported
            ? 'Line Chunks 0.50.0-alpha.1 · Keep writing or use Assign line; existing line labels are retained while detection is incomplete.'
            : sourceDoc.empty
                ? 'Line Chunks 0.50.0-alpha.1 · Start a prompt · Use Assign line to choose a section, then type in the prompt box.'
            : compactLayout
                ? 'Line Chunks 0.50.0-alpha.1 · Compact wraps ACTIVE · Normal spacing within sections; blank heading rows are part of the prompt.'
                : !sourceDoc.modules || sourceDoc.empty || integration.state === 'enabled'
                    ? 'Line Chunks 0.50.0-alpha.1 · Existing spacing · Select Detect / View for supported standalone regions; newline or inline separators keep their spacing.'
                    : 'Line Chunks 0.50.0-alpha.1 · Prompt changed · Select Detect / View to apply the default compact spacing.';
        const messages = sourceDoc.supported && sourceDoc.blocks ? structureAdvisories(sourceDoc, integration) : [];
        advisory.replaceChildren(...messages.map(message => make('p', '', message)));
        advisory.hidden = !messages.length;
        schedule();
    }
    function setActive(value, format = true, reason = 'redetect') {
        active = value;
        toggle.textContent = `Line Chunks · ${active ? 'On' : 'Off'}`;
        toggle.setAttribute('aria-checked', String(active));
        gutter.hidden = !active;
        status.hidden = !active;
        assignButton.disabled = !active;
        overview.hidden = !active;
        if (!active) { assignmentPanel.hidden = true; assignButton.setAttribute('aria-expanded', 'false'); clearPreparedCase(); }
        if (active) {
            native.style.paddingLeft = '12px';
            // Native text is vertically centered in its line box. Reserve its upper
            // leading for a heading without inserting characters or moving the caret.
            native.style.lineHeight = 'calc(1.5em + 32px)';
            observe(true, reason);
            // Format only in direct response to mode entry or Detect / View.
            // Never do this from observe(): typing, polling and transfers stay read-only.
            const integration = coupleState(host, id);
            const safeSeparator = integration.state !== 'enabled' || !/[\r\n]/.test(integration.separator);
            if (format && sourceDoc?.supported && !sourceDoc.empty && !sourceDoc.headingRows && safeSeparator && !labels.rows.some(row => row.templateSlot)) {
                const before = native.value;
                const after = sourceDoc.modules ? addHeadingRows(sourceDoc) : addStructureHeadingRows(sourceDoc);
                if (after !== before) {
                    spacingSnapshot = { before, after };
                    writeSpacing(after);
                    if (native.value !== after) spacingSnapshot = null;
                    undoSpacing.disabled = !spacingSnapshot;
                }
            }
        } else { restore(); advisory.hidden = true; }
    }
    function writeSpacing(text) {
        spacingWrite = true;
        try {
            native.value = text;
            if (typeof updateInput === 'function') updateInput(native);
            else native.dispatchEvent(new Event('input', { bubbles: true }));
            observe(true, 'spacing');
        } finally { spacingWrite = false; }
    }
    undoSpacing.addEventListener('click', () => {
        if (!spacingSnapshot || native.value !== spacingSnapshot.after) { observe(true); return; }
        const before = spacingSnapshot.before;
        spacingSnapshot = null;
        setActive(false);
        writeSpacing(before);
    });
    toggle.addEventListener('click', () => setActive(!active));
    detect.addEventListener('click', () => setActive(true));
    info.addEventListener('click', () => { help.hidden = !help.hidden; info.setAttribute('aria-expanded', String(!help.hidden)); });
    extra.addEventListener('change', () => { setExtraQuality(extra.checked); observe(true, 'redetect'); });
    assignButton.addEventListener('click', () => {
        observe(true);
        assignmentPanel.hidden = !assignmentPanel.hidden;
        assignButton.setAttribute('aria-expanded', String(!assignmentPanel.hidden));
        if (!assignmentPanel.hidden) syncAssignmentPanel(true);
    });
    closeAssignment.addEventListener('click', () => { assignmentPanel.hidden = true; assignButton.setAttribute('aria-expanded', 'false'); native.focus(); });
    reviewButton.addEventListener('click', () => {
        observe();
        const first = currentReview().entries.find(entry => entry.category === 'suggestion');
        if (!active || !first) return;
        selectedLine = first.id;
        assignmentPanel.hidden = false; assignButton.setAttribute('aria-expanded', 'true');
        reviewBox.open = true; reviewFilter.value = 'suggestion'; syncAssignmentPanel();
    });
    reviewFilter.addEventListener('change', syncReview);
    prepareCase.addEventListener('click', () => {
        const target = selectedLine;
        observe();
        const row = labels.rows.find(row => row.id === target);
        if (!row || !row.manual || row.header || row.protected || !row.text.trim()) return;
        if (intentSelect.value === 'section' && row.module === null) return;
        caseText.textContent = JSON.stringify(prepareReviewCase(labels, target, { intent: intentSelect.value }), null, 2);
        preparedCaseSource = native.value; preparedCaseKey = JSON.stringify([target, row.module, row.manual, intentSelect.value]);
        caseText.hidden = false; clearCase.hidden = false;
    });
    clearCase.addEventListener('click', clearPreparedCase);
    intentSelect.addEventListener('change', () => { clearPreparedCase(); syncReview(); });
    rowSelect.addEventListener('change', () => { selectedLine = rowSelect.value; syncAssignmentPanel(); });
    moduleSelect.addEventListener('change', () => {
        // A transfer may have happened while the menu was open. Revalidate identity.
        const target = selectedLine, value = moduleSelect.value;
        observe();
        if (!labels.rows.some(row => row.id === target && !row.header && !row.protected)) return;
        labels = setLineAssignment(labels, target, value === 'detected' ? undefined : value === 'unassigned' ? null : Number(value));
        syncAssignmentPanel(); schedule();
    });
    resetLabels.addEventListener('click', () => { observe(true); labels = resetLineAssignments(labels, sourceDoc); syncAssignmentPanel(); schedule(); });
    useSuggestion.addEventListener('click', () => {
        const target = selectedLine;
        const before = labels.rows.find(row => row.id === target)?.text;
        observe();
        const row = labels.rows.find(row => row.id === target);
        if (!row || row.text !== before || row.manual || row.header || row.protected) return;
        const result = scoreLine(row.text);
        if (result.status !== 'suggested' || result.module === row.module) return;
        labels = setLineAssignment(labels, target, result.module);
        syncAssignmentPanel(); schedule();
    });
    function caretMoved() { if (!assignmentPanel.hidden) syncAssignmentPanel(true); }
    function localIntent() { localEditUntil = Date.now() + 1500; }
    let pendingEdit = null;
    function beforeEdit(event) { pendingEdit = { source: native.value, start: native.selectionStart, end: native.selectionEnd, inputType: event?.inputType }; }
    function nativeEdited(event) {
        const edit = pendingEdit; pendingEdit = null;
        observe(true, spacingWrite ? 'spacing' : event?.isTrusted || Date.now() < localEditUntil ? 'typing' : 'external', edit);
    }
    native.addEventListener('beforeinput', beforeEdit);
    function addCompositionStart() { addComposing = true; addPlan = null; addPreview.hidden = true; refreshTemplates(); }
    function addCompositionEnd() { addComposing = false; refreshTemplates(); }
    native.addEventListener('compositionstart', addCompositionStart);
    native.addEventListener('compositionend', addCompositionEnd);
    native.addEventListener('input', nativeEdited);
    native.addEventListener('change', nativeEdited);
    native.addEventListener('keydown', localIntent);
    wrapper.addEventListener('pointerdown', localIntent);
    for (const event of ['click', 'keyup', 'select']) native.addEventListener(event, caretMoved);
    native.addEventListener('scroll', schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(native);
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule);
    status.hidden = true;
    return { shell, templates, observe, getCoupleState() { return coupleState(host, id); }, getEditorSnapshot() {
        observe();
        return { source: native.value, labels: structuredClone(labels), active, compact: compactLayout, extra: getExtraQuality() };
    }, restoreEditorSnapshot(snapshot) {
        if (destroyed || !snapshot || snapshot.source !== native.value || snapshot.labels?.source !== native.value
            || !Array.isArray(snapshot.labels.rows) || [snapshot.active, snapshot.compact, snapshot.extra].some(value => typeof value !== 'boolean')) return false;
        const physical = updateAssignments(null, native.value, { supported: false }).rows;
        if (physical.length !== snapshot.labels.rows.length || physical.some((row, index) => {
            const saved = snapshot.labels.rows[index];
            return row.start !== saved.start || row.end !== saved.end || row.text !== saved.text;
        })) return false;
        setExtraQuality(snapshot.extra); labels = structuredClone(snapshot.labels); compactLayout = snapshot.compact;
        setActive(snapshot.active, false, 'external'); observe(true); schedule(); return true;
    }, getLineAssignments() {
        observe();
        return labels ? { source: labels.source, rows: labels.rows.filter(row => row.manual).map(row => ({ ...row })) } : null;
    }, setLineAssignments(snapshot) {
        observe();
        if (!snapshot || snapshot.source !== native.value || !Array.isArray(snapshot.rows)) return false;
        const matches = snapshot.rows.map(row => ({ row, target: labels.rows.find(candidate => candidate.start === row.start && candidate.end === row.end && candidate.text === row.text && !candidate.header && !candidate.protected) }));
        if (matches.some(({ row, target }) => !target || row.module !== null && (!Number.isInteger(row.module) || row.module < 1 || row.module > 7))) return false;
        for (const { row, target } of matches) labels = setLineAssignment(labels, target.id, row.module);
        assignmentReset = false;
        syncAssignmentPanel(); schedule(); return true;
    }, destroy() {
        destroyed = true;
        draftRead++;
        for (const [url, timer] of draftUrls) { clearTimeout(timer); URL.revokeObjectURL(url); }
        draftUrls.clear();
        cancelAnimationFrame(frame);
        resize.disconnect();
        window.removeEventListener('resize', schedule);
        native.removeEventListener('input', nativeEdited);
        native.removeEventListener('beforeinput', beforeEdit);
        native.removeEventListener('compositionstart', addCompositionStart);
        native.removeEventListener('compositionend', addCompositionEnd);
        native.removeEventListener('change', nativeEdited);
        native.removeEventListener('keydown', localIntent);
        wrapper.removeEventListener('pointerdown', localIntent);
        for (const event of ['click', 'keyup', 'select']) native.removeEventListener(event, caretMoved);
        native.removeEventListener('scroll', schedule);
        restore();
        host.classList.remove('mdpf-prompt-host');
        native.classList.remove('mdpf-native-source');
        wrapper.classList.remove('mdpf-native-wrapper');
        gutter.remove(); mirror.remove(); templates.remove(); shell.remove();
    } };
}








