import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLine} from '../javascript/mdpf-classifier.mjs';
import {planAutoFix,organizedLineAssignments} from '../javascript/mdpf-line-organization.mjs';
import {previewOrganization,characterOrderRank,outfitOrderRank} from '../javascript/mdpf-organize.mjs';
import {coupleContext} from './helpers/couple-auto-fix.mjs';
import {verifyPreservation} from './helpers/extensive-organization.mjs';
const decisions=[["eye level", 2, null], ["overhead view", 2, null], ["portrait shot", 2, null], ["rear view", 2, null], ["back view", 2, null], ["arms behind head", 2, null], ["fighting stance", 2, null], ["clenched hands", 2, null], ["holding wrench", 2, null], ["facing viewer", 2, null], ["fish man", 3, 5], ["big male", 3, 35], ["big body", 3, 35], ["muscular body", 3, 35], ["big muscles", 3, 35], ["body builder", 3, 35], ["large pectorals", 3, 40], ["moobs", 3, 40], ["elf", 3, 5], ["long ears", 3, 30], ["cow horns", 3, 5], ["cow ears", 3, 30], ["battle scars", 3, 30], ["dirty face", 3, 30], ["curvy build", 3, 35], ["thigh gap", 3, 60], ["butt", 3, 70], ["pale yellow scleras", 3, 21], ["microbikini", 4, 40], ["cowbell", 4, 25], ["chin guard", 4, 20], ["pilot suit", 4, 40], ["completely naked", 4, 0], ["goggles on headwear", 4, 10], ["goggles on head", 4, 10], ["eyewear on headwear", 4, 10], ["brown headwear", 4, 10], ["dirty clothes", 4, 0], ["mechanic", 4, 5], ["wrench", 4, 100], ["bandaid", 4, 40], ["bandaid on face", 4, 20], ["bandaid on nose", 4, 20], ["upper teeth only", 5, null], ["blushing", 5, null], ["flirty", 5, null], ["smiling", 5, null], ["relaxed expression", 5, null], ["rock", 6, null], ["nature", 6, null], ["outdoor", 6, null], ["noon", 6, null], ["on mars", 6, null], ["on a ufo", 6, null], ["watercraft", 6, null], ["steam", 6, null], ["night city", 6, null]];

for(const [tag,module,rank] of decisions)test(`diverse reviewed placement L${module}: ${tag}`,()=>{
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.2)`]){
  assert.equal(scoreLine(text).module,module,text);
  if(module===3)assert.equal(characterOrderRank(tag),rank);
  if(module===4)assert.equal(outfitOrderRank(tag),rank);
  const raw=`1girl, ${text}, black hair, blue eyes, boots, looking up, trigger_693,`,result=planAutoFix(raw);
  assert.equal(result.supported,true);verifyPreservation(raw,result);assert.ok(result.sections[module-1].tags.includes(text));assert.deepEqual(result.sections[6].tags,['trigger_693']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
 }
});
for(const tag of ['hikimayu','hikimayu eyebrows','dot eyebrows','maro eyebrows'])test(`special eyebrow appearance: ${tag}`,()=>{
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.3)`]){
  assert.equal(scoreLine(text).module,3);assert.equal(characterOrderRank(tag),30);
  const raw=`1girl, ${text}, boots, green eyes, black hair, raised eyebrows, looking up,`,result=planAutoFix(raw);
  assert.equal(result.supported,true);verifyPreservation(raw,result);assert.deepEqual(result.sections[2].tags,text.startsWith('(')?['1girl',text,'black hair','green eyes']:['1girl','black hair','green eyes',text]);assert.deepEqual(result.sections[4].tags,['looking up','raised eyebrows']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
 }
});
test('special eyebrow names do not swallow actions, clothing, trigger suffixes or mixed groups',()=>{
 for(const tag of ['hikimayu style trigger','maro eyebrows trigger','holding dot eyebrows','dot eyebrow piercing'])assert.notEqual(scoreLine(tag).module,3,tag);
 assert.equal(scoreLine('dot eyebrows print shirt').module,4);
 const raw='1girl, (hikimayu, raised eyebrows:1.2),';assert.equal(planAutoFix(raw).supported,false);
 const manual=previewOrganization(raw,{confirmedSolo:true,placements:{1:5}});assert.equal(manual.supported,true);verifyPreservation(raw,manual);assert.deepEqual(manual.sections[4].tags,['(hikimayu, raised eyebrows:1.2)']);
});
test('special eyebrows and new descriptors retain scoped duplicates, BREAK and region ownership',()=>{
 const raw='masterpiece, steam, steam,\n---\n1girl, hikimayu, hikimayu,\nBREAK\npilot suit,\n---\n1boy, dot eyebrows, holding wrench, wrench,';
 const result=planAutoFix(raw,null,coupleContext('first'));assert.equal(result.supported,true);verifyPreservation(raw,result);assert.ok(result.proposed.startsWith('masterpiece, steam, steam,\n---\n'));assert.equal(result.duplicates.filter(x=>x.removed).length,1);assert.equal(planAutoFix(result.proposed,organizedLineAssignments(result),coupleContext('first')).proposed,result.proposed);
});
test('unresolved ownership, fused syntax, prose and triggers are not silently repaired',()=>{
 for(const tag of ['robot','mecha','giant robot','seagull','frieren','lazypos','dessert','prey bulge 1girl','sharp focus 1girl','headphones nude','mechanical arm MechaArtworkStyle','dirty','wet','gears'])assert.equal(scoreLine(tag).module,null,tag);
 for(const raw of ['elf, dot eyebrows,','1female, pilot suit,','2girls, hikimayu,','sharp focus 1girl, dot eyebrows,']){const result=planAutoFix(raw);assert.equal(result.supported,false);assert.equal(result.proposed,null);assert.equal(result.source,raw);}
 const raw='1girl, (wrench, unknown_trigger_693:1.2),';assert.equal(planAutoFix(raw).supported,false);
});
test('new outfit state and tool ranks fit before/after existing clothing without changing gaze order',()=>{
 const result=planAutoFix('1girl, wrench, boots, pilot suit, goggles on headwear, dirty clothes, smiling, looking at viewer, flirty,');assert.equal(result.supported,true);
 assert.deepEqual(result.sections[3].tags,['dirty clothes','goggles on headwear','pilot suit','boots','wrench']);assert.deepEqual(result.sections[4].tags,['looking at viewer','smiling','flirty']);
});
for(let i=0;i<10;i++)test(`diverse mixed prompt permutation ${i}`,()=>{
 const all=decisions.filter((_,n)=>n%3===i%3).map(x=>x[0]),tags=[...all.slice(i),...all.slice(0,i)];
 const raw=['1boy','solo',...tags,'hikimayu','trigger_693'].join(', ')+',';const result=planAutoFix(raw);assert.equal(result.supported,true);verifyPreservation(raw,result);assert.equal(result.sections[2].tags[0],'1boy');assert.equal(result.sections[2].tags[1],'solo');assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
});
