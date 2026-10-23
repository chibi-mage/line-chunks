// Session-local line identities and labels. No DOM, host imports, text writes or scores.
function sourceRows(source) {
    const rows = [];
    let start = 0;
    for (const match of source.matchAll(/\r\n|\r|\n/g)) {
        rows.push({ start, end: match.index, text: source.slice(start, match.index) });
        start = match.index + match[0].length;
    }
    rows.push({ start, end: source.length, text: source.slice(start) });
    return rows;
}

function candidates(source, document, nextId) {
    const blocks = document?.supported ? document.blocks ?? document.modules?.map((block, index) => ({ ...block, module: index + 1, kind: 'module' })) ?? [] : [];
    const rows = sourceRows(source).map((row, index) => {
        const block = blocks.find(block => block.start <= row.start && block.end >= row.end);
        const protectedRow = /^\s*(---|BREAK|AND|\[SEP\])\s*$/.test(row.text)
            || (!!document?.protectedSeparator && !/[\r\n]/.test(document.protectedSeparator) && row.text.includes(document.protectedSeparator))
            || blocks.some(block => block.kind === 'delimiter' && block.start < row.end && block.end > row.start);
        return { ...row, index, id: `line-${nextId++}`, module: block?.module ?? null,
            detectedModule: block?.module ?? null, detectedKind: block?.kind ?? 'opaque', kind: block?.kind ?? 'opaque', detectionKnown: !!document?.supported,
            characterId: block?.characterId ?? null, regionId: block?.regionId ?? null,
            manual: false, protected: protectedRow, header: false };
    });
    if (document?.headingRows) {
        for (const block of blocks) {
            if (block.kind === 'delimiter' || block.kind === 'control') continue;
            const index = rows.findIndex(row => row.start === block.start);
            if (index > 0 && rows[index - 1].text === '') rows[index - 1].header = true;
        }
    }
    return { rows, nextId };
}

function retain(row, old) {
    // Refresh evidence separately: typing must not change the current label.
    return { ...row, id: old.id, module: old.module, kind: old.kind, manual: old.manual,
        templateSlot: old.templateSlot, templateCharacter: old.templateCharacter, templateHeader: old.templateHeader,
        templateGroup: old.templateGroup, templateContinuation: old.templateContinuation,
        characterId: row.detectionKnown ? row.characterId : old.characterId,
        regionId: row.detectionKnown ? row.regionId : old.regionId, header: old.header && row.text === '' };
}

