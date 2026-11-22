#!/usr/bin/env node
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { init, addNote, listNotes, listVersions } from '../src/store.js';
import { search } from '../src/search.js';
import { hybridSearch } from '../src/hybrid.js';
import { loadEmbedder } from '../src/embedder.js';
import { ensureVectors } from '../src/vectors.js';
import { trimToBudget } from '../src/budget.js';
import { captureFromHook } from '../src/capture.js';
import { findProposals, writeProposals, listProposals } from '../src/dream.js';
import { applyMerge, undoLast, addedLines } from '../src/apply.js';
import { rm } from 'node:fs/promises';
import { serveStdio } from '../src/mcp.js';
import { wireClients } from '../src/wire.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const dir = resolve(flag('--dir', process.env.VEXON_DIR ?? join(homedir(), '.vexon')));
// Positional args are everything that is not a flag or a flag's value.
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' || args[i] === '--tag') i++;
  else if (!args[i].startsWith('--')) positional.push(args[i]);
}
const [cmd, ...rest] = positional;

// Hybrid when the local model loads; keyword-only if it does not.
async function rankHits(dir, notes, query, limit) {
  try {
    const embed = await loadEmbedder(dir);
    const vectors = await ensureVectors(dir, notes, embed);
    return await hybridSearch(notes, query, { embed, vectors, limit });
  } catch (err) {
    console.error(`vexon: semantic search off (${err.message}); using keywords`);
    return search(notes, query, { limit });
  }
}

const USAGE = `usage:
  vexon init [--dir <path>] [--no-clients]  create the store (default ~/.vexon) and register MCP with detected clients
  vexon note "<title>" [text] [--tag t]  save a note
  vexon list                             list saved notes
  vexon recall "<query>" [--limit n]     best notes for a query, within the token budget
  vexon search "<query>" [--limit n]     same ranking, one line per note
  vexon capture                          read a Claude Code hook event on stdin
  vexon mcp                              serve recall and capture over MCP (stdio)
  vexon history <note-id>                list saved versions of a note
  vexon dream                            propose merges and conflicts (writes proposals only)
  vexon proposals                        list proposals
  vexon apply <proposal-id>              apply a merge proposal (journaled)
  vexon undo                             undo the last applied change`;

