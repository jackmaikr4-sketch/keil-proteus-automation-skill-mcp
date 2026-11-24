import fs from 'node:fs/promises';
import path from 'node:path';
import iconv from 'iconv-lite';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { allowed, config, run, hash, ARTIFACTS, id, exclusive, record, launch } from './common.js';
export function decode(buf: Buffer, explicit?: string) {
  let encoding = explicit || 'utf8';
  let bom: Buffer = Buffer.alloc(0),
    body: Buffer = buf;
  if (buf.subarray(0, 3).equals(Buffer.from([239, 187, 191]))) {
    encoding = 'utf8';
    bom = buf.subarray(0, 3);
    body = buf.subarray(3);
  } else if (buf.subarray(0, 2).equals(Buffer.from([255, 254]))) {
    encoding = 'utf16le';
    bom = buf.subarray(0, 2);
    body = buf.subarray(2);
  } else if (buf.subarray(0, 2).equals(Buffer.from([254, 255]))) {
    encoding = 'utf16be';
    bom = buf.subarray(0, 2);
    body = buf.subarray(2);
  } else if (!explicit) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      throw new Error(
        'Unknown source encoding; specify gbk or other supported encoding explicitly',
      );
    }
  }
  if (!iconv.encodingExists(encoding)) throw new Error('Unsupported encoding');
  return { text: iconv.decode(body, encoding), encoding, bom };
}
export async function sourceRead(file: string, encoding?: string) {
  file = await allowed(file);
  const buf = await fs.readFile(file);
  const d = decode(buf, encoding);
  return { file, text: d.text, encoding: d.encoding, sha256: hash(buf) };
}
export async function sourceReplace(
  file: string,
  oldText: string,
  newText: string,
  expectedSha256: string,
  encoding?: string,
) {
  file = await allowed(file);
  if (!/\.(c|h|a51|inc|s|asm)$/i.test(file))
    throw new Error('Only source file extensions may be modified');
  return exclusive('keil-build', async () => {
    const buf = await fs.readFile(file);
    if (hash(buf) !== expectedSha256) throw new Error('Source changed; read again');
    const d = decode(buf, encoding);
    if (!oldText || d.text.split(oldText).length !== 2)
      throw new Error('Replacement must match exactly once');
    const text = d.text.replace(oldText, newText);
    const bytes = iconv.encode(text, d.encoding);
    if (iconv.decode(bytes, d.encoding) !== text)
      throw new Error('Replacement cannot be represented in original encoding');
    const output = Buffer.concat([d.bom, bytes]);
    const backup = file + '.bak.' + id();
    await fs.copyFile(file, backup);
    await fs.writeFile(file, output);
    return { file, backup, sha256: hash(output), encoding: d.encoding };
  });
}
export async function projectRead(file: string) {
  file = await allowed(file);
  if (!/\.uvprojx?$/i.test(file)) throw new Error('Expected .uvproj or .uvprojx');
  const text = decode(await fs.readFile(file)).text;
  if (XMLValidator.validate(text) !== true) throw new Error('Invalid project XML');
  const xml = new XMLParser({ parseTagValue: false, ignoreAttributes: false }).parse(text);
  const raw = xml.Project?.Targets?.Target;
  if (!raw) throw new Error('No project targets');
  const targets = (Array.isArray(raw) ? raw : [raw]).map((t: any) => {
    const c = t.TargetOption.TargetCommonOption;
    const dir = path.resolve(path.dirname(file), c.OutputDirectory || '.');
    return {
      name: t.TargetName,
      device: c.Device,
      outputDirectory: dir,
      outputName: c.OutputName,
      createHex: c.CreateHexFile === '1',
      hexPath: path.join(dir, (c.OutputName || '').replace(/\.(axf|elf)$/i, '') + '.hex'),
    };
  });
  return { file, targets };
}
export function buildOutcome(code: number, log: string, timedOut: boolean) {
  const errors = log
    .split(/\r?\n/)
    .filter((x) => /\berror\b|fatal|cannot open/i.test(x) && !/\b0 Error\(s\)/i.test(x));
  const warnings = log
    .split(/\r?\n/)
    .filter((x) => /\bwarning\b/i.test(x) && !/\b0 Warning\(s\)/i.test(x));
  const summary = log.match(/(\d+) Error\(s\),\s*(\d+) Warning\(s\)/i);
  const success = !timedOut && (code === 0 || code === 1) && !!summary && Number(summary[1]) === 0;
  return {
    success,
    errors,
    warnings,
    errorCount: summary ? Number(summary[1]) : null,
    warningCount: summary ? Number(summary[2]) : null,
  };
}
export async function build(file: string, targetName: string, rebuild = false) {
  const project = await projectRead(file);
  const target = project.targets.find((t) => t.name === targetName);
  if (!target) throw new Error('Unknown target');
  return exclusive('keil-build', async () => {
    const buildId = id();
    const logPath = path.join(ARTIFACTS, `build-${buildId}.log`);
    const start = Date.now();
    let previous: any;
    try {
      const s = await fs.stat(target.hexPath);
      previous = { mtimeMs: s.mtimeMs, sha256: hash(await fs.readFile(target.hexPath)) };
    } catch {}
    const result = await run(
      config.keilExe,
      [rebuild ? '-r' : '-b', project.file, '-t', targetName, '-j0', '-o', logPath],
      config.buildTimeoutMs,
      path.dirname(project.file),
    );
    const raw = await fs.readFile(logPath).catch(() => Buffer.alloc(0));
    let log: string;
    try {
      log = decode(raw).text;
    } catch {
      log = iconv.decode(raw, 'gbk');
    }
    const outcome = buildOutcome(result.code, log, result.timedOut);
    let artifact: any = null;
    if (outcome.success && target.createHex) {
      try {
        const hex = await allowed(target.hexPath);
        const s = await fs.stat(hex);
        const data = await fs.readFile(hex);
        const sha = hash(data);
        const fresh =
          s.mtimeMs >= start - 2000 &&
          (!previous || s.mtimeMs !== previous.mtimeMs || sha !== previous.sha256);
        if (fresh && data.toString('ascii').trimStart().startsWith(':')) {
          artifact = { path: hex, sha256: sha, size: s.size, mtimeMs: s.mtimeMs, buildId };
        }
      } catch {}
    }
    const receipt = {
      buildId,
      project: project.file,
      target: targetName,
      startedAt: new Date(start).toISOString(),
      exitCode: result.code,
      timedOut: result.timedOut,
      ...outcome,
      logPath,
      artifact,
      artifactVerified: !!artifact,
      note:
        outcome.success && !artifact
          ? 'Build passed but no newly generated HEX verified. Use rebuild and enable HEX output.'
          : undefined,
    };
    await fs.writeFile(
      path.join(ARTIFACTS, `build-${buildId}.json`),
      JSON.stringify(receipt, null, 2),
    );
    return receipt;
  });
}
export async function buildResult(buildId: string) {
  if (!/^[a-f0-9-]{36}$/.test(buildId)) throw new Error('Invalid build ID');
  return JSON.parse(await fs.readFile(path.join(ARTIFACTS, `build-${buildId}.json`), 'utf8'));
}
export async function checkArtifact(buildId: string) {
  const r = await buildResult(buildId);
  if (!r.success || !r.artifactVerified) throw new Error('Build has no verified fresh HEX');
  await allowed(r.artifact.path);
  if (hash(await fs.readFile(r.artifact.path)) !== r.artifact.sha256)
    throw new Error('HEX changed after build');
  return r.artifact;
}
export async function openKeil(file: string) {
  const p = await projectRead(file);
  return { pid: await launch(config.keilExe, [p.file]), verified: false };
}
