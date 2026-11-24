import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ARTIFACTS = path.join(ROOT, 'artifacts');
export const config = JSON.parse(
  await fs.readFile(process.env.EDA_MCP_CONFIG || path.join(ROOT, 'config.json'), 'utf8'),
) as {
  keilExe: string;
  proteusExe: string;
  allowedRoots: string[];
  buildTimeoutMs: number;
  desktopTimeoutMs: number;
};
await fs.mkdir(ARTIFACTS, { recursive: true });
export async function allowed(file: string): Promise<string> {
  if (!path.isAbsolute(file)) throw new Error('Absolute path required');
  const real = await fs.realpath(file);
  for (const root of config.allowedRoots) {
    const rr = await fs.realpath(root);
    const rel = path.relative(rr, real);
    if (rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)))
      return real;
  }
  throw new Error('Path is outside allowedRoots (including symlink resolution)');
}
export const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
export const id = () => randomUUID();
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function run(
  exe: string,
  args: string[],
  timeout = 30000,
  cwd = ROOT,
): Promise<{ code: number; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, windowsHide: true, shell: false });
    let stdout = '',
      stderr = '',
      timedOut = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (x) => {
      stdout += x.toString('utf8');
    });
    child.stderr.on('data', (x) => {
      stderr += x.toString('utf8');
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, timedOut });
    });
  });
}
export async function launch(exe: string, args: string[], cwd = ROOT) {
  await fs.access(exe);
  return new Promise<number | undefined>((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      shell: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(child.pid);
    });
  });
}
export async function record(kind: string, value: unknown) {
  const file = path.join(ARTIFACTS, `${kind}-${id()}.json`);
  await fs.writeFile(file, JSON.stringify(value, null, 2));
  return file;
}
export async function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lock = path.join(ARTIFACTS, `${key}.lock`);
  let f;
  try {
    f = await fs.open(lock, 'wx');
  } catch {
    throw new Error(`${key} busy; if a process crashed, inspect and remove its lock file`);
  }
  try {
    await f.writeFile(JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
    return await fn();
  } finally {
    await f.close();
    await fs.unlink(lock);
  }
}
