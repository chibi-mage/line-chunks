// Portable bridge from explicit physical-line labels to scoped organization.
// Detected labels never become placement constraints. Source text is never changed here.
import { tokenize } from './mdpf-core.mjs?v=0.49.2-alpha.1';
import { previewOrganization, previewRegionalOrganization } from './mdpf-organize.mjs?v=0.49.2-alpha.1';
import { standaloneBreaks } from './mdpf-controls.mjs?v=0.49.2-alpha.1';

// One-click policy is independent of review-panel choices. It never infers owners
// from line order and never treats weak/tentative evidence as automatic evidence.
export function planAutoFix(source, state = null, { coupleEnabled = false, couple = null } = {}) {
    const blocked = message => ({ source, supported: false, proposed: null, issues: [message], review: [], items: [], moves: [], duplicates: [] });
    if (!source.trim()) return blocked('Enter a positive prompt first.');
    if (source.length > 20000) return blocked('Auto Fix supports up to 20,000 characters.');
    if (couple?.state === 'enabled') {
        if (couple.mode !== 'Basic') return blocked('Couple Auto Fix requires Basic region assignment. Use Organize for other modes.');
        if (couple.separator !== '---') return blocked('Couple Auto Fix requires the exact separator --- on its own rows. Newline/custom separators use Organize.');
        if (!['first', 'last', 'none'].includes(couple.globalPosition)) return blocked('The Couple shared position could not be read. Use Organize.');
        if (couple.tileEnabled !== false) return blocked('Couple Auto Fix is unavailable in Tile Mode or when its state is unreadable.');
        if (!['off', '{ }', '< >'].includes(couple.commonSyntax)) return blocked('Couple Common Prompts syntax could not be read. Use Organize.');
        if (couple.commonSyntax === '{ }' && /[{}]/.test(source) || couple.commonSyntax === '< >' && /[<>]/.test(source)) {
            return blocked('Active Couple Common Prompts constructs require the reviewed workflow. Positive prompt unchanged.');
        }
        const result = previewWithLineAssignments(previewRegionalOrganization, source,
            { confirmedRegions: true, sharedPosition: couple.globalPosition, unknownStyle: true, deduplicate: true }, state);
        if (!result.supported) return result;
        const owners = new Map();
        for (const region of result.regions.filter(region => !region.shared)) {
            const span = owners.get(region.parentIndex) ?? { start: region.start, end: region.end };
            span.start = Math.min(span.start, region.start); span.end = Math.max(span.end, region.end); owners.set(region.parentIndex, span);
        }
        for (const [index, span] of owners) {
            const text = standaloneBreaks(source.slice(span.start, span.end)).masked;
            const counts = text.match(/\b\d+(?:girl|boy|other)s?\b/gi) ?? [];
            const tokens = tokenize(text).tokens;
            if (counts.length !== 1 || tokens.filter(token => /^1(?:girl|boy|other)$/i.test(token.text.trim())).length !== 1
                || tokens.some(token => /^(?:multiple (?:girls|boys|others)|crowd|group|couple)$/i.test(token.text.trim()))) {
                return blocked(`Couple chunk ${index + 1} needs one explicit 1girl, 1boy or 1other count. Use Organize to verify ownership.`);
            }
        }
        if (result.items.some(item => /^1(?:girl|boy|other)$/i.test(item.text) && item.module !== 3)) return blocked('Character counts must remain in L3. Reset the affected line labels.');
        return { ...result, autoFixMode: 'regional', ownerCount: owners.size, sharedPosition: couple.globalPosition };
    }
    if (coupleEnabled) return blocked('Read the full Forge Couple configuration before regional Auto Fix. Use Organize if it is unavailable.');
    if (/---|\b(?:BREAK|AND)\b|\[SEP\]/.test(source)) return blocked('Auto Fix is solo-only and leaves prompt boundaries unchanged. Use Organize for this prompt.');
    const tokens = tokenize(source).tokens;
    const counts = source.match(/\b\d+(?:girl|boy|other)s?\b/gi) ?? [];
    const anchors = tokens.filter(token => /^1(?:girl|boy|other)$/i.test(token.text.trim()));
    if (counts.length !== 1 || anchors.length !== 1 || tokens.some(token => /^(?:multiple (?:girls|boys|others)|crowd|group|couple)$/i.test(token.text.trim()))) {
        return blocked('Auto Fix needs one explicit 1girl, 1boy or 1other tag and no multiple-character counts. Use Organize to confirm ownership.');
    }
    const result = previewWithLineAssignments(previewOrganization, source,
        { confirmedSolo: true, unknownStyle: true, deduplicate: true }, state);
    const anchor = result.items.find(item => /^1(?:girl|boy|other)$/i.test(item.text));
    if (result.supported && anchor?.module !== 3) return blocked('The character count must stay in L3. Reset its line label before Auto Fix.');
    return result;
}

