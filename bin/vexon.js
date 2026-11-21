#!/usr/bin/env node
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { init, addNote, listNotes } from '../src/store.js';
import { search } from '../src/search.js';

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

const USAGE = `usage:
  vexon init [--dir <path>]              create the store (default ~/.vexon)
  vexon note "<title>" [text] [--tag t]  save a note
  vexon list                             list saved notes
  vexon search "<query>" [--limit n]     find notes by keyword`;

async function main() {
  switch (cmd) {
    case 'init': {
      await init(dir);
      console.log(`vexon store ready at ${dir}`);
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
    case 'search': {
      const query = rest.join(' ');
      if (!query) throw new Error('give a query: vexon search "<query>"');
      const limit = Number(flag('--limit', 5));
      const hits = search(await listNotes(dir), query, { limit });
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
