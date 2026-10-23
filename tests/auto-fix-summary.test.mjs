import test from 'node:test';
import assert from 'node:assert/strict';
import {attachOrganization,buildAutoFixAudit} from '../javascript/mdpf-organize-view.mjs';
import {attachAutoFixSummary} from '../javascript/mdpf-inline.mjs';
import {planAutoFix} from '../javascript/mdpf-line-organization.mjs';
import {coupleContext} from './helpers/couple-auto-fix.mjs';

class Element {
 constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.attributes={};this.value='';this.hidden=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(type,fn){(this.handlers[type]??=new Set()).add(fn);}removeEventListener(type,fn){this.handlers[type]?.delete(fn);}
 dispatchEvent(event){for(const fn of this.handlers[event.type]??[])fn(event);}fire(type){this.dispatchEvent({type});}remove(){}
}
function withDOM(run){const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};try{return run();}finally{globalThis.document=previous;}}
const source='smile, blue hair, solo, 1girl, gold bracelet, gold bracelet, mystery_1, mystery_1, <lora:test:0.7>, anime style,';
const controls=view=>{const [row,details]=view.element.children;const [status,expand,review,revert]=row.children;return {status,expand,review,revert,details};};

test('receipt counts retained items and actual removed repeats; references and hints are not unknown tags',()=>{
 const result=planAutoFix(source),before=JSON.stringify(result),audit=buildAutoFixAudit(result,'applied','done');
 assert.deepEqual([audit.organized,audit.removed,audit.unknown],[8,2,1]);
 assert.match(audit.summary,/Organized 8 items.*Removed 2 duplicates.*1 unknown → L7/);
 assert.match(audit.details,/gold bracelet → L4/);assert.match(audit.details,/Removed: mystery_1/);
 assert.match(audit.details,/<lora:test:0.7> → L7/);assert.match(audit.details,/Possible triggers are not identified/);
 assert.equal(JSON.stringify(result),before);
});
test('blocked receipt reports all blockers and only planned removal, with no success counts',()=>{
 const result=planAutoFix('1girl, medieval, mystery_1, mystery_1, perspective,'),audit=buildAutoFixAudit(result,'blocked','Review needed.');
 assert.equal(result.supported,false);assert.equal(audit.organized,0);assert.equal(audit.removed,0);
 assert.match(audit.details,/medieval/);assert.match(audit.details,/perspective/);assert.match(audit.details,/Tentative L2/);
 assert.match(audit.details,/Would remove: mystery_1/);assert.match(audit.details,/Removed exact duplicates: 0/);
});
for(const count of [2,4,8])test(`regional receipt scopes duplicate and unknown occurrences to ${count} owners`,()=>{
 const text='shared_unknown_55,\n---\n'+Array.from({length:count},()=>
  '1girl, black dress, black dress, mystery_2,\nBREAK\nmystery_2, smile,').join('\n---\n');
 const result=planAutoFix(text,null,coupleContext('first')),audit=buildAutoFixAudit(result,'applied','done');
 assert.equal(result.supported,true);assert.equal(audit.removed,count);assert.equal(audit.unknown,count*2);
 assert.match(audit.details,new RegExp(`${count} character regions; shared first unchanged`));
 assert.match(audit.details,/Chunk/);assert.ok(!audit.details.includes('shared_unknown_55'));
});
test('summary starts hidden, expands read-only text, opens review and restores exact source',()=>withDOM(()=>{
 const native=new Element('textarea');native.value=source;
 const organization=attachOrganization(native,new Element('div'));
 const view=attachAutoFixSummary(native,'txt2img',{getAutoFixState:()=>organization.getAutoFixState(),onRevertAutoFix:()=>organization.revertAutoFix(),onOpenReview:()=>organization.openReview()});
 const c=controls(view);assert.equal(view.element.hidden,true);assert.equal(native.value,source);
 view.show(organization.autoFix());assert.equal(view.element.hidden,false);assert.match(c.status.textContent,/Organized 8 items/);
 assert.equal(c.details.hidden,true);assert.equal(c.revert.hidden,false);assert.equal(c.review.hidden,true);
 const after=native.value;c.expand.fire('click');assert.equal(c.details.hidden,false);assert.equal(c.expand.attributes['aria-expanded'],'true');assert.equal(native.value,after);
 const receipt=c.status.textContent;view.show(organization.autoFix());assert.equal(c.status.textContent,receipt,'No-op preserves previous applied audit/undo');
 c.revert.fire('click');assert.equal(native.value,source);assert.equal(c.revert.hidden,true);assert.match(c.status.textContent,/Restored the exact prompt/);
 native.value='1girl, medieval,';native.fire('input');view.show(organization.autoFix());
 assert.equal(c.review.hidden,false);assert.match(c.status.textContent,/unchanged/);c.review.fire('click');
 assert.match(organization.panel.children[5].textContent,/medieval/);assert.equal(organization.panel.children[6].hidden,true,'Blocked attempt must not present the previous comparison as its current proposal');
 assert.equal(organization.panel.open,true);assert.equal(native.value,'1girl, medieval,','Opening review must not apply or replace a prompt');organization.destroy();
}));
test('typing/programmatic edits mark receipts historical and disable Revert without writes or preview reuse',()=>withDOM(()=>{
 const native=new Element('textarea');native.value=source;const organization=attachOrganization(native,new Element('div'));
 const view=attachAutoFixSummary(native,'txt2img',{getAutoFixState:()=>organization.getAutoFixState(),onRevertAutoFix:()=>organization.revertAutoFix()});
 view.show(organization.autoFix());const c=controls(view);native.value+=' edited';const edited=native.value;view.observe();
 assert.match(c.status.textContent,/Earlier Auto Fix result/);assert.match(c.details.textContent,/Historical result/);assert.equal(c.revert.hidden,true);assert.equal(native.value,edited);
 c.revert.fire('click');assert.equal(native.value,edited);assert.match(c.status.textContent,/Revert unavailable/);organization.destroy();
}));
test('composition, unsupported settings and missing counts produce visible blocked receipts',()=>withDOM(()=>{
 const native=new Element('textarea');native.value=source;const organization=attachOrganization(native,new Element('div'));
 const view=attachAutoFixSummary(native,'txt2img',{getAutoFixState:()=>organization.getAutoFixState(),onOpenReview:()=>organization.openReview()});
 const c=controls(view);native.fire('compositionstart');view.show(organization.autoFix());
 assert.match(c.status.textContent,/Finish composing/);assert.match(c.details.textContent,/Finish composing/);assert.equal(c.review.hidden,false);assert.equal(native.value,source);
 native.fire('compositionend');native.value='blue hair, solo,';view.show(organization.autoFix());assert.match(c.status.textContent,/count|1girl|1boy|1other/i);
 native.value=source;view.show(organization.autoFix(coupleContext('first',{mode:'Mask'})));assert.match(c.status.textContent,/Basic|Mask/);organization.destroy();
}));
test('host instances have independent receipts and accessible controls; injected-looking text stays literal',()=>withDOM(()=>{
 const a=new Element('textarea'),b=new Element('textarea');a.value=b.value=source;
 const left=attachAutoFixSummary(a,'txt2img'),right=attachAutoFixSummary(b,'img2img');
 const audit={state:'applied',summary:'Organized 1 item',details:'<img src=x onerror=alert(1)> → L7'};
 left.show({applied:true,audit});const x=controls(left),y=controls(right);
 assert.equal(right.element.hidden,true);assert.equal(x.details.textContent,audit.details);assert.equal(x.details.children.length,0);
 assert.equal(x.details.tag,'pre');assert.notEqual(x.details.id,y.details.id);
 assert.equal(x.expand.attributes['aria-controls'],x.details.id);assert.equal(x.status.attributes['aria-live'],'polite');
 assert.equal(x.details.attributes.tabindex,'0');assert.equal(x.expand.type,'button');assert.equal(a.value,source);assert.equal(b.value,source);
}));