async function main() {
  switch (cmd) {
    case 'init': {
      await init(dir);
      console.log(`vexon store ready at ${dir}`);
      if (args.includes('--no-clients')) return;
      const isDefault = dir === join(homedir(), '.vexon');
      const results = await wireClients({
        home: homedir(),
        binPath: fileURLToPath(import.meta.url),
        dir: isDefault ? undefined : dir,
      });
      if (!results.length) console.log('no agent clients detected; add the MCP server by hand (see README)');
      for (const r of results) {
        const detail = r.reason ? ` (${r.reason})` : '';
        console.log(`${r.client}: ${r.status} ${r.path}${detail}`);
      }
      return;
    }
    case 'note': {
      const [title, ...body] = rest;
      if (!title) throw new Error('give a title: vexon note "<title>"');
      const tags = args.flatMap((a, i) => (a === '--tag' ? [args[i + 1]] : []));
      const { file } = await addNote(dir, { title, body: body.join(' '), tags });
      console.log(file);
      return;
    }
    case 'list': {
      const notes = await listNotes(dir);
      if (!notes.length) console.log('no notes yet');
      for (const n of notes) console.log(`${n.created}  ${n.title}`);
      return;
    }
    case 'recall': {
      const query = rest.join(' ');
      if (!query) throw new Error('give a query: vexon recall "<query>"');
      const config = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'));
      const notes = await listNotes(dir);
      const limit = Number(flag('--limit', 10));
      const hits = await rankHits(dir, notes, query, limit);
      const { hits: kept, used } = trimToBudget(hits, config.tokenBudget ?? 3000);
      if (!kept.length) console.log('no matches');
      for (const h of kept) console.log(h.text + '\n');
      console.error(`(${used} tokens of ${config.tokenBudget ?? 3000})`);
      return;
    }
    case 'capture': {
      // Hook command: always exit 0 so a capture problem never blocks the agent.
      let payload = null;
      try {
        // Read bytes and decode once as UTF-8, so Windows pipes do not mangle text.
        const chunks = [];
        for await (const c of process.stdin) chunks.push(c);
        const raw = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
        payload = JSON.parse(raw || '{}');
        const cap = captureFromHook(payload);
        if (cap) await addNote(dir, cap);
      } catch (err) {
        console.error(`vexon capture: ${err.message}`);
      }
      // Cursor needs a JSON answer on stdout to let the prompt continue. Other
      // agents must get nothing on stdout, since plain stdout becomes prompt context.
      if (payload?.hook_event_name === 'beforeSubmitPrompt') process.stdout.write('{"continue": true}\n');
      return;
    }
    case 'history': {
      const [id] = rest;
      if (!id) throw new Error('give a note id: vexon history <note-id>');
      const versions = await listVersions(dir, id);
      if (!versions.length) console.log('no earlier versions');
      for (const v of versions) console.log(v);
      return;
    }
    case 'dream': {
      const notes = await listNotes(dir);
      let vectors = new Map();
      try {
        const embed = await loadEmbedder(dir);
        vectors = await ensureVectors(dir, notes, embed);
      } catch (err) {
        console.error(`vexon: no embeddings (${err.message}); conflicts only`);
      }
      const ids = await writeProposals(dir, findProposals(notes, vectors));
      console.log(ids.length ? `${ids.length} proposal(s) written. Run: vexon proposals` : 'nothing to propose');
      return;
    }
    case 'proposals': {
      const ps = await listProposals(dir);
      if (!ps.length) console.log('no proposals');
      for (const p of ps) {
        if (p.kind === 'merge') {
          console.log(`${p.id}  merge ${p.drop} into ${p.keep}  (similarity ${p.score})`);
          const notes = await listNotes(dir);
          const keep = notes.find((n) => n.id === p.keep), drop = notes.find((n) => n.id === p.drop);
          if (keep && drop) for (const line of addedLines(keep.body, drop.body)) console.log(`    + ${line}`);
        }
        else console.log(`${p.id}  conflict ${p.a} vs ${p.b}: ${p.note}`);
      }
      return;
    }
    case 'apply': {
      const [pid] = rest;
      if (!pid) throw new Error('give a proposal id: vexon apply <proposal-id>');
      const p = (await listProposals(dir)).find((x) => x.id === pid);
      if (!p) throw new Error(`no proposal ${pid}`);
      if (p.kind !== 'merge') throw new Error('only merge proposals can be applied; conflicts are reviewed by hand');
      const r = await applyMerge(dir, p, await listNotes(dir));
      await rm(join(dir, 'proposals', `${p.id}.json`), { force: true });
      console.log(`merged ${r.archived} into ${r.keep}; run vexon undo to reverse`);
      return;
    }
    case 'undo': {
      const entry = await undoLast(dir);
      console.log(entry ? `undid ${entry.kind} (${entry.changes.length} file change(s))` : 'nothing to undo');
      return;
    }
    case 'mcp': {
      await serveStdio(dir);
      return;
    }
    case 'search': {
      const query = rest.join(' ');
      if (!query) throw new Error('give a query: vexon search "<query>"');
      const limit = Number(flag('--limit', 5));
      const notes = await listNotes(dir);
      const hits = await rankHits(dir, notes, query, limit);
      if (!hits.length) console.log('no matches');
      for (const h of hits) console.log(`${h.score.toFixed(2)}  ${h.note.title}  (${h.note.file})`);
      return;
    }
    default:
      console.log(USAGE);
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(`vexon: ${err.message}`);
  process.exitCode = 1;
});
