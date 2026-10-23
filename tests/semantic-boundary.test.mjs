import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLine,SCORING_POLICY} from '../javascript/mdpf-classifier.mjs';
import {planAutoFix,organizedLineAssignments} from '../javascript/mdpf-line-organization.mjs';
import {previewOrganization,previewCharacterOrganization,outfitOrderRank} from '../javascript/mdpf-organize.mjs';
import {coupleContext} from './helpers/couple-auto-fix.mjs';
import {verifyPreservation,materialize} from './helpers/extensive-organization.mjs';

const known=[
 ...['hands in hair','hands on own hair','hand through hair','raising hand to hair','pulling eyelashes','brushing eyebrows'].map(tag=>[tag,2]),
 ...['closing eyes','opening eyes','rolled eyes','winking eyes','looking through hair','looking through bangs'].map(tag=>[tag,5]),
 ...['fake hair','wig','long wig','red wig','covered hair'].map(tag=>[tag,4]),
 ...['stroking','patting','playing with','running fingers through','cutting','shaving','tugging','kissing'].flatMap(verb=>['hair','own hair',"another's long hair",'short red hair'].map(target=>[`${verb} ${target}`,2])),
 ...['carrying','washing','sewing','folding'].flatMap(verb=>['hat','own red shirt',"another's white blouse",'long black dress'].map(target=>[`${verb} ${target}`,2])),
 ...['looking at','looking up at','looking down at','looking away from'].flatMap(verb=>['red dress','blue eyes','black hair','medieval castle','white hat','forest'].map(target=>[`${verb} ${target}`,5])),
];
const retained=[
 [2,['brushing hair','rubbing eyes','covering eyes','claw pose','paw pose','rabbit pose','holding flowers','smelling flowers','holding chair','holding umbrella']],
 [3,['cat ears','fox ears','rabbit ears','horns','demon horns','tail','cat tail','fox tail','wings','claws','black nails','blue eyes','short messy black hair','wet hair','wind swept hair','snow-covered hair','flower-covered hair','hikimayu','dot eyebrows','arched eyebrows']],
 [4,['fake cat ears','fake fox ears','fake rabbit ears','fake horns','energy horns','horned helmet','fake tail','fake cat tail','fake fox tail','fake wings','energy wings','fake claws','flower hair ornament','flower on head','leaf on head','leaf print','leaf bikini','flower crown','red umbrella','covered eyes','petal print dress','forest print dress','castle hat','snow-covered hat']],
 [5,['closed eyes','half-closed eyes','rolling eyes','raised eyebrows','raising eyebrows','furrowed eyebrows','clenched teeth','licking lips']],
 [6,['flower','leaf','vines','red flower','falling petals','wooden chair','snow-covered forest','castle in forest','medieval castle']],
].flatMap(([module,tags])=>tags.map(tag=>[tag,module]));
const compoundReview=['blowing hair','painting hair','painting black eyes','holding red eyes','holding unknown hair','stroking zebra hair','fake blue hair','carrying unusual dress','holding unusual hat','washing strange shirt','dress in forest','hat in forest','shirt in forest','holding hat in forest','girl holding chair in bedroom','woman wearing hat on beach'];
const printed=['brushing hair print dress','holding hat print shirt','holding forest print dress','holding chair print dress','closing eyes print shirt','looking at blue eyes print dress','fake hair print hat','flower-covered forest print cape'];
for(const [tag,module] of [...known,...retained])test(`boundary destination L${module}: ${tag}`,()=>{
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.2)`]){
  assert.equal(scoreLine(text).module,module,text);
  const source=`1girl, ${text}, boots, green eyes, black hair, trigger_709,`,result=planAutoFix(source);
  assert.equal(result.supported,true,result.issues.join('\n'));verifyPreservation(source,result);assert.ok(result.sections[module-1].tags.includes(text));assert.deepEqual(result.sections[6].tags,['trigger_709']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
 }
});
for(const tag of compoundReview)test(`unresolved compound requires review: ${tag}`,()=>{
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.2)`]){
  const score=scoreLine(text);assert.equal(score.module,null);assert.equal(score.status,'uncertain');
  const source=`1girl, ${text}, boots,`,result=planAutoFix(source);assert.equal(result.supported,false);assert.equal(result.proposed,null);assert.equal(result.source,source);assert.ok(result.review.some(x=>x.text===text));
  const manual=previewOrganization(source,{confirmedSolo:true,placements:{1:4}});assert.equal(manual.supported,true);verifyPreservation(source,manual);assert.ok(manual.sections[3].tags.includes(text));
 }
});
for(const tag of printed)test(`explicit print garment remains L4: ${tag}`,()=>{
 const result=planAutoFix(`1girl, ${tag}, green eyes,`);assert.equal(result.supported,true);assert.equal(scoreLine(tag).module,4);assert.deepEqual(result.sections[3].tags,[tag]);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
});
for(let seed=0;seed<32;seed++)test(`mixed solo semantic boundary prompt ${seed}`,()=>{
 const pool=[...known,...retained].filter((_,index)=>index%8===seed%8),tags=[...pool.slice(seed%pool.length),...pool.slice(0,seed%pool.length)].map(x=>x[0]);
 const raw=['1boy','solo',...tags,'boundary_trigger_709'].join(', ')+',';const result=planAutoFix(raw);assert.equal(result.supported,true);verifyPreservation(raw,result);
 for(const [tag,module] of pool)assert.ok(result.sections[module-1].tags.includes(tag),tag);
 assert.equal(result.sections[2].tags[0],'1boy');assert.equal(result.sections[2].tags[1],'solo');assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
});
for(const count of [2,3,4,6])for(const shared of ['first','last','none'])for(const withBreak of [false,true])for(const eol of ['\n','\r\n'])test(`regional semantics ${count}/${shared}/BREAK ${withBreak}/${JSON.stringify(eol)}`,()=>{
 const global=`masterpiece, ${count}girls, flower, flower, shared_trigger_709,`,parts=Array.from({length:count},(_,i)=>{
  const first=`1girl, cat ears, stroking own hair, energy horns, dot eyebrows, boots, boots, owner_${i}_709,`;
  return first+(withBreak?eol+'BREAK'+eol+'looking at red dress, closing eyes, boots, flower,':' looking at red dress, closing eyes, flower,');
 });
 if(shared==='first')parts.unshift(global);if(shared==='last')parts.push(global);
 const raw=parts.join(eol+'---'+eol),context=coupleContext(shared),result=planAutoFix(raw,null,context);assert.equal(result.supported,true,result.issues.join('\n'));verifyPreservation(raw,result);assert.equal(result.ownerCount,count);
 assert.equal(result.duplicates.filter(x=>x.removed).length,count);
 const regions=result.regions.filter(x=>!x.shared);assert.equal(new Set(regions.map(x=>x.parentIndex)).size,count);
 for(let i=0;i<count;i++){
  const own=regions.filter(x=>x.parentIndex===(shared==='first'?i+1:i));const tokens=own.flatMap(x=>x.result.items);
  for(let j=0;j<count;j++)assert.equal(tokens.some(x=>x.text===`owner_${j}_709`),i===j);
  for(const [tag,module] of [['cat ears',3],['stroking own hair',2],['energy horns',4],['dot eyebrows',3],['looking at red dress',5],['closing eyes',5],['flower',6]])assert.ok(tokens.some(x=>x.text===tag&&x.module===module),tag);
 }
 if(shared!=='none')assert.ok(result.regions.find(x=>x.shared).text.includes(global));
 assert.equal(planAutoFix(result.proposed,organizedLineAssignments(result),context).proposed,result.proposed);
});
for(const count of [2,3,4,6])test(`explicit non-Couple character ranges preserve ${count} owners`,()=>{
 const chunks=Array.from({length:count},(_,i)=>[{text:i%2?'1boy':'1girl',module:3},{text:'cat ears',module:3},{text:'fake fox tail',module:4},{text:'stroking hair',module:2},{text:'looking at red dress',module:5},{text:`owner_${i}_709`,module:7}]);
 const guarded=materialize({mode:'characters',chunks,spaced:true});assert.equal(previewCharacterOrganization(guarded.source,guarded.options).supported,false,'Non-Couple character ranges deliberately exclude L1/L2');
 const sample=materialize({mode:'characters',chunks:chunks.map(chunk=>chunk.filter(x=>x.module!==2)),spaced:true});const result=previewCharacterOrganization(sample.source,sample.options);assert.equal(result.supported,true,result.issues.join('\n'));verifyPreservation(sample.source,result);
 const own=result.regions.filter(x=>!x.shared);assert.equal(own.length,count);
 for(let i=0;i<count;i++)for(let j=0;j<count;j++)assert.equal(own[i].result.items.some(x=>x.text===`owner_${j}_709`),i===j);
});
test('mixed opaque groups, manual labels, unknowns and count guards retain conservative behavior',()=>{
 const source='1girl, (stroking hair, blue hair:1.3), boots,';assert.equal(planAutoFix(source).supported,false);
 const reviewed=previewOrganization(source,{confirmedSolo:true,placements:{1:2}});assert.equal(reviewed.supported,true);verifyPreservation(source,reviewed);assert.deepEqual(reviewed.sections[1].tags,['(stroking hair, blue hair:1.3)']);
 const rowSource='1girl,\nstroking hair,\nboots,',start=rowSource.indexOf('stroking');const state={source:rowSource,rows:[{start,end:start+'stroking hair,'.length,text:'stroking hair,',module:3,manual:true}]};
 const result=planAutoFix(rowSource,state);assert.equal(result.supported,true);assert.ok(result.sections[2].tags.includes('stroking hair'));
 for(const text of ['2girls, stroking hair,','closing eyes, wig,','1female, carrying hat,']){const result=planAutoFix(text);assert.equal(result.supported,false);assert.equal(result.proposed,null);}
 for(const tag of ['unresolved_709','style_holding_hat_trigger','feathered wings','vine bracelet','umbrella on ground','hair ornament on ground'])assert.equal(scoreLine(tag).module,null);
 for(const tag of ['fake hair','wig','long wig','red wig','covered hair'])assert.equal(outfitOrderRank(tag),10);
 assert.deepEqual(SCORING_POLICY,{minScore:4,minCoverage:.4,minShare:.7,minMargin:3,mixedShare:.3,mixedScore:4});
});
