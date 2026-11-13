import fs from 'node:fs/promises';
import path from 'node:path';
import {allowed,config,launch,delay,record,hash,id} from './common.js';
import {desktop,inspect,screenshot,Control,Inspection} from './desktop.js';
import {checkArtifact} from './keil.js';
type Menu={name:string;path:string;command:number;enabled:boolean;checked:boolean};
const menuPatterns={find:/查找并编辑元件|Find.*Edit Component/i,start:/^开始仿真|^Run Simulation|^Start Simulation/i,pause:/^暂停仿真|^Pause Simulation/i,stop:/^停止仿真|^Stop Simulation/i,save:/^保存工程|^Save Project/i};
export const menus=(pid?:number):Promise<Menu[]>=>desktop('menus',{pid});
export function stateFromMenus(m:Menu[]){
 const pause=m.find(x=>menuPatterns.pause.test(x.name)),stop=m.find(x=>menuPatterns.stop.test(x.name)),start=m.find(x=>menuPatterns.start.test(x.name));
 if(!pause||!stop||!start)return 'unknown';
 if(stop.enabled&&pause.enabled)return 'running';
 if(stop.enabled&&!pause.enabled)return 'paused';
 if(!stop.enabled&&start.enabled)return 'stopped';return 'unknown';
}
async function menu(action:keyof typeof menuPatterns,pid?:number){const all=await menus(pid);let matches=all.filter(x=>menuPatterns[action].test(x.name));
 // F12 runs the loaded firmware. Ctrl+F12 starts the VSM Studio build/debug flow.
 if(action==='start'){const run=all.filter(x=>/^运行仿真(?:\t|$)|^Run Simulation(?:\t|$)/i.test(x.name));if(run.length===1)matches=run;}
 if(matches.length!==1||!matches[0].enabled)throw new Error(`Cannot uniquely access enabled ${action} menu`);return desktop('menu',{pid,command:matches[0].command});}
