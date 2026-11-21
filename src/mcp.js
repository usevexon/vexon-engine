// MCP server: exposes recall and capture to any MCP client over stdio.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listNotes, addNote } from './store.js';
import { search } from './search.js';
import { hybridSearch } from './hybrid.js';
import { loadEmbedder } from './embedder.js';
import { ensureVectors } from './vectors.js';
import { trimToBudget } from './budget.js';

async function rank(dir, notes, query, limit) {
  try {
    const embed = await loadEmbedder(dir);
    const vectors = await ensureVectors(dir, notes, embed);
    return await hybridSearch(notes, query, { embed, vectors, limit });
  } catch {
    return search(notes, query, { limit });
  }
}

export function buildServer(dir) {
  const server = new McpServer({ name: 'vexon', version: '0.0.1' });

  server.registerTool(
    'vexon_recall',
    {
      description: 'Find notes relevant to a query, trimmed to the token budget.',
      inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(20).optional() },
    },
    async ({ query, limit = 10 }) => {
      const config = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'));
      const budget = config.tokenBudget ?? 3000;
      const hits = await rank(dir, await listNotes(dir), query, limit);
      const { hits: kept } = trimToBudget(hits, budget);
      const text = kept.length ? kept.map((h) => h.text).join('\n') : 'no matches';
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'vexon_capture',
    {
      description: 'Save a note. Use for facts the user asked to remember.',
      inputSchema: {
        title: z.string().min(1).max(120),
        body: z.string().default(''),
        tags: z.array(z.string()).default([]),
      },
    },
    async ({ title, body, tags }) => {
      const { id } = await addNote(dir, { title, body, tags });
      return { content: [{ type: 'text', text: `saved ${id}` }] };
    },
  );

  return server;
}

export async function serveStdio(dir) {
  const server = buildServer(dir);
  await server.connect(new StdioServerTransport());
}
