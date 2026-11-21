// Keyword recall with BM25 over title, tags and body.
// Embeddings come later (M3); this works offline with no model.
const K1 = 1.2;
const B = 0.75;

export function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1);
}

const docText = (n) => `${n.title} ${n.tags.join(' ')} ${n.title} ${n.body}`;

export function search(notes, query, { limit = 5 } = {}) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !notes.length) return [];

  const docs = notes.map((n) => tokenize(docText(n)));
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length || 1;
  const N = docs.length;

  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);

  const scored = docs.map((d, i) => {
    const tf = new Map();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of terms) {
      const f = tf.get(term);
      if (!f) continue;
      const n = df.get(term);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / avgLen)));
    }
    return { note: notes[i], score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (a.note.id < b.note.id ? 1 : -1))
    .slice(0, limit);
}
