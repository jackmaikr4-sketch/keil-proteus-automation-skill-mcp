// Isolated configuration: protocol tests check file existence, not licensed applications.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(), 'keil-proteus-test-'));
const configFile=path.join(temp, 'config.json');
await fs.writeFile(configFile, JSON.stringify({keilExe:process.execPath,proteusExe:process.execPath,allowedRoots:[temp],buildTimeoutMs:120000,desktopTimeoutMs:30000}));
try {
  const files=(await fs.readdir(path.join(root,'dist/tests'))).filter(f=>f.endsWith('.test.js')).map(f=>path.join(root,'dist/tests',f));
  const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',env:{...process.env,EDA_MCP_CONFIG:configFile,EDA_MCP_TEST_ROOT:temp}});
  if(result.error) throw result.error;
  process.exitCode=result.status??1;
} finally { await fs.rm(temp,{recursive:true,force:true}); }
