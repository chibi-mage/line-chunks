import { tokenize } from './mdpf-core.mjs?v=0.48.2-alpha.1';
import { EXACT_RULES, PATTERN_RULES, RULESET_VERSION } from './mdpf-rules.mjs?v=0.48.2-alpha.1';

const exact = new Map(EXACT_RULES.map(rule => [rule.tag, rule]));
export const SCORING_POLICY = Object.freeze({ minScore: 4, minCoverage: 0.4, minShare: 0.7, minMargin: 3, mixedShare: 0.3, mixedScore: 4 });
// Literal escaped parentheses are lookup-equivalent only; source is never rewritten.
const normalize = text => text.trim().replace(/\\([()])/g, '$1').replaceAll('_', ' ').replace(/\s+/g, ' ').toLowerCase();

function outerGroup(text) {
    if (!text.startsWith('(') || !text.endsWith(')')) return null;
    let depth = 0, escaped = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '(') depth++;
        if (char === ')' && --depth === 0 && index !== text.length - 1) return null;
    }
    return text.slice(1, -1).replace(/:\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*$/, '').trim();
}

function atoms(text, depth = 0) {
    if (depth > 32) return [text];
    const group = outerGroup(text.trim());
    if (group !== null) return atoms(group, depth + 1);
    const parts = tokenize(text).tokens.map(token => token.text.trim()).filter(Boolean);
    return parts.length > 1 || parts.length === 1 && parts[0] !== text.trim()
        ? parts.flatMap(part => atoms(part, depth + 1)) : parts;
}

/** Evaluation identity only. Preserve raw source; never compare score vectors as identity.
 * Match the scorer's aliases, order independence and repeated-atom suppression.
 * Unsupported/protected inputs retain exact identity to avoid normalizing controls.
 */
export function classificationInputKey(source) {
    const result = scoreLine(source);
    if (['empty', 'protected', 'incomplete'].includes(result.status)) return JSON.stringify(['raw', source]);
    return JSON.stringify(['atoms', [...new Set(atoms(source).map(normalize).filter(Boolean))].sort()]);
}

/** Read-only, context-free evidence. Never infers character ownership or moves text. */
export function scoreLine(source, { protected: protectedRow = false } = {}) {
    const base = { schemaVersion: 1, rulesetVersion: RULESET_VERSION, source, status: 'unknown', module: null,
        strength: null, scores: Array(7).fill(0), evidence: [], unknown: [], ignored: [], coverage: 0, margin: 0, share: 0 };
    if (!source.trim()) return { ...base, status: 'empty' };
    if (protectedRow || /\b(?:BREAK|AND)\b|\[SEP\]/.test(source) || /^\s*---\s*$/.test(source)) return { ...base, status: 'protected' };
    if (tokenize(source).issues.length || /[\[\]{}#]|__[^\n]+__/.test(source)) return { ...base, status: 'incomplete' };
    const seen = new Set();
    for (const raw of atoms(source)) {
        const tag = normalize(raw);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        if (/^<[^>]+>$/.test(tag)) { base.ignored.push(raw); continue; }
        const rule = exact.get(tag) ?? PATTERN_RULES.find(rule => rule.pattern.test(tag));
        if (!rule) { base.unknown.push(raw); continue; }
        const evidence = { tag, raw, rule: rule.origin ?? (rule.tag ? 'exact tag/phrase' : rule.id), scores: { ...rule.scores } };
        base.evidence.push(evidence);
        for (const [module, weight] of Object.entries(evidence.scores)) base.scores[Number(module) - 1] += weight;
    }
    const eligible = base.evidence.length + base.unknown.length;
    base.coverage = eligible ? base.evidence.length / eligible : 0;
    const ranked = base.scores.map((score, index) => ({ module: index + 1, score })).sort((a, b) => b.score - a.score);
    const [best, second] = ranked;
    const total = base.scores.reduce((a, b) => a + b, 0);
    base.share = total ? best.score / total : 0;
    base.margin = best.score - second.score;
    if (!total) return base;
    const p = SCORING_POLICY;
    if (second.score >= p.mixedScore && second.score / total >= p.mixedShare) return { ...base, status: 'mixed' };
    if (best.score < p.minScore || base.coverage < p.minCoverage || base.share < p.minShare || base.margin < p.minMargin) return { ...base, status: 'uncertain' };
    return { ...base, status: 'suggested', module: best.module,
        strength: base.evidence.filter(match => (match.scores[best.module] ?? 0) >= 3).length >= 2 && base.coverage >= 0.6 && base.share >= 0.8 ? 'strong' : 'tentative' };
}
