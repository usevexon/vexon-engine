// Dreams: read the store and write proposals. They never edit notes.
// Without a generative model, a dream finds near-duplicates by embedding
// similarity and same-titled notes that disagree. A later milestone can add
// a model that rewrites the proposals.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cosine } from './hybrid.js';

export const PROPOSALS = 'proposals';

export function findProposals(notes, vectors, { threshold = 0.9 } = {}) {
  const out = [];
  const used = new Set();
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i], b = notes[j];
      if (used.has(a.id) || used.has(b.id)) continue;
      const va = vectors.get(a.id), vb = vectors.get(b.id);
      if (!va || !vb) continue;
      const score = cosine(va, vb);
      if (score < threshold) continue;
      // Keep the longer note; the shorter one is merged into it.
      const [keep, drop] = a.body.length >= b.body.length ? [a, b] : [b, a];
      used.add(a.id); used.add(b.id);
      out.push({ kind: 'merge', keep: keep.id, drop: drop.id, score: Number(score.toFixed(3)) });
    }
  }
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i], b = notes[j];
      if (a.title.toLowerCase() === b.title.toLowerCase() && a.body.trim() !== b.body.trim()) {
        out.push({ kind: 'conflict', a: a.id, b: b.id, note: 'same title, different text; review by hand' });
      }
    }
  }
  return out;
}

export async function writeProposals(dir, proposals) {
  const pdir = join(dir, PROPOSALS);
  await mkdir(pdir, { recursive: true });
  const created = new Date().toISOString();
  const ids = [];
  for (const p of proposals) {
    const id = createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 10);
    await writeFile(join(pdir, `${id}.json`), JSON.stringify({ id, created, ...p }, null, 2) + '\n');
    ids.push(id);
  }
  return ids;
}

export async function listProposals(dir) {
  const names = await readdir(join(dir, PROPOSALS)).catch(() => []);
  const out = [];
  for (const n of names.filter((x) => x.endsWith('.json')).sort()) {
    out.push(JSON.parse(await readFile(join(dir, PROPOSALS, n), 'utf8')));
  }
  return out;
}
