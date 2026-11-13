import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,ARTIFACTS,config,run,id,delay} from './common.js';
export type Control={name:string;automationId:string;type:string;class:string;value:string|null;enabled:boolean;offscreen:boolean;x:number;y:number;width:number;height:number};
export type Inspection={pid:number;title:string;bounds:{x:number;y:number;width:number;height:number};controls:Control[]};
export async function desktop(action:string,args:Record<string,unknown>={},app='proteus'):Promise<any>{
 const request=Buffer.from(JSON.stringify({action,app,...args})).toString('base64');
 const r=await run('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'scripts','desktop.ps1'),'-Request',request],config.desktopTimeoutMs);
 if(r.timedOut)throw new Error('Desktop operation timed out; inspect current state before retrying');
 let v;try{v=JSON.parse(r.stdout.replace(/^\uFEFF/,''))}catch{throw new Error(`Desktop helper failed (exit ${r.code}): ${r.stderr.slice(0,1000)} stdout=${r.stdout.slice(0,500)}`)}
 if(r.code!==0||v.error)throw new Error(v.error||r.stderr);return v;
}
export const inspect=(pid?:number):Promise<Inspection>=>desktop('inspect',{pid});
const snapshots=new Map<string,{pid:number;bounds:Inspection['bounds'];time:number;path:string}>();
export async function screenshot(pid?:number,maximize=false){const snapshotId=id();const output=path.join(ARTIFACTS,`screen-${snapshotId}.png`);const r=await desktop('screenshot',{pid,output,maximize});snapshots.set(snapshotId,{pid:r.pid,bounds:r.bounds,time:Date.now(),path:output});return {...r,snapshotId};}
export async function click(snapshotId:string,x:number,y:number,button='left',double=false){
 const s=snapshots.get(snapshotId);if(!s||Date.now()-s.time>60000)throw new Error('Screenshot expired; capture again');snapshots.delete(snapshotId);
 await desktop('click',{pid:s.pid,x,y,button,double,expectedX:s.bounds.x,expectedY:s.bounds.y,expectedWidth:s.bounds.width,expectedHeight:s.bounds.height});
 await delay(250);return {verified:false,after:await inspect(s.pid)};
}
export const keys=(keys:string,pid?:number)=>desktop('keys',{keys,pid});
export const selector=(c:Control)=>({name:c.name||undefined,automationId:c.automationId||undefined,type:c.type});
