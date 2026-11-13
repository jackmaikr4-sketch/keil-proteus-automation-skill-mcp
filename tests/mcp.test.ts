import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ROOT} from '../src/common.js';
for(const app of ['keil','proteus'])test(`${app}: real stdio handshake, tools and call`,async()=>{
 const client=new Client({name:'integration-test',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(ROOT,'dist/src/server.js'),app],stderr:'inherit',env:process.env as Record<string,string>});
 try{
  await client.connect(transport);const list=await client.listTools();assert.ok(list.tools.length>=6);
  assert.equal(new Set(list.tools.map(t=>t.name)).size,list.tools.length);
  const r=await client.callTool({name:`${app}_installation_check`,arguments:{}});assert.notEqual(r.isError,true);
  const invalid=await client.callTool({name:app==='keil'?'keil_read_project':'proteus_open_project',arguments:{file:path.join(ROOT,'config.json')}});assert.equal(invalid.isError,true);
 }finally{await client.close()}
});
