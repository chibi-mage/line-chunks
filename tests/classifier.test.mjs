import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLine } from '../javascript/mdpf-classifier.mjs';

test('worn accessories and jewelry use outfit policy', () => {
    for (const tag of ['glasses', 'earrings', 'hair_ornament', 'hair_ribbon', 'ribbon']) {
        const result = scoreLine(tag);
        assert.equal(result.module, 4);
        assert.equal(result.status, 'suggested');
        assert.deepEqual(result.scores, [0, 0, 0, 4, 0, 0, 0]);
    }
    assert.equal(scoreLine('earrings, red dress,').module, 4);
    assert.equal(scoreLine('earrings, long hair,').module, null);
    assert.equal(scoreLine('jewelry').module, 4);
});

for (const [module, source] of [
    [1, 'masterpiece, best quality, highres,'],
    [2, 'standing, cowboy shot, from below,'],
    [3, '1boy, green hair, orange eyes,'],
    [4, 'medieval armor, black boots,'],
    [5, 'angry male, serious male, closed eyes,'],
    [6, 'medieval, fancy castle, stone walls,'],
    [7, 'watercolor, ink drawing,'],
]) test(`section evidence for L${module}`, () => {
    const result = scoreLine(source);
    assert.equal(result.status, 'suggested');
    assert.equal(result.module, module);
    assert.equal(result.source, source);
    assert.ok(result.evidence.length >= 2);
});

test('ambiguous medieval alone stays uncertain, while exact clothing phrases and locations differ', () => {
    assert.equal(scoreLine('medieval,').status, 'uncertain');
    assert.equal(scoreLine('medieval dress,').module, 4);
    assert.equal(scoreLine('medieval castle,').module, 6);
    assert.equal(scoreLine('castle print dress,').module, 4);
    assert.equal(scoreLine('closed eyes,').module, 5);
    assert.equal(scoreLine('blue eyes,').module, 3);
});

test('mixed modules, weak ties and mostly unknown lines can abstain', () => {
    const mixed = scoreLine('red dress, smile,');
    assert.equal(mixed.status, 'mixed');
    assert.equal(mixed.module, null);
    assert.equal(scoreLine('anime style,').status, 'uncertain');
    assert.equal(scoreLine('castle, zztrigger, aaidentifier, bbidentifier,').status, 'uncertain');
    assert.equal(scoreLine('zztrigger, aaidentifier,').status, 'unknown');
});

test('duplicates and underscore aliases count once; source emphasis is not evidence weight', () => {
    const plain = scoreLine('red dress,');
    const repeated = scoreLine('RED_DRESS, red dress, (red_dress:99),');
    assert.deepEqual(repeated.scores, plain.scores);
    assert.equal(repeated.evidence.length, 1);
    assert.equal(repeated.strength, 'tentative');
    assert.equal(scoreLine(Array(100).fill('medieval').join(',')).status, 'uncertain');
});

test('nested weighted groups are inspected without changing their original syntax', () => {
    const source = '((green_hair, blue_eyes:1.2):1.4),';
    const result = scoreLine(source);
    assert.equal(result.module, 3);
    assert.equal(result.evidence.length, 2);
    assert.equal(result.source, source);
    assert.equal(scoreLine('castle\\,dress,').status, 'unknown');
});

test('LoRA filenames are not category evidence or unknown-coverage penalties', () => {
    const onlyLora = scoreLine('<lora:castle_smile_dress:1>,');
    assert.equal(onlyLora.status, 'unknown');
    assert.equal(onlyLora.ignored.length, 1);
    assert.equal(onlyLora.evidence.length, 0);
    const character = scoreLine('<lora:unknown_style_name:0.7>, blue hair, green eyes,');
    assert.equal(character.module, 3);
    assert.equal(character.coverage, 1);
});

test('protected, dynamic and unfinished syntax never produces a recommendation', () => {
    for (const source of ['---', 'standing, BREAK, smile,', 'AND']) assert.equal(scoreLine(source).status, 'protected');
    assert.equal(scoreLine('***', { protected: true }).status, 'protected');
    for (const source of ['(smile,', '[red:blue:0.5],', '{red|blue},', '__outfit__,', '# comment']) {
        const result = scoreLine(source);
        assert.equal(result.status, 'incomplete');
        assert.equal(result.module, null);
    }
    assert.equal(scoreLine(' ').status, 'empty');
});
