export const coupleContext = (shared = 'first', overrides = {}) => ({couple:{state:'enabled',mode:'Basic',separator:'---',globalPosition:shared,tileEnabled:false,commonSyntax:'{ }',...overrides}});
export function coupleSample(count=2,shared='first',withBreak=false,eol='\n',padded=false){
 const global=`  newest, action, ${count}girls, <lora:shared_placeholder:0.5>,${eol}shared_unclassified_82,  `;
 const chunks=Array.from({length:count},(_,index)=>{
  const identity=index%2?'1boy':'1girl',hair=index%2?'red hair':'blue hair',expression=index%2?'angry':'smile';
  const first=`${identity}, newest, ${hair}, black dress, black dress, ${expression}, standing, <lora:region_${index}:0.7>, trigger_${index},`;
  return withBreak?first+eol+'BREAK'+eol+`black dress, black dress, ${expression}, forest,`:first;
 });
 if(shared==='first')chunks.unshift(global);if(shared==='last')chunks.push(global);
 return {source:chunks.join(eol+(padded?' \t--- \t':'---')+eol),global,context:coupleContext(shared),count,shared,withBreak,eol,padded};
}
