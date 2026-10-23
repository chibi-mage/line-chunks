import { updateAssignments } from './mdpf-assignments.mjs?v=0.49.0-alpha.1';

export const DRAFT_MAX_BYTES = 2 * 1024 * 1024;
const kinds = new Set(['module', 'opaque', 'placement', 'delimiter', 'control']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, allowed) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unsupported draft fields.');
}
function bool(value) { if (typeof value !== 'boolean') throw new Error('Invalid draft flag.'); return value; }
function identifier(value) {
    if (value !== null && (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value))) throw new Error('Invalid character/region identifier.');
    return value;
}

// Versioned text + line metadata only. No executable content, host settings,
// generation parameters, credentials, filesystem paths or undo history.
export function validateDraft(value) {
    keys(value, ['format', 'schemaVersion', 'prompt', 'editor', 'lines', 'coupleHint']);
    if (value.format !== 'mdpf-draft' || value.schemaVersion !== 1) throw new Error('Unsupported MDPF draft format or version.');
    if (typeof value.prompt !== 'string' || value.prompt.length > 100000 || /\r|\u0000/.test(value.prompt)) throw new Error('Draft prompt must use LF newlines and contain at most 100,000 characters.');
    keys(value.editor, ['enabled', 'compact', 'extraQualityLine']);
    const editor = { enabled: bool(value.editor.enabled), compact: bool(value.editor.compact), extraQualityLine: bool(value.editor.extraQualityLine) };
    const rows = updateAssignments(null, value.prompt, { supported: false }).rows;
    if (!Array.isArray(value.lines) || value.lines.length !== rows.length || rows.length > 10000) throw new Error('Draft line metadata does not match its prompt.');
    const groups = new Map();
    const lines = value.lines.map((line, index) => {
        keys(line, ['module', 'kind', 'manual', 'header', 'template', 'templateHeader', 'continuation', 'group', 'character', 'characterId', 'regionId']);
        if (line.module !== null && (!Number.isInteger(line.module) || line.module < 1 || line.module > 7) || !kinds.has(line.kind)) throw new Error('Invalid section label.');
        if (line.character !== null && (!Number.isInteger(line.character) || line.character < 1 || line.character > 128)) throw new Error('Invalid character number.');
        if (line.group !== null && (!Number.isInteger(line.group) || line.group < 0 || line.group >= rows.length)) throw new Error('Invalid section group.');
        const result = { module: line.module, kind: line.kind, manual: bool(line.manual), header: bool(line.header), template: bool(line.template),
            templateHeader: bool(line.templateHeader), continuation: bool(line.continuation), group: line.group, character: line.character,
            characterId: identifier(line.characterId), regionId: identifier(line.regionId) };
        if (result.header && rows[index].text !== '' || result.templateHeader && !result.header) throw new Error('A heading must be a blank source row.');
        if (rows[index].protected && (result.header || result.manual || result.module !== null || result.template)) throw new Error('Control/separator rows cannot be assigned as editable sections.');
        if (result.template) {
            if (!result.manual || result.group === null || result.header || result.module === null && result.kind !== 'placement') throw new Error('Invalid template section.');
            const previous = groups.get(result.group);
            if (result.continuation) {
                if (!previous || previous.index !== index - 1 || previous.module !== result.module || previous.character !== result.character) throw new Error('A continuation must follow its own section.');
            } else {
                if (previous) throw new Error('A template section needs a unique group.');
            }
            groups.set(result.group, { index, module: result.module, character: result.character });
        } else if (result.group !== null || result.continuation) throw new Error('Unexpected template group.');
        return result;
    });
    let coupleHint = null;
    if (value.coupleHint !== null) {
        keys(value.coupleHint, ['separator', 'sharedPosition']);
        if (typeof value.coupleHint.separator !== 'string' || value.coupleHint.separator.length > 64 || !['first', 'last', 'none', 'unknown'].includes(value.coupleHint.sharedPosition)) throw new Error('Invalid Couple guidance.');
        coupleHint = { separator: value.coupleHint.separator, sharedPosition: value.coupleHint.sharedPosition };
    }
    return { format: 'mdpf-draft', schemaVersion: 1, prompt: value.prompt, editor, lines, coupleHint };
}

export function serializeDraft(state, { enabled = true, compact = !!state?.headingRows, extraQualityLine = false, coupleHint = null } = {}) {
    if (!state || typeof state.source !== 'string' || !Array.isArray(state.rows)) throw new Error('No current draft to save.');
    const current = updateAssignments(null, state.source, { supported: false });
    if (current.rows.length !== state.rows.length || current.rows.some((row, index) => row.start !== state.rows[index].start || row.end !== state.rows[index].end || row.text !== state.rows[index].text)) throw new Error('Draft labels are stale; inspect the current prompt before saving.');
    let previous = null, nextGroup = 0;
    const lines = state.rows.map((row, index) => {
        const template = !!row.templateSlot && !!row.manual && !row.header && (row.module !== null || row.kind === 'placement');
        const continuation = template && !!row.templateContinuation && previous?.index === index - 1
            && previous.key === row.templateGroup && previous.module === row.module && previous.character === row.templateCharacter;
        const group = template ? continuation ? previous.group : nextGroup++ : null;
        if (template) previous = { index, key: row.templateGroup, module: row.module, character: row.templateCharacter, group };
        return { module: row.module, kind: row.kind, manual: !!row.manual, header: !!row.header,
            template, templateHeader: !!row.header && !!row.templateHeader, continuation: !!continuation, group,
            character: row.templateCharacter ?? null, characterId: row.characterId ?? null, regionId: row.regionId ?? null };
    });
    const result = JSON.stringify(validateDraft({ format: 'mdpf-draft', schemaVersion: 1, prompt: state.source,
        editor: { enabled, compact, extraQualityLine }, lines, coupleHint }), null, 2) + '\n';
    if (new TextEncoder().encode(result).length > DRAFT_MAX_BYTES) throw new Error('Draft file exceeds the 2 MB limit.');
    return result;
}

export function parseDraft(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > DRAFT_MAX_BYTES) throw new Error('Choose an MDPF JSON draft file up to 2 MB.');
    let value;
    try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('The selected file is not valid JSON.'); }
    return validateDraft(value);
}

export function restoreDraft(value) {
    const draft = validateDraft(value);
    const state = updateAssignments(null, draft.prompt, { supported: false });
    state.rows = state.rows.map((row, index) => {
        const line = draft.lines[index];
        return { ...row, module: line.module, kind: line.kind, manual: line.manual, header: line.header,
            templateSlot: line.template, templateHeader: line.templateHeader, templateContinuation: line.continuation,
            templateGroup: line.group === null ? undefined : `draft-group-${line.group}`, templateCharacter: line.character,
            characterId: line.characterId, regionId: line.regionId };
    });
    state.headingRows = draft.editor.compact;
    return { state, editor: draft.editor, coupleHint: draft.coupleHint };
}
