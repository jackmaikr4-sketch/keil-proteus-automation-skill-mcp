import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import iconv from 'iconv-lite';
import { ROOT, allowed, hash, run, ARTIFACTS, id } from '../src/common.js';
import { decode, sourceReplace, sourceRead, buildOutcome, checkArtifact } from '../src/keil.js';
import { stateFromMenus, noDialog } from '../src/proteus.js';
const TEST_ROOT = process.env.EDA_MCP_TEST_ROOT!;
test('build errors, warnings and missing summary are distinguished', () => {
  assert.equal(buildOutcome(0, '0 Error(s), 0 Warning(s)', false).success, true);
  assert.equal(buildOutcome(1, '0 Error(s), 1 Warning(s)', false).success, true);
  assert.equal(buildOutcome(2, '1 Error(s), 0 Warning(s)', false).success, false);
  assert.equal(buildOutcome(0, '', false).success, false);
  assert.equal(buildOutcome(0, '0 Error(s), 0 Warning(s)', true).success, false);
});
test('unknown simulation state is not success', () => {
  assert.equal(stateFromMenus([]), 'unknown');
  const m = (pause: boolean, stop: boolean) => [
    { name: '开始仿真', enabled: true, command: 1, path: '', checked: false },
    { name: '暂停仿真', enabled: pause, command: 2, path: '', checked: false },
    { name: '停止仿真', enabled: stop, command: 3, path: '', checked: false },
  ];
  assert.equal(stateFromMenus(m(false, false)), 'stopped');
  assert.equal(stateFromMenus(m(true, true)), 'running');
  assert.equal(stateFromMenus(m(false, true)), 'paused');
});
test('encoding, backup and stale edit protection on Chinese/space path', async () => {
  const dir = path.join(TEST_ROOT, '测试 source');
  await fs.mkdir(dir, { recursive: true });
  const f = path.join(dir, 'test.c');
  const original = iconv.encode('// 中文\r\nint value=1;\r\n', 'gbk');
  await fs.writeFile(f, original);
  await assert.rejects(sourceRead(f), /encoding/);
  const before = await sourceRead(f, 'gbk');
  const r = await sourceReplace(f, 'value=1', 'value=2', before.sha256, 'gbk');
  assert.deepEqual(await fs.readFile(r.backup), original);
  assert.equal((await sourceRead(f, 'gbk')).text, '// 中文\r\nint value=2;\r\n');
  await assert.rejects(sourceReplace(f, 'value=2', 'value=3', before.sha256, 'gbk'), /changed/);
  await assert.rejects(sourceReplace(f, 'value=2', 'value="😀"', r.sha256, 'gbk'), /encoding/);
});
test('deny outside allowedRoots and preserve UTF16 BOM', async () => {
  await assert.rejects(allowed(path.join(ROOT, 'package.json')), /outside/);
  const b = Buffer.concat([Buffer.from([255, 254]), iconv.encode('你好', 'utf16le')]);
  assert.equal(decode(b).text, '你好');
  assert.equal(decode(b).bom.length, 2);
});
test('timeout terminates an owned child process', async () => {
  const r = await run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], 100);
  assert.equal(r.timedOut, true);
});
test('failed build receipts and modified artifacts are rejected', async () => {
  const buildId = id();
  const receipt = path.join(ARTIFACTS, `build-${buildId}.json`);
  await fs.writeFile(receipt, JSON.stringify({ success: false, artifactVerified: false }));
  await assert.rejects(checkArtifact(buildId), /no verified/);
  const file = path.join(TEST_ROOT, 'test-stale.hex');
  await fs.writeFile(file, ':00000001FF\n');
  await fs.writeFile(
    receipt,
    JSON.stringify({
      success: true,
      artifactVerified: true,
      artifact: { path: file, sha256: hash('different') },
    }),
  );
  await assert.rejects(checkArtifact(buildId), /changed/);
  await fs.unlink(receipt);
  await fs.unlink(file);
});
test('unexpected dialogs including a missing-model error block inputs', () => {
  assert.throws(
    () =>
      noDialog({
        controls: [{ class: '#32770', enabled: true, name: 'Missing simulation model' }],
      } as any),
    /Unexpected dialog/,
  );
  assert.throws(
    () =>
      noDialog({
        controls: [{ class: 'QtWindow', type: 'ControlType.Window', enabled: false }],
      } as any),
    /Unexpected dialog/,
  );
});
