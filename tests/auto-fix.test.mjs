import test from 'node:test';
import assert from 'node:assert/strict';
import {planAutoFix, organizedLineAssignments} from '../javascript/mdpf-line-organization.mjs';
import {attachOrganization} from '../javascript/mdpf-organize-view.mjs';
import {tokenize} from '../javascript/mdpf-core.mjs';

const valid = [
    'smile, 1girl, masterpiece, standing, blue hair, blue dress, beach, anime style,',
    '1boy, solo, green hair, muscular male, black shirt, sitting, serious, castle, best quality,',
    '1other, solo, white hair, red dress, looking at viewer, forest, masterpiece,',
    '1girl, (blue hair:1.2), blue dress, smile, beach, (masterpiece:1.1),',
    '1girl, mystery_trigger_88, <lora:example:0.7>, blue dress, smile,',
    '1girl, masterpiece, masterpiece, blue dress, blue dress, smile,',
    '1girl, (blue dress:1.2), (blue dress:1.2), smile,',
    '1girl, tired eyes, blue turtleneck, black raincoat, white cloak,',
];
for(const [index,source] of valid.entries()) for(const eol of ['\n','\r\n','\r']) {
    test(`Auto Fix valid solo ${index+1} ${JSON.stringify(eol)} preserves opaque tokens and is stable`,()=>{
        const input=source.replaceAll(', ',','+eol), result=planAutoFix(input);
        assert.equal(result.supported,true,JSON.stringify(result.review));
        const original=tokenize(input).tokens.map(token=>token.text.trim()).filter(Boolean);
        const expected=[...original];
        for(const entry of result.duplicates.filter(entry=>entry.removed))expected.splice(expected.lastIndexOf(entry.text),1);
        assert.deepEqual(tokenize(result.proposed).tokens.map(token=>token.text.trim()).filter(Boolean).sort(),expected.sort());
        assert.equal(planAutoFix(result.proposed,organizedLineAssignments(result)).proposed,result.proposed);
    });
}
const blocked=[
    '', 'masterpiece, blue dress,', '1girl, 1boy, smile,', '2girls, smile,',
    '1girl, 1girl, smile,', '(1girl:1.2), blue dress,', '1girl, crowd, smile,',
    '1girl, medieval, smile,', '1girl, perspective, blue dress,',
    '1girl, (blue hair, smile),', '1girl, <hypernet:test:1>,', '1girl, <lora:broken,',
    '1girl, [smile:sad:0.5],', '1girl, __outfit__,', '1girl, # comment',
    '1girl, blue dress,\nBREAK\nsmile,', '1girl, blue dress, ---\nsmile,',
    '1girl, blue dress BREAK smile,', '1girl,,blue dress,', '1girl, Negative prompt: bad,',
    '1girl, '+Array(201).fill('blue dress').join(', '), '1girl, '+ 'x'.repeat(20001),
];
for(const [index,source] of blocked.entries())test(`Auto Fix blocked ${index+1} returns no partial proposal`,()=>{
    const result=planAutoFix(source);assert.equal(result.supported,false);assert.equal(result.proposed,null);assert.equal(result.source,source);
});
const labels=(source,text,module)=>({source,rows:[{start:source.indexOf(text),end:source.indexOf(text)+text.length,text,module,manual:true}]});
test('manual labels resolve accessories without learning and cannot move counts or unverified LoRAs',()=>{
    const source='1girl,\nglasses,\nblue dress,';
    assert.equal(planAutoFix(source).supported,true);
    const state=labels(source,'glasses,',3),before=structuredClone(state);
    assert.equal(planAutoFix(source,state).supported,true);assert.deepEqual(state,before);
    assert.equal(planAutoFix(source,labels(source,'1girl,',4)).supported,false);
    assert.equal(planAutoFix(source,{...state,source:'stale'}).supported,false);
    assert.equal(planAutoFix(source,labels(source,'glasses,',null)).supported,false);
    const reference='1girl,\n<lora:example:1>,\nblue dress,';
    assert.equal(planAutoFix(reference,labels(reference,'<lora:example:1>,',3)).supported,false);
});
test('enabled Couple is blocked even with an apparently solo count and no delimiters',()=>{
    assert.equal(planAutoFix(valid[0],null,{coupleEnabled:true}).supported,false);
});

class Element {
    constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.value='';}
    append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}
    setAttribute(key,value){(this.attributes??={})[key]=value;}
    addEventListener(type,fn){(this.handlers[type]??=new Set()).add(fn);}removeEventListener(type,fn){this.handlers[type]?.delete(fn);}
    dispatchEvent(event){for(const fn of this.handlers[event.type]??[])fn(event);}fire(type){this.dispatchEvent({type});}remove(){}
}
const flatten=node=>[node,...(node.children??[]).flatMap(flatten)];
test('controller applies immediately without confirmation, discloses duplicates, shares exact guarded Revert and never reuses review choices',()=>{
    const old=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
    try{
        const source='1girl,\nglasses,\nblue dress, blue dress,\nsmile,', native=new Element('textarea');native.value=source;
        let state=labels(source,'glasses,',3);const original=structuredClone(state);
        const view=attachOrganization(native,new Element('div'),{getLineAssignments:()=>state.source===native.value?state:{source:native.value,rows:[]},setLineAssignments:next=>{state=next;return true;}});
        const expected=planAutoFix(source,state).proposed;
        assert.equal(view.autoFix().applied,true);assert.equal(native.value,expected);
        assert.match(view.panel.children[4].textContent,/1 exact duplicate/);assert.equal(view.getAutoFixState().canRevert,true);
        assert.equal(view.autoFix().applied,false);assert.equal(view.getAutoFixState().canRevert,true,'no-op retains original undo');
        native.fire('compositionstart');assert.equal(view.autoFix().applied,false);assert.equal(view.revertAutoFix(),false);native.fire('compositionend');
        assert.equal(view.revertAutoFix(),true);assert.equal(native.value,source);assert.deepEqual(state,original);
        assert.equal(view.autoFix().applied,true);native.value+='new text';native.fire('input');assert.equal(view.revertAutoFix(),false);assert.ok(native.value.endsWith('new text'));
        native.value='1girl, medieval, blue dress,';native.fire('input');
        const confirm=view.panel.children[2].children[0];confirm.checked=true;confirm.fire('change');
        flatten(view.panel).find(n=>n.textContent==='Preview organization').fire('click');
        const destination=flatten(view.panel).find(n=>n.attributes?.['aria-label']==='Destination for item 2');destination.value='3';destination.fire('change');
        assert.equal(view.autoFix().applied,false,'unapplied review-panel choices are not consent for Auto Fix');
        const scope=flatten(view.panel).find(n=>n.attributes?.['aria-label']==='Organization scope');scope.value='regional';scope.fire('change');
        native.value=valid[0];native.fire('input');assert.equal(view.autoFix().applied,false);
        view.destroy();assert.equal(native.handlers.input.size,0);
    }finally{globalThis.document=old;}
});
test('Auto Fix refuses a source change during planning before any write',()=>{
    const old=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
    try{
        const native=new Element('textarea');native.value=valid[0];let reads=0;
        const view=attachOrganization(native,new Element('div'),{getLineAssignments:()=>{if(++reads===3)native.value='external prompt';return null;}});
        assert.equal(view.autoFix().applied,false);assert.equal(native.value,'external prompt');view.destroy();
    }finally{globalThis.document=old;}
});
