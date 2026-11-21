// Hybrid recall: BM25 (keywords) and cosine similarity over embeddings,
// merged with Reciprocal Rank Fusion. The embedder is injected, so the
// model can change without touching the ranking code.
import { search as bm25 } from './search.js';

export const RRF_K = 60;

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Rank notes by similarity to the query. `vectors` maps note id -> number[].
export function vectorRank(queryVec, notes, vectors) {
  return notes
    .filter((n) => vectors.has(n.id))
    .map((n) => ({ note: n, score: cosine(queryVec, vectors.get(n.id)) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Reciprocal Rank Fusion: each list contributes 1 / (K + rank).
export function fuse(lists, { limit = 5 } = {}) {
  const total = new Map();
  for (const list of lists) {
    list.forEach((hit, i) => {
      const prev = total.get(hit.note.id) ?? { note: hit.note, score: 0 };
      prev.score += 1 / (RRF_K + i + 1);
      total.set(hit.note.id, prev);
    });
  }
  return [...total.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// `embed(text) -> Promise<number[]>`, or null to use keywords only.
export async function hybridSearch(notes, query, { embed = null, vectors = new Map(), limit = 5 } = {}) {
  const lists = [bm25(notes, query, { limit: notes.length })];
  if (embed) {
    const qv = await embed(query);
    lists.push(vectorRank(qv, notes, vectors));
  }
  return fuse(lists, { limit });
}