export function previewWithLineAssignments(planner, source, options, state) {
    const initial = planner(source, options);
    if (!state) return initial;
    const blocked = message => ({ ...initial, supported: false, proposed: null, edits: [], issues: [...initial.issues, message] });
    if (state.source !== source || !Array.isArray(state.rows)) return blocked('Line labels are stale. Refresh the preview against the current positive prompt.');
    const rows = state.rows.filter(row => row.manual && !row.header && !row.protected && row.text?.trim());
    if (!rows.length) return initial;
    if (rows.some(row => !Number.isInteger(row.start) || !Number.isInteger(row.end) || row.start < 0 || row.end < row.start
        || source.slice(row.start, row.end) !== row.text || /[\r\n]/.test(row.text)
        || row.start !== 0 && !/[\r\n]/.test(source[row.start - 1]) || row.end !== source.length && !/[\r\n]/.test(source[row.end] ?? '')
        || row.module !== null && (!Number.isInteger(row.module) || row.module < 1 || row.module > 7))) return blocked('Invalid manual line labels. Reset the affected labels before organizing.');
    if (new Set(rows.map(row => row.start)).size !== rows.length) return blocked('Overlapping manual line labels. Reset the affected labels before organizing.');
    const assignments = new Map(), placements = { ...options.placements }, issues = [];
    for (const item of initial.items) {
        const region = initial.regions?.find(region => region.index === item.regionIndex);
        const token = tokenize(region?.text ?? source).tokens[item.index - (region?.offset ?? 0)];
        if (!token) continue;
        const start = (region?.start ?? 0) + token.start + token.text.length - token.text.trimStart().length;
        const end = (region?.start ?? 0) + token.end - (token.text.length - token.text.trimEnd().length);
        const row = rows.find(row => row.start <= start && row.end >= end);
        if (!row) continue;
        const assignment = { line: source.slice(0, row.start).split(/\r\n|\r|\n/).length, module: row.module };
        assignments.set(item.index, assignment);
        if (row.module === null) { issues.push(`Manual line ${assignment.line} is Unassigned. Choose a section or reset its label before organizing.`); continue; }
        const bundle = (options.bundles ?? []).find(bundle => bundle.start <= item.index && bundle.end >= item.index);
        if (bundle && bundle.module !== row.module) issues.push(`Bundle conflicts with manual line ${assignment.line} (L${row.module}). Reset the line label or use the same bundle destination.`);
        if (!bundle) placements[item.index] = row.module;
    }
    const result = planner(source, { ...options, placements });
    result.items = result.items.map(item => assignments.has(item.index) ? { ...item, lineAssignment: assignments.get(item.index) } : item);
    result.moves = result.moves.map(move => assignments.has(move.originalIndex) ? { ...move, lineAssignment: assignments.get(move.originalIndex) } : move);
    result.manualLineItems = assignments.size;
    if (issues.length) { result.issues = [...new Set([...result.issues, ...issues])]; result.supported = false; result.proposed = null; result.edits = []; }
    return result;
}

// Rebase explicit intent onto the actual output section rows, by scoped edit position.
// Never identify output rows by matching tag strings across characters.
export function organizedLineAssignments(result) {
    if (!result.supported || typeof result.proposed !== 'string') return null;
    const source = result.proposed, rows = [];
    const physical = text => {
        const list=[]; let start=0;
        for(const match of text.matchAll(/\r\n|\r|\n/g)){list.push({start,end:match.index,text:text.slice(start,match.index)});start=match.index+match[0].length;}
        list.push({start,end:text.length,text:text.slice(start)});return list;
    };
    const assign = (text, offset, sections, moves) => {
        const content = physical(text).filter(row=>row.text.trim());
        const nonempty = sections.filter(section=>section.tags.length);
        if(content.length!==nonempty.length) return;
        nonempty.forEach((section,index)=>{
            if(moves.some(move=>move.module===section.module&&(move.lineAssignment || ['manual', 'bundle'].includes(move.placement)))) rows.push({...content[index],start:content[index].start+offset,end:content[index].end+offset,module:section.module,manual:true});
        });
    };
    if(!result.regions) assign(source,0,result.sections,result.moves);
    else {
        let shift=0;
        for(const edit of [...result.edits].sort((a,b)=>a.start-b.start)) {
            const region=result.regions.find(region=>region.start===edit.start&&region.end===edit.end);
            assign(edit.replacement,edit.start+shift,region.result.sections,result.moves.filter(move=>move.regionIndex===region.index));
            shift+=edit.replacement.length-(edit.end-edit.start);
        }
    }
    return {source,rows};
}
