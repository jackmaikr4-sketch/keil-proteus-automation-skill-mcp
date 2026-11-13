import fs from 'node:fs/promises';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {config,exclusive} from './common.js';
import * as keil from './keil.js';
import * as ui from './desktop.js';
import * as proteus from './proteus.js';
const app=process.argv[2];if(app!=='keil'&&app!=='proteus')throw new Error('Usage: server.js keil|proteus');
const server=new McpServer({name:`${app}-mcp`,version:'0.1.0'});
const file=z.string().describe('Absolute file path inside configured allowedRoots');const pid=z.number().int().positive().optional();
function tool(name:string,description:string,schema:Record<string,z.ZodTypeAny>,fn:(a:any)=>Promise<any>,desktop=false){
 server.registerTool(name,{description,inputSchema:schema},async(a:any)=>{
  try{const value=desktop?await exclusive('desktop-workflow',()=>fn(a)):await fn(a);
   const content:any[]=[{type:'text',text:JSON.stringify(value)}];
   const shot=value?.snapshotId?value:value?.screenshot;
   if(shot?.path)content.push({type:'image',mimeType:'image/png',data:(await fs.readFile(shot.path)).toString('base64')});
   return {content};
  }catch(e){return {isError:true,content:[{type:'text' as const,text:JSON.stringify({error:e instanceof Error?e.message:String(e),verified:false})}]}}
 });
}
tool(`${app}_installation_check`,'Check configured executable exists; does not assert license or desktop availability.',{},async()=>{const exe=app==='keil'?config.keilExe:config.proteusExe;await fs.access(exe);return {exe,exists:true,allowedRoots:config.allowedRoots}});
if(app==='keil'){
 tool('keil_read_project','Read project and list available build targets.',{file},a=>keil.projectRead(a.file));
 tool('keil_open_project','Open an existing Keil project in the interactive IDE.',{file},a=>keil.openKeil(a.file),true);
 tool('keil_read_source','Read source text, detected encoding and SHA256. Specify encoding for non-UTF source.',{file,encoding:z.string().optional()},a=>keil.sourceRead(a.file,a.encoding));
 tool('keil_replace_source','Replace exactly one source text match, guarded by previous SHA256; back up and preserve encoding.',{file,oldText:z.string().min(1),newText:z.string(),expectedSha256:z.string().regex(/^[a-f0-9]{64}$/),encoding:z.string().optional()},a=>keil.sourceReplace(a.file,a.oldText,a.newText,a.expectedSha256,a.encoding));
 tool('keil_build','Build or rebuild a named target. Only a fresh verified HEX may be loaded by Proteus. Use rebuild=true for handoff.',{file,target:z.string(),rebuild:z.boolean().default(false)},a=>keil.build(a.file,a.target,a.rebuild));
 tool('keil_build_result','Read a saved build receipt.',{buildId:z.string().uuid()},a=>keil.buildResult(a.buildId));
}else{
 tool('proteus_open_project','Open an existing Proteus project and verify its title.',{file},a=>proteus.openProteus(a.file),true);
 tool('proteus_inspect','Read application controls including native edit values and owned dialogs.',{pid},a=>ui.inspect(a.pid),true);
 tool('proteus_screenshot','Focus Proteus and capture window. Returns image and a single-use 60-second snapshotId for clicks.',{pid,maximize:z.boolean().default(false)},a=>ui.screenshot(a.pid,a.maximize),true);
 tool('proteus_click','Click within a fresh screenshot; fails if window moved. Read resulting UI to verify effects.',{snapshotId:z.string().uuid(),x:z.number().int().nonnegative(),y:z.number().int().nonnegative(),button:z.enum(['left','right']).default('left'),double:z.boolean().default(false)},a=>ui.click(a.snapshotId,a.x,a.y,a.button,a.double),true);
 tool('proteus_keys','Send a supported shortcut to focused Proteus only; inspect afterwards.',{pid,key:z.enum(['escape','enter','tab','select_all','find_component','save'])},a=>ui.keys(({escape:'{ESC}',enter:'{ENTER}',tab:'{TAB}',select_all:'^a',find_component:'e',save:'^s'})[a.key as 'escape'],a.pid),true);
 tool('proteus_type','Type literal text into currently focused Proteus control; inspect afterwards.',{pid,text:z.string().max(4096)},a=>ui.desktop('text',{pid:a.pid,text:a.text}),true);
 tool('proteus_control','Invoke or set a uniquely identified control. Get selectors from inspect.',{pid,action:z.enum(['invoke','set_value']),name:z.string().optional(),automationId:z.string().optional(),class:z.string().optional(),value:z.string().optional()},async a=>{if(!a.name&&!a.automationId)throw new Error('A selector is required');return ui.desktop(a.action,a)},true);
 tool('proteus_open_component','Find MCU/component by reference and verify property dialog identity; stop simulation first.',{pid,reference:z.string()},a=>proteus.componentOpen(a.reference,a.pid),true);
 tool('proteus_set_firmware','Load verified Keil build into MCU, optionally set clock, reopen properties and verify. Supply projectFile to resolve Proteus relative paths. Simulation must be stopped; no dialogs open.',{pid,projectFile:file,reference:z.string(),buildId:z.string().uuid(),clockHz:z.number().int().positive().optional()},a=>exclusive('keil-build',()=>proteus.setFirmware(a.reference,a.buildId,a.clockHz,a.pid,a.projectFile)),true);
 tool('proteus_simulation','Start, pause, stop or inspect simulation. Returns native menu state evidence and screenshot; unknown remains unverified.',{pid,action:z.enum(['start','pause','stop','status'])},a=>proteus.simulation(a.action,a.pid),true);
 tool('proteus_read_logs','Return accessible window text; custom-rendered logs may require screenshots.',{pid},a=>proteus.logs(a.pid),true);
 tool('proteus_save_project','Back up and save the exact project opened or firmware-verified through this MCP session.',{pid,file},a=>proteus.saveProject(a.file,a.pid),true);
}
await server.connect(new StdioServerTransport());
