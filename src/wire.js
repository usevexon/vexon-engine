// Registers the Vexon MCP server with detected agent clients.
// Only mcpServers.vexon is touched. Other keys are kept, and the original
// file is copied once to <file>.vexon-bak before the first change.
import { existsSync } from 'node:fs';
import { copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export function mcpEntry(binPath, dir) {
  const args = [binPath, 'mcp'];
  return { command: process.execPath, args: dir ? [...args, '--dir', dir] : args };
}

async function readJson(file) {
  if (!existsSync(file)) return { exists: false, data: {} };
  const text = await readFile(file, 'utf8');
  if (!text.trim()) return { exists: true, data: {} };
  return { exists: true, data: JSON.parse(text) };
}

async function wireJson(client, file, entry) {
  let parsed;
  try {
    parsed = await readJson(file);
  } catch (err) {
    return { client, path: file, status: 'skipped', reason: `not valid JSON (${err.message})` };
  }
  const data = parsed.data;
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { client, path: file, status: 'skipped', reason: 'top level is not a JSON object' };
  }
  const servers = data.mcpServers && typeof data.mcpServers === 'object' ? data.mcpServers : {};
  const current = servers.vexon;
  if (current && JSON.stringify(current) === JSON.stringify(entry)) {
    return { client, path: file, status: 'unchanged' };
  }
  if (parsed.exists && !existsSync(`${file}.vexon-bak`)) {
    await copyFile(file, `${file}.vexon-bak`);
  }
  const next = { ...data, mcpServers: { ...servers, vexon: entry } };
  await writeFile(file, JSON.stringify(next, null, 2) + '\n');
  return { client, path: file, status: current ? 'updated' : 'added' };
}

async function isDir(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// home: the user's home directory. binPath: absolute path to bin/vexon.js.
// dir: the store directory, passed to `mcp` only when it is not the default.
export async function wireClients({ home, binPath, dir }) {
  const entry = mcpEntry(binPath, dir);
  const results = [];

  // Claude Code reads user-scope MCP servers from ~/.claude.json.
  if (existsSync(join(home, '.claude.json')) || (await isDir(join(home, '.claude')))) {
    results.push(await wireJson('Claude Code', join(home, '.claude.json'), entry));
  }

  // Cursor reads ~/.cursor/mcp.json.
  if (await isDir(join(home, '.cursor'))) {
    results.push(await wireJson('Cursor', join(home, '.cursor', 'mcp.json'), entry));
  }

  // Codex keeps its config in TOML, which this command does not edit.
  if (await isDir(join(home, '.codex'))) {
    results.push({
      client: 'Codex',
      path: join(home, '.codex', 'config.toml'),
      status: 'manual',
      reason: `add to config.toml: codex mcp add vexon -- node ${binPath} mcp`,
    });
  }

  return results;
}
