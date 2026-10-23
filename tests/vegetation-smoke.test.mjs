import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLine} from '../javascript/mdpf-classifier.mjs';
import {planAutoFix} from '../javascript/mdpf-line-organization.mjs';
import {outfitOrderRank} from '../javascript/mdpf-organize.mjs';
import {verifyPreservation} from './helpers/extensive-organization.mjs';
const decisions=[[6,['flower','leaf','maple leaf','rose','cherry blossoms','vines','ivy','fern','moss','bamboo','red flowers']],[4,['leaf hair ornament','leaf on head','leaf print','leaf bikini','flower crown','energy wings','energy horns','fake wings','hair bell','jacket on shoulders','oil-paper umbrella']],[2,['holding flowers','picking a red rose','smelling flowers','walking away']],[3,['glossy lips','wings','horns']]];
for(const [module,tags] of decisions)for(const tag of tags)test(`vegetation/prop boundary L${module}: ${tag}`,()=>{
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.2)`]){
  assert.equal(scoreLine(text).module,module);
  const source=`1girl, ${text}, boots, looking up, roren,`,result=planAutoFix(source);assert.equal(result.supported,true);verifyPreservation(source,result);
  assert.ok(result.sections[module-1].tags.includes(text));assert.deepEqual(result.sections[6].tags,['roren']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
 }
});
test('vegetation count guard and bounded matching stay conservative',()=>{
 assert.equal(planAutoFix('flower, maple leaf, energy wings, roren,').supported,false);
 for(const tag of ['roren','leaf_trigger_383','energy wings style','flower power','unknown leaf token'])assert.equal(scoreLine(tag).module,null);
 assert.equal(outfitOrderRank('hair bell'),10);assert.equal(outfitOrderRank('jacket on shoulders'),40);assert.equal(outfitOrderRank('oil-paper umbrella'),100);
});
