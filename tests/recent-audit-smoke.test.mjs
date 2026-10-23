import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLine} from '../javascript/mdpf-classifier.mjs';
import {planAutoFix,organizedLineAssignments} from '../javascript/mdpf-line-organization.mjs';
import {previewOrganization,characterOrderRank,outfitOrderRank} from '../javascript/mdpf-organize.mjs';
import {coupleContext} from './helpers/couple-auto-fix.mjs';
import {verifyPreservation} from './helpers/extensive-organization.mjs';
const decisions=[[1,['extremely detailed','ultra-detailed','4k','perfect lighting']],[2,['dynamic angle']],[3,['anthro','male','masculine','detailed fur texture','body fur','fluffy fur','detailed fluffy fur','tuft of fur','obese','morbidly obese','huge butt','big belly','big nipples','shiny lips']],[4,['topless','teacher','cosplay','bloomers','footwear bow','breasts out','naked butt']],[5,['sideways mouth']],[6,['scenery','abstract background','heart background','rose background','neon lights']]];
for(const [module,tags] of decisions)for(const tag of tags)test(`reviewed recent gap L${module}: ${tag}`,()=>{
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.2)`]){
  assert.equal(scoreLine(text).module,module,text);
  const source=`1girl, ${text}, boots, looking up, roren,`,result=planAutoFix(source);assert.equal(result.supported,true);verifyPreservation(source,result);
  assert.ok(result.sections[module-1].tags.includes(text));assert.deepEqual(result.sections[6].tags,['roren']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
 }
});
for(const noun of ['fur','skin','horns','claws','paws'])test(`bounded natural appearance: ${noun}`,()=>{
 for(const color of ['pink','black','brown','gray','tan','dark red','light blue']){
  const text=color+' '+noun;assert.equal(scoreLine(text).module,3,text);assert.notEqual(characterOrderRank(text),null);
  assert.equal(scoreLine(text+' print dress').module,4);assert.equal(scoreLine('unknown '+text+' trigger').module,null);
 }
});
test('mixed weighted anatomy/outfit groups require review and remain intact',()=>{
 const raw='1girl, ((huge butt, naked butt)), boots,';const fixed=planAutoFix(raw);assert.equal(fixed.supported,false);assert.equal(fixed.proposed,null);assert.equal(fixed.source,raw);
});
test('natural body parts do not swallow outfit, pose or unknown phrases',()=>{
 for(const text of ['fake horns','energy horns','fur coat','fur collar'])assert.equal(scoreLine(text).module,4,text);
 for(const text of ['claw pose','holding hat'])assert.equal(scoreLine(text).module,2,text);
 for(const text of ['realistic','bara','magical girl','dynamic expression','pink fur style','holding pink fur','black fur trigger','EFIV1','P3ng01nd00','dynamic anglre'])assert.equal(scoreLine(text).module,null,text);
});
for(let seed=0;seed<12;seed++)test(`mixed prompt placement and idempotence ${seed}`,()=>{
 const tags=['1boy','solo',...decisions.flatMap(([,tags])=>tags.filter((_,i)=>i%3===seed%3)), 'pink fur','roren','<lora:sample:0.5>'];
 const source=[...tags.slice(seed%tags.length),...tags.slice(0,seed%tags.length)].join(', ')+',';
 const result=planAutoFix(source);assert.equal(result.supported,true);verifyPreservation(source,result);assert.equal(result.sections[2].tags[0],'1boy');assert.equal(result.sections[2].tags[1],'solo');
 assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
});
test('top-to-bottom ordering, explicit review and unchanged count guards',()=>{
 const source='1boy, huge butt, blue hair, big nipples, shiny lips, pink fur, big belly, anthro, obese, solo,';
 const result=planAutoFix(source);assert.equal(result.supported,true);assert.deepEqual(result.sections[2].tags,['1boy','solo','anthro','blue hair','shiny lips','pink fur','obese','big nipples','big belly','huge butt']);
 const outfit=planAutoFix('1girl, boots, bloomers, teacher, hat, topless, footwear bow,');assert.equal(outfit.supported,true);assert.equal(outfit.sections[3].tags[0],'topless');assert.equal(outfitOrderRank('teacher'),5);
 const reviewed=previewOrganization('1girl, scenery, teacher, pink fur, pink fur,',{confirmedSolo:true,placements:{1:7},keepDuplicates:[4]});assert.equal(reviewed.supported,true);verifyPreservation(reviewed.source,reviewed);assert.deepEqual(reviewed.sections[6].tags,['scenery']);
 for(const raw of ['teacher, topless, scenery,','2girls, teacher,','1female, teacher,','prefix 1girl, teacher,']){const fixed=planAutoFix(raw);assert.equal(fixed.supported,false);assert.equal(fixed.proposed,null);}
});
test('regional owner and BREAK boundaries retain duplicates only in their own scope',()=>{
 const source='masterpiece, scenery, scenery,\n---\n1girl, teacher, teacher, pink fur,\nBREAK\nheart background,\n---\n1boy, teacher, black fur,';
 const result=planAutoFix(source,null,coupleContext('first'));assert.equal(result.supported,true);verifyPreservation(source,result);assert.ok(result.proposed.startsWith('masterpiece, scenery, scenery,\n---\n'));
 assert.equal(result.duplicates.filter(x=>x.removed).length,1);assert.equal(planAutoFix(result.proposed,organizedLineAssignments(result),coupleContext('first')).proposed,result.proposed);
});
