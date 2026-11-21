// Vector cache: one entry per note, keyed by note id and a hash of its text,
// so an edited note is re-embedded and an unchanged one is not.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE = 'vectors.json';
const textOf = (n) => `${n.title}\n${n.tags.join(' ')}\n${n.body}`;
const hashOf = (n) => createHash('sha256').update(textOf(n)).digest('hex');

async function readCache(dir) {
  try {
    return JSON.parse(await readFile(join(dir, CACHE), 'utf8'));
  } catch {
    return {};
  }
}

// Returns Map(note id -> vector), embedding only notes that are new or changed.
export async function ensureVectors(dir, notes, embed) {
  const cache = await readCache(dir);
  let changed = false;
  for (const n of notes) {
    const h = hashOf(n);
    if (cache[n.id]?.hash !== h) {
      cache[n.id] = { hash: h, vec: await embed(textOf(n)) };
      changed = true;
    }
  }
  const live = new Set(notes.map((n) => n.id));
  for (const id of Object.keys(cache)) if (!live.has(id)) { delete cache[id]; changed = true; }
  if (changed) await writeFile(join(dir, CACHE), JSON.stringify(cache) + '\n');
  return new Map(Object.entries(cache).map(([id, v]) => [id, v.vec]));
}