export function updateAssignments(previous, source, document, { reason = 'external', edit = null } = {}) {
    const fresh = candidates(source, document, previous?.nextId ?? 1);
    const state = { schemaVersion: 1, source, ...fresh, detectedSupported: !!document?.supported,
        headingRows: !!document?.headingRows, reset: false };
    if (!previous) return state;
    if (source === previous.source) {
        state.rows = state.rows.map((row, index) => {
            const old = previous.rows[index];
            if (!old || old.protected !== row.protected) return row;
            if (reason === 'redetect' && !old.manual && !old.templateHeader) return { ...row, id: old.id };
            return retain(row, old);
        });
        state.headingRows ||= state.rows.some(row => row.templateSlot);
        return state;
    }
    if (reason === 'spacing') {
        // Regional formatting can reuse authored blank rows as heading spacers.
        // Rebase content by ordered physical rows, including protected boundaries.
        const oldRows = previous.rows.filter(row => row.text !== '');
        const newRows = state.rows.filter(row => row.text !== '');
        if (oldRows.length === newRows.length && oldRows.every((row, index) => row.text === newRows[index].text)) {
            let index = 0;
            state.rows = state.rows.map(row => row.text === '' ? row : { ...retain(row, oldRows[index++]), header: false });
            return state;
        }
    }
    if (reason !== 'typing') {
        state.reset = previous.rows.some(row => row.manual);
        return state;
    }
    const before = previous.source;
    let prefix = 0, suffix = 0;
    while (prefix < before.length && prefix < source.length && before[prefix] === source[prefix]) prefix++;
    while (suffix < before.length - prefix && suffix < source.length - prefix && before[before.length - 1 - suffix] === source[source.length - 1 - suffix]) suffix++;
    if (edit?.source === before && edit.start === edit.end && source.length < before.length) {
        const removed = before.length - source.length;
        // Word/line deletion also reports a collapsed caret in beforeinput.
        // Resolve its actual removed span before matching identical blank rows;
        // unchanged-side validation below still rejects stale or invalid hints.
        const direction = /^delete(?:Content|Word|SoftLine|HardLine)(Backward|Forward)$/.exec(edit.inputType)?.[1];
        if (direction === 'Backward') edit = { ...edit, start: edit.start - removed };
        if (direction === 'Forward') edit = { ...edit, end: edit.end + removed };
    }
    // Native beforeinput disambiguates edits among consecutive empty template
    // rows. Accept its selection only when both unchanged sides still match.
    if (edit?.source === before && Number.isInteger(edit.start) && Number.isInteger(edit.end)
        && edit.start >= 0 && edit.end >= edit.start && edit.end <= before.length) {
        const length = source.length - before.length + edit.end - edit.start;
        if (length >= 0 && source.slice(0, edit.start) === before.slice(0, edit.start)
            && source.slice(edit.start + length) === before.slice(edit.end)) {
            prefix = edit.start; suffix = before.length - edit.end;
        }
    }
    const oldEnd = before.length - suffix, newEnd = source.length - suffix;
    const delta = source.length - before.length;
    const sameRowEdit = !/[\r\n]/.test(before.slice(prefix, oldEnd)) && !/[\r\n]/.test(source.slice(prefix, newEnd));
    const touched = sameRowEdit ? previous.rows.find(row => row.start <= prefix && row.end >= oldEnd) : null;
    const byPosition = new Map(state.rows.map((row, index) => [row.start, index]));
    for (const old of previous.rows) {
        let start = null;
        if (old === touched) start = old.start;
        else if (old.end <= prefix) start = old.start;
        else if (old.start >= oldEnd) start = old.start + delta;
        const index = byPosition.get(start);
        if (index === undefined) continue;
        const row = state.rows[index];
        if (row.protected || old.protected || (old !== touched && row.text !== old.text)) continue;
        state.rows[index] = retain(row, old);
    }
    // Continue only a known template section. Never propagate an assignment
    // across a heading, relationship, owner boundary or pasted control token.
    const affected = previous.rows.filter(row => row.end >= prefix && row.start <= oldEnd);
    const first = affected[0], last = affected.at(-1);
    if (!sameRowEdit && first?.templateSlot && first.module && affected.every(row =>
        row.templateSlot && !row.header && !row.protected && row.templateGroup === first.templateGroup
        && row.module === first.module && row.templateCharacter === first.templateCharacter)) {
        const replacements = state.rows.filter(row => row.start >= first.start && row.end <= last.end + delta);
        const control = replacements.some(row => row.protected || /(?:\bBREAK\b|\bAND\b|\[SEP\]|---)/.test(row.text));
        if (replacements.length && !control) {
            replacements.forEach((row, index) => {
                const retained = retain(row, first);
                state.rows[row.index] = { ...retained, id: index === 0 ? first.id : row.id,
                    header: false, templateContinuation: !!first.templateContinuation || index > 0 };
            });
        }
    }
    // Edits can split a continued section with a control or remove its first row.
    // Retained tails start a fresh run instead of pointing across that boundary.
    state.rows = coherentTemplateRuns(state.rows);
    // Temporary incomplete syntax may hide detection, but existing row identities survive.
    if (!document?.supported) state.headingRows = previous.headingRows;
    state.headingRows ||= state.rows.some(row => row.templateSlot);
    return state;
}

// Blank starters contain only editable count tags, an optional placement, and
// literal region delimiters. Section names are metadata, never prompt text.
export function buildStarterTemplate(type, { characters = 2, globalPosition = 'first' } = {}) {
    if (!['solo', 'pair', 'couple'].includes(type)) throw new Error('Unknown template.');
    if (type === 'couple' && (!Number.isInteger(characters) || characters < 2 || characters > 8 || !['first', 'last', 'none'].includes(globalPosition))) throw new Error('Choose 2–8 characters and a shared-region position.');
    const rows = [], slots = [];
    function slot(module, character = null, text = '', kind = 'module') {
        rows.push('');
        slots.push({ index: rows.length, module, templateCharacter: character, kind });
        rows.push(text);
    }
    const shared = () => { for (const n of [1, 2, 6, 7]) slot(n); };
    const owner = (number, count) => { slot(3, number, count); slot(4, number); slot(5, number); };
    if (type === 'solo') {
        slot(1); slot(2); owner(1, '1girl, solo,'); slot(6); slot(7);
    } else if (type === 'pair') {
        slot(1); slot(2); owner(1, '1girl,');
        slot(null, null, 'man next to girl,', 'placement');
        owner(2, '1boy,'); slot(6); slot(7);
    } else {
        if (globalPosition === 'first') { shared(); rows.push('---'); }
        for (let c = 1; c <= characters; c++) {
            owner(c, '1girl,'); slot(6, c);
            if (c < characters || globalPosition === 'last') rows.push('---');
        }
        if (globalPosition === 'last') shared();
    }
    return { source: rows.join('\n'), slots, type, characters: type === 'solo' ? 1 : type === 'pair' ? 2 : characters, globalPosition };
}

