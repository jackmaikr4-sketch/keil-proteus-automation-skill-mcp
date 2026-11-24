import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'examples', 'c51-display');
await fs.mkdir(output, { recursive: true });
const config = JSON.parse(
  await fs.readFile(process.env.EDA_MCP_CONFIG || path.join(root, 'config.json'), 'utf8'),
);
const donor =
  process.argv[2] || path.join(path.dirname(config.keilExe), '../C51/Examples/HELLO/Hello.uvproj');
let xml = await fs.readFile(donor, 'utf8');
xml = xml
  .replace('<TargetName>Simulator</TargetName>', '<TargetName>Display</TargetName>')
  .replace('<CreateHexFile>0</CreateHexFile>', '<CreateHexFile>1</CreateHexFile>')
  .replace('<OutputName>HELLO</OutputName>', '<OutputName>display</OutputName>')
  .replace('CLOCK(33000000)', 'CLOCK(12000000)')
  .replace('<Device>8XC52</Device>', '<Device>AT89C51RD2</Device>')
  .replace('<Vendor>NXP (founded by Philips)</Vendor>', '<Vendor>Atmel</Vendor>')
  .replace('<DeviceId>2928</DeviceId>', '<DeviceId></DeviceId>')
  .replace(
    /<Groups>[\s\S]*?<\/Groups>/,
    '<Groups><Group><GroupName>Source</GroupName><Files><File><FileName>main.c</FileName><FileType>1</FileType><FilePath>.\\main.c</FilePath></File></Files></Group></Groups>',
  );
// Proteus model is AT89C51RD2, 12 MHz; only standard registers are used.
await fs.writeFile(path.join(output, 'display.uvproj'), xml, { flag: 'wx' });
await fs.writeFile(
  path.join(output, 'main.c'),
  `#include <REG52.H>
/* Proteus Timer: P1.0..7 -> segment A..DP through 74HC541;
   P0.0..3 -> digit cathodes, P2.7 -> alarm (keep low).
   Acceptance: modify only the digits array via keil_replace_source. */
unsigned char code digits[4] = {1, 2, 3, 4};
unsigned char code segments[10] = {0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f};
void main(void) {
 unsigned char i;
 volatile unsigned int wait;
 P2 = 0x7f;
 while(1) {
  for(i=0;i<4;i++) {
   P0=0xff;
   P1=segments[digits[i]];
   P0=(unsigned char)~(1<<i);
   for(wait=0;wait<200;wait++);
  }
 }
}
`,
  { flag: 'wx' },
);
console.log(output);
