import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLine} from '../javascript/mdpf-classifier.mjs';
import {planAutoFix,organizedLineAssignments} from '../javascript/mdpf-line-organization.mjs';
import {characterOrderRank,outfitOrderRank,previewOrganization} from '../javascript/mdpf-organize.mjs';
import {coupleContext} from './helpers/couple-auto-fix.mjs';
import {verifyPreservation} from './helpers/extensive-organization.mjs';
// Reviewed physical descriptors: eyebrow gestures are deliberately not in this pool.
const modifiers=["black", "white", "red", "blue", "green", "yellow", "pink", "purple", "brown", "orange", "grey", "gray", "silver", "gold", "golden", "blonde", "blond", "ginger", "cyan", "aqua", "teal", "magenta", "violet", "colored", "coloured", "multicolored", "multicoloured", "two-tone", "big", "large", "small", "long", "short", "thick", "thin", "full", "sparse", "bushy", "straight", "arched", "curved", "round", "dark", "light", "pale", "bright", "wide", "narrow", "curly", "curled"];
const nouns=['eyelashes','eyelash','eyebrows','eyebrow','brows','brow'];
for(const modifier of modifiers)for(const noun of nouns)test(`facial appearance L3: ${modifier} ${noun}`,()=>{
 const tag=modifier+' '+noun;
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.2)`]){
  assert.equal(scoreLine(text).module,3,text);assert.equal(characterOrderRank(tag),30);
  const raw=`1girl, ${text}, black hair, looking up, boots, trigger_443,`,result=planAutoFix(raw);assert.equal(result.supported,true);verifyPreservation(raw,result);assert.ok(result.sections[2].tags.includes(text));assert.deepEqual(result.sections[6].tags,['trigger_443']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
 }
});
for(const tag of ["eyelashes", "eyelash", "eyebrows", "eyebrow", "unibrow", "brow", "brows", "no eyebrows", "no eyelashes"])test(`base face appearance: ${tag}`,()=>{assert.equal(scoreLine(tag).module,3);assert.equal(characterOrderRank(tag),30);});
for(const tag of ["furrowed eyebrows", "furrowed brows", "raised brows", "lowered eyebrows", "lowered brow", "lowered brows", "raising eyebrow", "raising eyebrows", "arching eyebrows", "furrowing brow", "furrowing eyebrows", "knit eyebrows", "knitted eyebrows", "one eyebrow raised", "eyebrow raised", "angry eyebrows", "raised eyebrow", "raised eyebrows", "furrowed brow", "v-shaped eyebrows"])test(`eyebrow expression stays L5: ${tag}`,()=>{
 assert.equal(scoreLine(tag).module,5);const raw=`1girl, ${tag}, red eyelashes, looking at viewer,`;
 const result=planAutoFix(raw);assert.equal(result.supported,true);verifyPreservation(raw,result);assert.deepEqual(result.sections[4].tags,['looking at viewer',tag]);assert.deepEqual(result.sections[2].tags,['1girl','red eyelashes']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
});
test('color/size combinations match completely and keep source spelling/weights',()=>{
 for(const tag of ['big red eyelashes','long thick black eyelashes','light blue eyebrows','dark brown bushy brows','colored eyelashes','coloured eyebrows','multicolored eyelashes','two-tone eyebrows','long thick dark red eyelashes']){
  assert.equal(scoreLine(tag).module,3,tag);const raw=`1girl, (${tag}:1.3), boots,`,result=planAutoFix(raw);assert.equal(result.supported,true);verifyPreservation(raw,result);assert.ok(result.sections[2].tags.includes(`(${tag}:1.3)`));
 }
 for(const tag of ['big long thick dark red eyelashes','unknown red eyelashes','red eyelashes style','eyelashes_trigger_443','red raised eyebrows','thin raised eyebrows','fake eyelashes','false eyelashes','eyelash extensions','eyebrow tattoo','applying red eyelashes','holding black eyebrows'])assert.notEqual(scoreLine(tag).module,3,tag);
});
test('worn accessories and printed clothing do not become character eyelashes/eyebrows',()=>{
 for(const tag of ['eyebrow piercing','eyebrow ring']){assert.equal(scoreLine(tag).module,4);assert.equal(outfitOrderRank(tag),20);}
 for(const tag of ['red eyelash print shirt','eyebrow print dress'])assert.equal(scoreLine(tag).module,4,tag);
 assert.notEqual(scoreLine('red eyebrow piercing').module,3);
});
test('face ranks retain hair/eyes/pupils/face/build order without changing established face order',()=>{
 const raw='1girl, body freckles, red eyelashes, blue hair, white pupils, green eyes, thin eyebrows, boots,';
 const result=planAutoFix(raw);assert.equal(result.supported,true);assert.deepEqual(result.sections[2].tags,['1girl','blue hair','green eyes','white pupils','red eyelashes','thin eyebrows','body freckles']);verifyPreservation(raw,result);
});
test('manual destinations win and mixed weighted expression/appearance needs review',()=>{
 const raw='1girl, arched eyebrows, red eyelashes, red eyelashes,';
 const result=previewOrganization(raw,{confirmedSolo:true,placements:{1:5},keepDuplicates:[3]});assert.equal(result.supported,true);verifyPreservation(raw,result);assert.deepEqual(result.sections[4].tags,['arched eyebrows']);assert.deepEqual(result.sections[2].tags,['1girl','red eyelashes','red eyelashes']);
 const mixed='1girl, (red eyelashes, raised eyebrows:1.2),';assert.equal(planAutoFix(mixed).supported,false);assert.equal(planAutoFix(mixed).proposed,null);
 for(const text of ['big eyelashes, red eyebrows,','2girls, big eyelashes,','1female, thin eyebrows,']){const fixed=planAutoFix(text);assert.equal(fixed.supported,false);assert.equal(fixed.proposed,null);}
});
test('face descriptors retain scoped duplicate cleanup, owner boundaries and BREAK',()=>{
 const raw='masterpiece, red eyelashes, red eyelashes,\n---\n1girl, thin eyebrows, thin eyebrows,\nBREAK\nred eyelashes,\n---\n1boy, yellow eyebrows, raised eyebrows,';
 const result=planAutoFix(raw,null,coupleContext('first'));assert.equal(result.supported,true);verifyPreservation(raw,result);assert.ok(result.proposed.startsWith('masterpiece, red eyelashes, red eyelashes,\n---\n'));assert.equal(result.duplicates.filter(x=>x.removed).length,1);assert.equal(planAutoFix(result.proposed,organizedLineAssignments(result),coupleContext('first')).proposed,result.proposed);
});
