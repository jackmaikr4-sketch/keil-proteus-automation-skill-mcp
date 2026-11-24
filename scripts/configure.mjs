import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'config.json');
await fs.mkdir(path.join(root, 'examples'), { recursive: true });
// Prefer an existing installation on common Windows drives; users can still edit config.json.
async function existingOrDefault(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return candidates[0];
}
const config = {
  keilExe: await existingOrDefault(['C:/Keil_v5/UV4/UV4.exe', 'D:/Keil_v5/UV4/UV4.exe']),
  proteusExe: await existingOrDefault([
    'C:/Program Files (x86)/Labcenter Electronics/Proteus 8 Professional/BIN/PDS.EXE',
    'D:/Program Files (x86)/Labcenter Electronics/Proteus 8 Professional/BIN/PDS.EXE',
  ]),
  allowedRoots: [path.join(root, 'examples')],
  buildTimeoutMs: 120000,
  desktopTimeoutMs: 30000,
};
try {
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  console.log(
    `Created ${file}. Edit software paths and allowedRoots before using the MCP servers.`,
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log(`Keeping existing ${file}`);
}
