// Portable, read-only review projections. No storage, clipboard, host or text writes.
import { scoreLine } from './mdpf-classifier.mjs?v=0.48.3-alpha.1';

// Presentation groups from a completed organization preview. Never changes a plan.
export function reviewOrganizationItems(items) {
    const attention = items.filter(item => !item.removedDuplicate && (
        item.reason || item.module === null || item.lineAssignment?.module === null
        || item.lineAssignment && item.module !== item.lineAssignment.module
        || !item.lineAssignment && item.bundleIndex === null && item.placement === 'provisional L7'
            && ['unclassified', 'quality-style-ambiguity'].includes(item.evidenceKind)
    ));
    return { attention, manual: items.filter(item => item.lineAssignment), all: [...items] };
}

export function reviewLines(state) {
    const entries = (state?.rows ?? []).filter(row => !row.header && !row.protected && row.text.trim()).map(row => {
        const result = scoreLine(row.text);
        const category = row.manual ? 'manual' : row.kind === 'placement' ? 'context'
            : result.status === 'suggested' ? result.module === row.module ? 'agreement' : 'suggestion'
            : ['unknown', 'mixed', 'uncertain', 'incomplete'].includes(result.status) ? 'unresolved' : 'context';
        return { id: row.id, line: row.index + 1, text: row.text, currentModule: row.module, category, result };
    });
    const counts = Object.fromEntries(['suggestion', 'unresolved', 'manual', 'agreement', 'context']
        .map(category => [category, entries.filter(entry => entry.category === category).length]));
    return { entries, counts };
}

export const REVIEW_INTENTS = Object.freeze(['pending', 'section', 'mixed', 'unresolved', 'placement', 'needs-context']);

export function prepareReviewCase(state, id, { intent = 'pending' } = {}) {
    const row = state?.rows.find(row => row.id === id);
    if (!row || row.header || row.protected || !row.manual || !row.text.trim()) throw new Error('Choose a manual label on a content line before preparing a review case.');
    if (!REVIEW_INTENTS.includes(intent) || intent === 'section' && row.module === null) throw new Error('Choose a valid review intent; section recognition requires L1-L7.');
    const result = scoreLine(row.text);
    return { schemaVersion: 1, rulesetVersion: result.rulesetVersion, source: 'main-positive-prompt-line',
        positiveLine: row.text, expected: { reviewedForThisExample: true, module: row.module },
        review: { intent, reviewer: '' }, split: 'unassigned',
        scope: { characterId: row.characterId, regionId: row.regionId },
        suggestion: { status: result.status, module: result.module, scores: result.scores,
            evidence: result.evidence, unknown: result.unknown, ignored: result.ignored },
        note: 'Session manual label for this example only; not a global tag rule, automatic training, or author-approved evaluation corpus.' };
}
