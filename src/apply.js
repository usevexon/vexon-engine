// Apply and undo. Every change is recorded in a journal first, with the file
// content from before it. Undo replays the journal backwards.
import { mkdir, readFile, rm, writeFile, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { updateNote } from './store.js';

export const JOURNAL = 'journal';
export const ARCHIVE = 'archive';

const readOrNull = (f) => readFile(f, 'utf8').catch(() => null);

// Lines from the drop note that the keep note does not already have.
export function addedLines(keepBody, dropBody) {
  const have = new Set(keepBody.split('\n').map((l) => l.trim()).filter(Boolean));
  return dropBody.split('\n').map((l) => l.trim()).filter((l) => l && !have.has(l));
}

// Merge the drop note's new lines into the keep note's body, without repeats.
export function mergeBodies(keepBody, dropBody) {
  const extra = addedLines(keepBody, dropBody);
  return extra.length ? `${keepBody.replace(/\s+$/, '')}\n\n${extra.join('\n')}\n` : keepBody;
}

async function writeJournal(dir, entry) {
  const jdir = join(dir, JOURNAL);
  await mkdir(jdir, { recursive: true });
  const name = new Date().toISOString().replace(/[-:.TZ]/g, '') + '.json';
  await writeFile(join(jdir, name), JSON.stringify(entry, null, 2) + '\n');
}

export async function applyMerge(dir, proposal, notes) {
  const keep = notes.find((n) => n.id === proposal.keep);
  const drop = notes.find((n) => n.id === proposal.drop);
  if (!keep || !drop) throw new Error('proposal refers to a note that no longer exists');
  const keepFile = join(dir, 'notes', `${keep.id}.md`);
  const dropFile = join(dir, 'notes', `${drop.id}.md`);
  const archiveFile = join(dir, ARCHIVE, `${drop.id}.md`);

  const changes = [
    { path: keepFile, before: await readOrNull(keepFile) },
    { path: dropFile, before: await readOrNull(dropFile) },
    { path: archiveFile, before: null },
  ];
  await writeJournal(dir, { kind: 'merge', proposal, changes });

  await updateNote(dir, keep.id, { body: mergeBodies(keep.body, drop.body) });
  await mkdir(dirname(archiveFile), { recursive: true });
  await rename(dropFile, archiveFile);
  return { keep: keep.id, archived: drop.id };
}

export async function undoLast(dir) {
  const { readdir } = await import('node:fs/promises');
  const names = (await readdir(join(dir, JOURNAL)).catch(() => [])).filter((n) => n.endsWith('.json')).sort();
  if (!names.length) return null;
  const last = names[names.length - 1];
  const entry = JSON.parse(await readFile(join(dir, JOURNAL, last), 'utf8'));
  for (const c of [...entry.changes].reverse()) {
    if (c.before === null) {
      await rm(c.path, { force: true });
    } else {
      await mkdir(dirname(c.path), { recursive: true });
      await writeFile(c.path, c.before);
    }
  }
  await rm(join(dir, JOURNAL, last));
  return entry;
}
