import {catalog} from './catalog.js';
const MAX_STACK=32;
export function evaluate(expr,state){
  if(typeof expr==='number')return expr;
  if(!Array.isArray(expr))throw new Error('条件格式无效');
  const op=expr[0];
  if(op==='v')return state.variables[String(evaluate(expr[1],state))]||0;
  if(op==='s')return state.strings[String(expr[1])]||'';
  if(op==='string')return expr[1];
  // These APIs belong to the original map/minigame runtime. They are not emulated.
  if(op==='native')return 0;
  if(op==='unsupported')throw new Error('此场景包含未支持的条件，可从标题选择其他篇章');
  if(op==='!')return evaluate(expr[1],state)?0:1;
  if(op==='neg')return -evaluate(expr[1],state);
  if(op==='pos')return +evaluate(expr[1],state);
  if(op==='~')return ~evaluate(expr[1],state);
  if(op==='&&'){for(let i=1;i<expr.length;i++)if(!evaluate(expr[i],state))return 0;return 1;}
  if(op==='||'){for(let i=1;i<expr.length;i++)if(evaluate(expr[i],state))return 1;return 0;}
  const a=evaluate(expr[1],state),b=evaluate(expr[2],state);
  if(op==='+')return a+b;if(op==='-')return a-b;if(op==='*')return a*b;
  if(op==='/')return b?Math.trunc(a/b):0;if(op==='%')return b?a%b:0;
  if(op==='&')return a&b;if(op==='|')return a|b;if(op==='^')return a^b;
  if(op==='<<')return a<<b;if(op==='>>')return a>>b;
  if(op==='==')return a===b?1:0;if(op==='!=')return a!==b?1:0;
  if(op==='<')return a<b?1:0;if(op==='<=')return a<=b?1:0;if(op==='>')return a>b?1:0;if(op==='>=')return a>=b?1:0;
  throw new Error('条件操作无效');
}
function sceneVariables(state){
  const info=catalog.scenes[String(state.chapter)];
  if(!info)throw new Error('章节无效');
  const m=/(\d{2})(\d{2})(AM|PM|[a-z]?)$/.exec(info.source);
  if(m){state.strings['106']=String(Number(m[1])).replace(/[0-9]/g,c=>String.fromCharCode(c.charCodeAt(0)+65248))+'月'+String(Number(m[2])).replace(/[0-9]/g,c=>String.fromCharCode(c.charCodeAt(0)+65248))+'日';}
}
export function newState(chapter,story){
  const initial=chapter||catalog.initial;
  const state={chapter:initial,rootChapter:initial,cursor:0,background:'bg_black',regularBackground:'bg_black',body:'',speaker:'',text:'',choices:[],history:[],ended:false,progression:story?'story':'chapter',
    variables:{'6003':0,'6004':0},strings:{},stack:[],mapVisits:{}};sceneVariables(state);return state;
}
export function checkpoint(state){
  return {chapter:state.chapter,rootChapter:state.rootChapter,cursor:state.cursor,background:state.background,regularBackground:state.regularBackground,body:state.body,
    speaker:state.speaker,text:state.text,choices:state.choices.slice(-80),ended:state.ended,progression:state.progression,variables:Object.assign({},state.variables),strings:Object.assign({},state.strings),stack:state.stack.map(x=>x.slice()),mapVisits:Object.assign({},state.mapVisits)};
}
export function restore(saved){
  if(!saved||!Number.isInteger(saved.chapter)||saved.chapter<1||saved.chapter>catalog.count||!Number.isInteger(saved.cursor)||saved.cursor<0||saved.cursor>100000)throw new Error('存档位置无效');
  if(!Number.isInteger(saved.rootChapter)||!catalog.scenes[String(saved.rootChapter)]||!saved.variables||typeof saved.variables!=='object'||Object.keys(saved.variables).length>1024||!Array.isArray(saved.stack)||saved.stack.length>MAX_STACK)throw new Error('存档数据无效');
  for(const x of saved.stack)if(!Array.isArray(x)||x.length!==2||!Number.isInteger(x[0])||x[0]<1||x[0]>catalog.count||!Number.isInteger(x[1])||x[1]<0)throw new Error('存档调用位置无效');
  return Object.assign(newState(saved.chapter),saved,{history:[],variables:Object.assign({},saved.variables),strings:Object.assign({},saved.strings),choices:Array.isArray(saved.choices)?saved.choices.slice(-80):[],stack:saved.stack.map(x=>x.slice()),mapVisits:Object.assign({},saved.mapVisits)});
}
function remember(state){state.history.push(checkpoint(state));if(state.history.length>12)state.history.shift();}
function changeScene(state,chapter,cursor){state.chapter=chapter;state.cursor=cursor;sceneVariables(state);return {type:'jump',to:[chapter,cursor]};}
function finishChapter(state){
  if(state.stack.length){const to=state.stack.pop();return changeScene(state,to[0],to[1]);}
  if(state.progression==='story'){state.ended=true;return {type:'end'};}
  const info=catalog.scenes[String(state.rootChapter)];
  if(info&&info.next){state.rootChapter=info.next;state.body='';return changeScene(state,info.next,0);}
  state.ended=true;return {type:'end'};
}
export function readFrame(ops,state,base,total){
  base=base||0;total=total===undefined?ops.length:total;
  if(!Array.isArray(ops)||state.cursor>total)throw new Error('剧情位置无效');
  for(let guard=0;guard<256;guard++){
    if(state.cursor>=total)return finishChapter(state);
    if(state.cursor<base||state.cursor>=base+ops.length)return {type:'yield'};
    const op=ops[state.cursor-base];
    if(op.op==='map')return {type:'map',variable:op.variable,items:op.items};
    if(op.op==='text'){state.speaker=op.speaker;state.text=op.text;return {type:'text',speaker:op.speaker,text:op.text};}
    if(op.op==='choice'){
      const items=op.items.filter(x=>evaluate(x.condition,state)).map(x=>({text:x.text,variable:op.variable,value:x.value}));
      if(items.length)return {type:'choice',items};state.cursor++;continue;
    }
    if(op.op==='set'||op.op==='add'||op.op==='sub'){
      const key=String(op.variable),value=evaluate(op.value,state);
      state.variables[key]=op.op==='set'?value:(state.variables[key]||0)+(op.op==='sub'?-value:value);
    }
    if(op.op==='if'){
      const pass=!!evaluate(op.value,state);if(pass===op.truth){state.cursor=op.target;continue;}
    }
    if(op.op==='goto'){state.cursor=op.target;continue;}
    if(op.op==='call'||op.op==='callScene'){
      if(op.op==='callScene'&&catalog.scenes[String(op.scene)].source.charAt(0)==='_'){state.cursor++;continue;}
      if(state.stack.length>=MAX_STACK)throw new Error('场景调用过深，请选择其他篇章');
      state.stack.push([state.chapter,state.cursor+1]);
      if(op.op==='callScene'){if(state.progression==='story'&&catalog.scenes[String(op.scene)].route>=0)state.rootChapter=op.scene;return changeScene(state,op.scene,op.target);}
      state.cursor=op.target;continue;
    }
    if(op.op==='jumpScene'){
      if(op.scene===catalog.flowScene&&state.progression!=='story')return finishChapter(state);
      return changeScene(state,op.scene,op.target);
    }
    if(op.op==='return'||op.op==='end')return finishChapter(state);
    if(op.op==='image'){
      const id=Number(op.image.slice(1));
      if(id>=10001&&id<=16045){state.body=op.image;}
      else if(id>=1&&id<=522){state.background=op.image;state.regularBackground=op.image;state.body='';}
      else if(id>=1001&&id<=1856){state.background=op.image;state.body='';}
    }
    if(op.op==='clear'&&(op.layer===1||op.layer===65281||op.layer===65535))state.body='';
    state.cursor++;
  }
  return {type:'yield'};
}
export function next(state){remember(state);state.cursor++;}
// Run the original interpreter until a decision or the next chapter's first text.
// The skip context is transient UI state; saves keep the original VM format.
export function nextChapter(state){
  if(state.ended)return null;
  remember(state);
  return {chapter:state.rootChapter};
}
export function readChapterSkip(ops,state,context,base,total){
  for(let count=0;count<64;count++){
    const frame=readFrame(ops,state,base,total);
    if(frame.type!=='text'||state.rootChapter!==context.chapter)return frame;
    state.cursor++;
  }
  return {type:'yield'};
}
export function choose(state,item,index){if(!item||!Number.isInteger(item.value)||!Number.isInteger(item.variable))throw new Error('选项无效');remember(state);if(item.mapKey)state.mapVisits[item.mapKey]=true;state.variables[String(item.variable)]=item.value;state.choices.push(index);state.cursor++;}
export function previous(state){const last=state.history.pop();if(!last)return false;const history=state.history;Object.assign(state,last,{history});return true;}
export function previewMap(ops,state,frame){
  const items=[];
  for(const candidate of frame.items){
    const mapKey=state.chapter+':'+state.cursor+':'+candidate.value;if(state.mapVisits[mapKey])continue;
    const copy=restore(checkpoint(state));copy.history=[];copy.variables[String(frame.variable)]=candidate.value;copy.cursor++;let destination=0;
    for(let steps=0;steps<100;steps++){
      if(copy.chapter!==state.chapter){const info=catalog.scenes[String(copy.chapter)];if(info&&info.route>=0&&!/^(?:RB)?90_/.test(info.source)){destination=copy.chapter;break;}else break;}
      const out=readFrame(ops,copy);
      if(out.type==='end'||out.type==='map'||out.type==='choice')break;
      if(out.type==='text'){copy.cursor++;continue;}
    }
    if(destination){const info=catalog.scenes[String(destination)],hint=catalog.mapLabels[destination+':'+copy.cursor]||'';items.push({text:info.name+(hint?'\n'+hint:''),variable:frame.variable,value:candidate.value,destination,mapKey});}
  }
  return items;
}