export function noDialog(s:Inspection){if(s.controls.some(c=>c.class==='#32770'&&c.enabled)||s.controls.find(c=>c.type==='ControlType.Window')?.enabled===false)throw new Error('Unexpected dialog open; inspect and resolve before continuing');}
async function set(c:Control,value:string,pid:number){const r=await desktop('set_value',{pid,automationId:c.automationId,class:c.class,value});if(!r.verified)throw new Error('Control value readback failed');}
async function ok(pid:number){await desktop('invoke',{pid,automationId:'1',class:'Button'});await delay(250)}
async function cancel(pid:number){await desktop('invoke',{pid,automationId:'2',class:'Button'});await delay(150)}
export async function componentOpen(ref:string,pid?:number){
 if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(ref))throw new Error('Invalid component reference');
 const before=await inspect(pid);noDialog(before);
 if(stateFromMenus(await menus(before.pid))!=='stopped')throw new Error('Stop simulation before editing components');
 await menu('find',before.pid);
 const find=await inspect(before.pid);const input=find.controls.find(c=>c.automationId==='257'&&c.class==='Edit'&&c.enabled);
 if(!input)throw new Error('Find component dialog not recognized');await set(input,ref,before.pid);await ok(before.pid);
 const result=await inspect(before.pid);const reference=result.controls.find(c=>c.automationId==='257'&&c.class==='Edit'&&c.enabled);
 if(reference?.value!==ref)throw new Error('Component reference could not be verified');return result;
}
function property(s:Inspection,label:RegExp){
 const labels=s.controls.filter(c=>c.class==='Static'&&c.enabled&&label.test(c.name||''));
 if(labels.length!==1)throw new Error('Property label not uniquely found');const l=labels[0];
 const inputs=s.controls.filter(c=>c.class==='Edit'&&c.enabled&&Math.abs(c.y-l.y)<8&&c.x>=l.x+l.width-5);
 if(inputs.length!==1)throw new Error('Property input not uniquely found');return inputs[0];
}
export async function setFirmware(ref:string,buildId:string,clockHz?:number,pid?:number,projectFile?:string){
 const initial=await inspect(pid);const project=await allowed(projectFile||projects.get(initial.pid)||'');
 if(!initial.title.includes(path.basename(project,path.extname(project))))throw new Error('Project title does not match requested project');
 const artifact=await checkArtifact(buildId);let s=await componentOpen(ref,pid);
 await set(property(s,/Program File|程序文件/i),artifact.path,s.pid);
 if(clockHz!==undefined)await set(property(s,/Clock Frequency|时钟频率/i),String(clockHz),s.pid);
 await ok(s.pid);s=await componentOpen(ref,s.pid);
 const actual=property(s,/Program File|程序文件/i).value;const clock=property(s,/Clock Frequency|时钟频率/i).value;
 const resolved=actual?path.resolve(path.dirname(project),actual):'';
 const verified=resolved.toLowerCase()===artifact.path.toLowerCase()&&(clockHz===undefined||Number(clock)===clockHz);
 await cancel(s.pid);
 const result={verified,component:ref,buildId,artifact,project,actualProgramFile:actual,resolvedProgramFile:resolved,clockHz:clock,pid:s.pid};
 const receipt=await record('firmware',result);if(!verified)throw new Error('Firmware property verification failed: '+receipt);projects.set(s.pid,project);return {...result,receipt};
}
export async function simulation(action:'start'|'pause'|'stop'|'status',pid?:number){
 let s=await inspect(pid);noDialog(s);let m=await menus(s.pid);const before=stateFromMenus(m);
 if(action!=='status'){
  const expected=action==='start'?'running':action==='pause'?'paused':'stopped';
  if(before!==expected){await menu(action,s.pid);await delay(800)}
  s=await inspect(s.pid);m=await menus(s.pid);
 }
 const state=s.controls.some(c=>c.class==='#32770'&&c.enabled)?'unknown':stateFromMenus(m);
 const expected=action==='status'?state:action==='start'?'running':action==='pause'?'paused':'stopped';
 const shot=await screenshot(s.pid);const result={action,state,verified:state!=='unknown'&&state===expected,pid:s.pid,screenshot:shot,controls:s.controls.filter(c=>c.class==='#32770'||/error|错误|warning|警告/i.test(c.name||'')),evidence:'native_menu_enable_state'};
 return {...result,receipt:await record('simulation',result)};
}
const projects=new Map<number,string>();
export async function openProteus(file:string){
 file=await allowed(file);if(!/\.(pdsprj|dsn)$/i.test(file))throw new Error('Expected Proteus project');
 const pid=await launch(config.proteusExe,[file],path.dirname(file));
 for(let i=0;i<10;i++){
  await delay(800);try{
   let s:Inspection;try{s=await inspect(pid)}catch{s=await inspect()}
   if(s.title.includes(path.basename(file,path.extname(file)))){projects.set(s.pid,file);return {file,pid:s.pid,verified:true,title:s.title,verification:'window_title_after_launch'}}
  }catch{}
 }
 return {file,pid,verified:false,note:'Project launch requested; inspect UI for dialogs.'};
}
export async function saveProject(file:string,pid?:number){
 file=await allowed(file);const s=await inspect(pid);noDialog(s);
 if(projects.get(s.pid)!==file)throw new Error('Open this exact project or verify its firmware through this MCP session before saving');
 if(!s.title.includes(path.basename(file,path.extname(file))))throw new Error('Active project title changed');
 const old=await fs.stat(file);const backup=file+'.bak.'+id();await fs.copyFile(file,backup);await menu('save',s.pid);await delay(400);
 const after=await inspect(s.pid);const st=await fs.stat(file);const verified=!after.controls.some(c=>c.class==='#32770'&&c.enabled)&&st.mtimeMs!==old.mtimeMs;
 return {file,backup,verified,sha256:hash(await fs.readFile(file)),note:verified?'File timestamp changed after save':'Save requested; file timestamp unchanged or dialog present'};
}
export async function logs(pid?:number){const s=await inspect(pid);return {pid:s.pid,source:'accessible_window_text',complete:false,lines:s.controls.map(c=>c.value||c.name).filter(Boolean),note:'Custom rendered simulation log may require opening it and taking a screenshot.'}}