export function assignStarterTemplate(template) {
    const state = updateAssignments(null, template.source, { supported: false });
    for (const slot of template.slots) {
        state.rows[slot.index] = { ...state.rows[slot.index], ...slot, templateSlot: true, manual: true,
            templateGroup: state.rows[slot.index].id, templateContinuation: false };
        state.rows[slot.index - 1].header = true;
        state.rows[slot.index - 1].templateHeader = true;
    }
    state.headingRows = true;
    return state;
}

// Insertion-only planning: existing prompt bytes are never reorganized.
export function planCharacterAddition(state, { mode = 'ordinary', count = '1girl', placement = 'girl next to girl,', globalPosition = 'first' } = {}) {
    const fail = message => ({ supported: false, source: state?.source ?? '', message });
    if (!state?.source?.trim() || !state.rows?.length) return fail('Start a labeled prompt or insert a template first.');
    if (!['ordinary', 'couple'].includes(mode) || !['1girl', '1boy', '1other'].includes(count)) return fail('Choose an insertion layout and a single-character count.');
    const source = state.source;
    if (/\r/.test(source) || /\b(?:BREAK|AND)\b|\[SEP\]|[\[\]{}#]/.test(source)) return fail('This insertion supports LF prompts without BREAK or advanced controls. Use manual editing for this draft.');
    const starts = rows => rows.filter(row => /^\s*1(?:girl|boy|other)\s*,/i.test(row.text));
    const separators = [...source.matchAll(/^---[ \t]*$/gm)];
    let at = source.length, owners, append = true, fragment;
    if (mode === 'couple') {
        if (!['first', 'last', 'none'].includes(globalPosition) || (source.match(/---/g) ?? []).length !== separators.length) return fail('Choose the shared-region position and use standalone --- separators.');
        const cuts = [0, ...separators.map(match => match.index + match[0].length + 1), source.length + 1];
        const chunks = cuts.slice(0, -1).map((start, index) => state.rows.filter(row => row.start >= start && row.end < cuts[index + 1] && row.text.trim() !== '---'));
        if (globalPosition !== 'none' && chunks.length < 2) return fail('A shared-region layout needs an existing shared chunk and character region.');
        const regions = chunks.filter((_, index) => globalPosition === 'none' || index !== (globalPosition === 'first' ? 0 : chunks.length - 1));
        if (regions.some(rows => starts(rows).length !== 1 || (rows.map(row => row.text).join('\n').match(/\b\d+(?:girl|boy|other)s?\b/gi) ?? []).length !== 1)) return fail('Each existing character region needs exactly one line starting with 1girl, 1boy or 1other, without competing count tags.');
        owners = regions.length;
        if (globalPosition === 'last') { at = separators.at(-1).index; append = false; }
    } else {
        if (source.includes('---')) return fail('Use Forge Couple insertion for regional drafts.');
        const characters = starts(state.rows);
        if (!characters.length || characters.some(row => row.module !== 3 || row.header || row.protected)) return fail('Each character needs a labeled L3 line starting with 1girl, 1boy or 1other. Use Detect or Assign line first.');
        owners = characters.length;
        const last = characters.at(-1);
        const shared = state.rows.find(row => row.start > last.start && [6, 7].includes(row.module) && !row.templateCharacter && !row.characterId);
        if (shared) {
            const previous = state.rows[shared.index - 1];
            at = previous?.header ? previous.start : shared.start; append = false;
            if (state.rows.some(row => row.start >= at && row.text.trim() && ![6, 7].includes(row.module))) return fail('The trailing shared background/style needs clear labels before insertion.');
        } else if (state.rows.some(row => row.start > last.start && row.text.trim() && ![3, 4, 5].includes(row.module) && row.kind !== 'placement')) return fail('Label the last character and trailing shared sections before insertion.');
        if (!placement.trim() || /[\r\n]|\b(?:BREAK|AND)\b|---|\[SEP\]|\b\d+(?:girl|boy|other)s?\b/i.test(placement)) return fail('Enter one placement line without character count tags or region/control separators.');
    }
    if (owners < 1 || owners >= 8) return fail('Add character supports drafts with one through seven existing characters (eight total).');
    const number = owners + 1;
    const rows = mode === 'couple' ? ['', `${count},`, '', '', '', '', '', ''] : ['', placement.trim(), '', `${count},`, '', '', '', ''];
    const slotSpecs = mode === 'couple' ? [[1, 3], [3, 4], [5, 5], [7, 6]] : [[1, null], [3, 3], [5, 4], [7, 5]];
    const lead = mode === 'couple' ? (append ? '\n---\n' : '---\n') : append ? '\n' : '';
    fragment = lead + rows.join('\n') + '\n';
    const fragmentRows = sourceRows(fragment);
    const leadRows = (lead.match(/\n/g) ?? []).length;
    const slots = slotSpecs.map(([index, module]) => ({ start: at + fragmentRows[index + leadRows].start, module,
        templateCharacter: module ? number : null, kind: module ? 'module' : 'placement' }));
    return { supported: true, source, proposed: source.slice(0, at) + fragment + source.slice(at), at, fragment, append, slots,
        mode, number, globalPosition, message: `Add character ${number}; existing text and shared sections stay unchanged. Forge Couple settings remain manual.` };
}

export function applyCharacterAddition(state, plan) {
    if (!plan?.supported || state?.source !== plan.source || plan.proposed !== plan.source.slice(0, plan.at) + plan.fragment + plan.source.slice(plan.at)) return null;
    const fresh = candidates(plan.proposed, { supported: false }, state.nextId);
    const rows = fresh.rows;
    for (const old of state.rows) {
        const shifted = old.start >= plan.at && !(plan.append && old.start === plan.at);
        const start = old.start + (shifted ? plan.fragment.length : 0);
        const row = rows.find(row => row.start === start && row.text === old.text);
        if (row) rows[row.index] = { ...row, ...old, start: row.start, end: row.end, index: row.index };
    }
    for (const slot of plan.slots) {
        const row = rows.find(row => row.start === slot.start);
        if (!row) return null;
        rows[row.index] = { ...row, ...slot, templateSlot: true, templateContinuation: false, templateGroup: row.id, manual: true };
        const header = rows[row.index - 1];
        if (header?.text === '') rows[header.index] = { ...header, header: true, templateHeader: true };
    }
    return { ...state, source: plan.proposed, ...fresh, rows, headingRows: true, reset: false };
}

// A manual label applies to one physical row. Split its logical template run
// when necessary so later Enter/paste cannot inherit an incompatible section.
function coherentTemplateRuns(rows) {
    let previous = null;
    const used = new Set();
    return rows.map(row => {
        if (!row.templateSlot) { previous = null; return row; }
        if (!row.manual || row.module === null && row.kind !== 'placement') {
            previous = null;
            return { ...row, templateSlot: false, templateGroup: undefined, templateContinuation: false };
        }
        const key = row.templateGroup ?? row.id;
        const continuation = !!row.templateContinuation && previous?.key === key
            && previous.module === row.module && previous.character === row.templateCharacter;
        const group = continuation ? previous.group : used.has(key) ? row.id : key;
        used.add(group);
        previous = { key, group, module: row.module, character: row.templateCharacter };
        return { ...row, templateGroup: group, templateContinuation: continuation };
    });
}

export function setLineAssignment(state, id, module) {
    if (module !== undefined && module !== null && (!Number.isInteger(module) || module < 1 || module > 7)) throw new Error('Choose a module from L1 to L7, unassigned, or detected.');
    const target = state.rows.find(row => row.id === id);
    if (!target || target.header || target.protected) throw new Error('Select a prompt content line, not a heading spacer or boundary.');
    return { ...state, rows: coherentTemplateRuns(state.rows.map(row => row.id !== id ? row : {
        ...row, module: module === undefined ? row.detectedModule : module,
        manual: module !== undefined, kind: module === undefined ? row.detectedKind : module === null ? 'opaque' : 'module',
    })) };
}

export function resetLineAssignments(state, document) {
    const result = updateAssignments(null, state.source, document);
    return { ...result, headingRows: document?.supported ? result.headingRows : state.headingRows,
        nextId: Math.max(result.nextId, state.nextId), rows: result.rows.map((row, index) => ({ ...row,
            id: state.rows[index]?.id ?? row.id,
            header: document?.supported ? row.header : !!state.rows[index]?.header && row.text === '',
        })) };
}

export function lineAtOffset(state, offset) {
    let index = state.rows.findIndex((row, index) => row.start <= offset && (state.rows[index + 1]?.start ?? state.source.length + 1) > offset);
    if (index < 0) index = state.rows.length - 1;
    if (state.rows[index]?.header) index++;
    return state.rows[index] ?? null;
}
