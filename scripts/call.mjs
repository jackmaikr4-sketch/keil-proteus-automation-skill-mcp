// Exercise the exact stdio protocol used by Codex. Arguments are JSON, never shell code.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [app,name,json='{}']=process.argv.slice(2);
const client=new Client({name:'local-acceptance',version:'1.0.0'});
try{
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'dist/src/server.js'),app],stderr:'inherit',env:process.env}));
 const result=await client.callTool({name,arguments:JSON.parse(json)},undefined,{timeout:180000});
 for(const item of result.content){if(item.type==='text')console.log(item.text)}
 if(result.isError)process.exitCode=1;
}finally{await client.close()}
