import fs from 'node:fs/promises';
import {config,ROOT} from './common.js';
import {inspect} from './desktop.js';
const result:any={node:process.version,root:ROOT,executables:{},allowedRoots:config.allowedRoots};
for(const [name,file] of Object.entries({keil:config.keilExe,proteus:config.proteusExe})){try{await fs.access(file);result.executables[name]={path:file,exists:true}}catch{result.executables[name]={path:file,exists:false}}}
try{const s=await inspect();result.desktop={pid:s.pid,title:s.title,controls:s.controls.length}}catch(e){result.desktop={error:String(e)}}
console.log(JSON.stringify(result,null,2));
