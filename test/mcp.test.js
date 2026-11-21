import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { init } from '../src/store.js';

test('an MCP client can capture a note and read it back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vexon-mcp-'));
  await init(dir);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('../bin/vexon.js', import.meta.url).pathname, 'mcp', '--dir', dir],
  });
  const client = new Client({ name: 'test', version: '0.0.1' });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(tools, ['vexon_capture', 'vexon_recall']);
    await client.callTool({ name: 'vexon_capture', arguments: { title: 'deploy window', body: 'fridays after noon are frozen', tags: ['ops'] } });
    const res = await client.callTool({ name: 'vexon_recall', arguments: { query: 'when can we deploy on friday' } });
    assert.match(res.content[0].text, /deploy window/);
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
});
