// Native END flags from the supplied REFLECTION BLUE scenario-flow script.
// Preserve all operation positions; existing 30-slot saves remain readable.
export const PROGRESS_KEY='summer_rw5_progress_v1';
export const FLOW_ENDINGS={222:1,261:2,289:3,321:4,350:5,374:6,405:7,441:8,456:9,489:10,510:11,523:12,548:13,566:14};
export const HEROINE_ENDINGS=[4,5,6,7,10,12,13];
export const CLEAR_FLAGS={4:12003,5:12004,6:12005,7:12006,8:12007,9:12008,10:12573,12:12574,13:12575,14:12576};
export function emptyProgress(){return {version:1,cleared:[],restartStage:0,globals:{}};}
export function heroineCount(progress){return HEROINE_ENDINGS.filter(id=>progress.cleared.indexOf(id)>=0).length;}
export function normalizeProgress(value){
  if(!value||value.version!==1||!Array.isArray(value.cleared))throw new Error('通关记录格式无效');
  const p=emptyProgress();p.cleared=value.cleared.filter((v,i,a)=>Number.isInteger(v)&&v>=1&&v<=14&&a.indexOf(v)===i).sort((a,b)=>a-b);
  p.restartStage=Number.isInteger(value.restartStage)&&value.restartStage>=0&&value.restartStage<=4?value.restartStage:0;
  for(const key of ['12001','12002','12010','12011','12012','12013'])if(value.globals&&Number.isInteger(value.globals[key]))p.globals[key]=value.globals[key];
  return reconcile(p);
}
export function decodeProgress(value){if(!value)return emptyProgress();return normalizeProgress(typeof value==='string'?JSON.parse(value):value);}
export function reconcile(progress){
  const count=heroineCount(progress);
  if(count>=4&&progress.restartStage===0)progress.restartStage=1;
  if(count>=6&&progress.restartStage===2)progress.restartStage=3;
  return progress;
}
export function progressFromState(progress,state,ending){
  const p=normalizeProgress(progress);
  if(ending&&p.cleared.indexOf(ending)<0)p.cleared.push(ending);
  for(const id of Object.keys(CLEAR_FLAGS))if(state.variables[String(CLEAR_FLAGS[id])]===1&&p.cleared.indexOf(Number(id))<0)p.cleared.push(Number(id));
  const stage=state.variables&&state.variables['14003'];
  if(Number.isInteger(stage)&&stage>=0&&stage<=4)p.restartStage=Math.max(p.restartStage,stage);
  for(const key of ['12001','12002','12010','12011','12012','12013'])if(Number.isInteger(state.variables[key]))p.globals[key]=Math.max(p.globals[key]||0,state.variables[key]);
  p.cleared.sort((a,b)=>a-b);return reconcile(p);
}
export function withProgress(state,progress){
  const p=normalizeProgress(progress),v=state.variables;
  for(const key of Object.keys(p.globals))v[key]=Math.max(v[key]||0,p.globals[key]);
  for(const id of p.cleared)if(CLEAR_FLAGS[id])v[String(CLEAR_FLAGS[id])]=1;
  v['24006']=Object.keys(CLEAR_FLAGS).filter(id=>id!=='14'&&v[String(CLEAR_FLAGS[id])]===1).length;
  v['14003']=Math.max(v['14003']||0,p.restartStage);
  return state;
}
export function titleActions(progress){
  const p=normalizeProgress(progress),pocket=p.cleared.indexOf(9)>=0,alka=p.cleared.indexOf(8)>=0;
  if(!pocket&&(p.restartStage===1||p.restartStage===3))return ['restart'];
  if(pocket)return ['start','alka','pocket'];
  if(alka)return ['pocket'];
  if(heroineCount(p)===7)return ['alka'];
  return ['start'];
}
export function titleRows(progress){
  const actions=titleActions(progress),restart=actions[0]==='restart';
  const rows=actions.slice();if(!restart)rows.push('load','gallery');rows.push('options','manual','exit');
  const widths={start:114,load:99,gallery:160,options:161,manual:159,exit:90,alka:98,pocket:105,restart:153};
  return rows.map(action=>({action,src:'/common/ui/'+action+'.png',width:widths[action]+8,label:action==='restart'?'ReSTART':action==='alka'?'ALKA':action==='pocket'?'Pocket':action==='start'?'开始阅读':action==='load'?'读取存档':action==='gallery'?'CG 鉴赏':action==='manual'?'操作说明':action==='exit'?'退出':'设置'}));
}
