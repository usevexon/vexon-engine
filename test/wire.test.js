import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wireClients } from '../src/wire.js';

const BIN = '/opt/vexon/bin/vexon.js';

test('adds mcpServers.vexon and keeps other keys', async () => {
  const home = await mkdtemp(join(tmpdir(), 'vexon-wire-'));
  await writeFile(join(home, '.claude.json'), JSON.stringify({ numStartups: 4, mcpServers: { other: { command: 'x' } } }));
  const res = await wireClients({ home, binPath: BIN });
  assert.equal(res.find((r) => r.client === 'Claude Code').status, 'added');
  const data = JSON.parse(await readFile(join(home, '.claude.json'), 'utf8'));
  assert.equal(data.numStartups, 4);
  assert.deepEqual(data.mcpServers.other, { command: 'x' });
  assert.deepEqual(data.mcpServers.vexon.args, [BIN, 'mcp']);
  assert.ok(existsSync(join(home, '.claude.json.vexon-bak')), 'backup written');
});

test('second run is unchanged and does not rewrite the backup', async () => {
  const home = await mkdtemp(join(tmpdir(), 'vexon-wire-'));
  await mkdir(join(home, '.cursor'));
  await wireClients({ home, binPath: BIN });
  const again = await wireClients({ home, binPath: BIN });
  assert.equal(again.find((r) => r.client === 'Cursor').status, 'unchanged');
});

test('updates an existing entry and passes a custom store dir', async () => {
  const home = await mkdtemp(join(tmpdir(), 'vexon-wire-'));
  await mkdir(join(home, '.cursor'));
  await writeFile(join(home, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { vexon: { command: 'old' } } }));
  const res = await wireClients({ home, binPath: BIN, dir: '/data/vexon' });
  assert.equal(res.find((r) => r.client === 'Cursor').status, 'updated');
  const data = JSON.parse(await readFile(join(home, '.cursor', 'mcp.json'), 'utf8'));
  assert.deepEqual(data.mcpServers.vexon.args, [BIN, 'mcp', '--dir', '/data/vexon']);
});

test('invalid JSON is skipped and left untouched', async () => {
  const home = await mkdtemp(join(tmpdir(), 'vexon-wire-'));
  await writeFile(join(home, '.claude.json'), '{ not json');
  const res = await wireClients({ home, binPath: BIN });
  assert.equal(res.find((r) => r.client === 'Claude Code').status, 'skipped');
  assert.equal(await readFile(join(home, '.claude.json'), 'utf8'), '{ not json');
});

test('no clients detected returns an empty list; Codex is reported as manual', async () => {
  const empty = await mkdtemp(join(tmpdir(), 'vexon-wire-'));
  assert.deepEqual(await wireClients({ home: empty, binPath: BIN }), []);
  await mkdir(join(empty, '.codex'));
  const res = await wireClients({ home: empty, binPath: BIN });
  assert.equal(res[0].status, 'manual');
});
