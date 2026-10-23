import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLine} from '../javascript/mdpf-classifier.mjs';
import {planAutoFix,organizedLineAssignments} from '../javascript/mdpf-line-organization.mjs';
import {previewOrganization,characterOrderRank,outfitOrderRank} from '../javascript/mdpf-organize.mjs';
import {coupleContext} from './helpers/couple-auto-fix.mjs';
import {verifyPreservation} from './helpers/extensive-organization.mjs';
const decisions=[[1, ["high detail", "perfect anatomy", "detailed face", "ultra detailed face", "dynamic lighting", "dynamic shadows", "lens flare"]], [2, ["bokeh", "sharp focus", "side view", "three quarter view", "heart hands", "holding coffee", "hands on own knees", "outstretched arm", "contrapposto"]], [3, ["thick eyebrows", "ear tuft", "flesh whiskers", "barbel (anatomy)", "dragon girl", "eastern dragon", "cyborg", "mechanical arms", "fox nose", "open forehead", "side swept bangs", "tanlines", "bikini tan", "lipgloss", "ginger fur", "cyan fur"]], [4, ["yukata", "eyewear on head", "hat flower", "white headwear", "food-themed hair ornament", "carrot hair ornament", "coat on shoulders", "fur-trimmed capelet", "black t-shirt", "rocket launcher", "grenade launcher", "rpg (weapon)", "head-mounted display", "visor", "coffee mug", "neckline"]], [5, ["soft smile", "big smile", "silly grin", "cute smile"]], [6, ["onsen", "coffee shop", "daytime", "sunbeams", "weeds", "glade", "island", "jungle", "waterfalls", "cavern", "cave interior", "christmas tree", "love hotel", "speed lines background", "street view", "light particles", "white walls", "heart shaped bed", "pink sheets"]]];
for(const [module,tags] of decisions)for(const tag of tags)test(`monthly reviewed gap L${module}: ${tag}`,()=>{
 for(const text of [tag,tag.toUpperCase(),tag.replaceAll(' ','_'),`(${tag}:1.2)`]){
  assert.equal(scoreLine(text).module,module,text);
  const source=`1girl, ${text}, boots, looking up, trigger_749,`,result=planAutoFix(source);assert.equal(result.supported,true);verifyPreservation(source,result);
  assert.ok(result.sections[module-1].tags.includes(text));assert.deepEqual(result.sections[6].tags,['trigger_749']);assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
 }
});
const cosmetics={'makeup':30,'eyeshadow':31,'eyeliner':31,'lipstick':34,'lipgloss':34,'lips':34,'nail polish':51};
for(const [noun,rank] of Object.entries(cosmetics))test(`bounded cosmetics and source-preserving order: ${noun}`,()=>{
 for(const prefix of ['black','gold','black matte','black smudged','light pink','bright red','dark glossy purple']){
  const text=prefix+' '+noun;assert.equal(scoreLine(text).module,3,text);assert.equal(characterOrderRank(text),rank,text);
  const raw='1girl, '+text+', boots, looking up,';const fixed=planAutoFix(raw);assert.equal(fixed.supported,true);verifyPreservation(raw,fixed);assert.equal(planAutoFix(fixed.proposed).proposed,fixed.proposed);
  assert.equal(scoreLine(text+' print dress').module,4);
  for(const phrase of ['unknown '+text+' trigger','applying '+text,'holding '+text])assert.notEqual(scoreLine(phrase).module,3,phrase);
 }
});
test('partial weighted known accessory groups require review; no inferred association',()=>{
 const raw='1girl, (visor, holographic interface:1.3), white dress,';const fixed=planAutoFix(raw);assert.equal(fixed.supported,false);assert.equal(fixed.proposed,null);assert.equal(fixed.source,raw);
 const reviewed=previewOrganization(raw,{confirmedSolo:true,placements:{1:4}});assert.equal(reviewed.supported,true);verifyPreservation(raw,reviewed);assert.ok(reviewed.sections[3].tags.includes('(visor, holographic interface:1.3)'));
});
test('fern retains vegetation default; an explicit character choice takes priority',()=>{
 assert.equal(scoreLine('fern').module,6);const raw='1girl, fern, green eyes,';const reviewed=previewOrganization(raw,{confirmedSolo:true,placements:{1:3}});assert.equal(reviewed.supported,true);assert.deepEqual(reviewed.sections[2].tags,['1girl','fern','green eyes']);verifyPreservation(raw,reviewed);
});
test('source aliases, unknown triggers and missing ownership do not gain fabricated tags',()=>{
 for(const tag of ['lazypos','face socus','siting on chair','blum effect','Han Juri','happy face soft anime lighting','source_anime','gift box','holographic interface'])assert.equal(scoreLine(tag).module,null,tag);
 for(const raw of ['onsen, lens flare, yukata,','2girls, visor,','1female, yukata,','1girl solo: ((human:1.9)),']){const fixed=planAutoFix(raw);assert.equal(fixed.supported,false);assert.equal(fixed.proposed,null);}
 assert.equal(outfitOrderRank('yukata'),40);assert.equal(outfitOrderRank('rocket launcher'),100);
 const gaze=planAutoFix('1girl, soft smile, cute smile, looking at viewer, silly grin,');assert.deepEqual(gaze.sections[4].tags,['looking at viewer','soft smile','cute smile','silly grin']);
});
for(let i=0;i<10;i++)test(`monthly mixed prompt placement ${i}`,()=>{
 const tags=['1boy','solo',...decisions.flatMap(([,tags])=>tags.filter((_,n)=>n%4===i%4)),'black matte lipstick','trigger_749'];const raw=['1boy','solo',...[...tags.slice(i),...tags.slice(0,i)].filter(tag=>!['1boy','solo'].includes(tag))].map(tag=>tag.replaceAll('(', '\\(').replaceAll(')', '\\)')).join(', ')+',';
 const result=planAutoFix(raw);assert.equal(result.supported,true);verifyPreservation(raw,result);assert.equal(result.sections[2].tags[0],'1boy');assert.equal(result.sections[2].tags[1],'solo');assert.equal(planAutoFix(result.proposed).proposed,result.proposed);
});
test('monthly placements preserve regional ownership, shared text and BREAK',()=>{
 const raw='masterpiece, onsen, onsen,\n---\n1girl, yukata, yukata,\nBREAK\nblack eyeshadow,\n---\n1boy, visor, coffee shop,';
 const result=planAutoFix(raw,null,coupleContext('first'));assert.equal(result.supported,true);verifyPreservation(raw,result);assert.ok(result.proposed.startsWith('masterpiece, onsen, onsen,\n---\n'));assert.equal(result.duplicates.filter(x=>x.removed).length,1);assert.equal(planAutoFix(result.proposed,organizedLineAssignments(result),coupleContext('first')).proposed,result.proposed);
});
