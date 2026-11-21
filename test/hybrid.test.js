import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosine, fuse, hybridSearch, vectorRank } from '../src/hybrid.js';

const note = (id, title, body = '') => ({ id, title, body, tags: [] });

test('cosine is 1 for parallel vectors and 0 for orthogonal ones', () => {
  assert.ok(Math.abs(cosine([1, 2], [2, 4]) - 1) < 1e-9);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([0, 0], [1, 1]), 0);
});

test('vectorRank orders notes by similarity and skips notes without vectors', () => {
  const notes = [note('a', 'x'), note('b', 'y'), note('c', 'z')];
  const vectors = new Map([['a', [1, 0]], ['b', [0.9, 0.1]]]);
  const ranked = vectorRank([1, 0], notes, vectors);
  assert.deepEqual(ranked.map((r) => r.note.id), ['a', 'b']);
});

test('fuse rewards notes that rank well in both lists', () => {
  const a = note('a', 'a'), b = note('b', 'b'), c = note('c', 'c');
  const keywords = [{ note: a, score: 3 }, { note: b, score: 2 }];
  const meaning = [{ note: b, score: 0.9 }, { note: c, score: 0.8 }];
  const fused = fuse([keywords, meaning]);
  assert.equal(fused[0].note.id, 'b');
});

test('hybrid finds a note that shares no keywords with the query', async () => {
  const notes = [
    note('deploy', 'Friday freeze', 'no releases after noon on fridays'),
    note('auth', 'Login cookies', 'SameSite=None for cross-site sessions'),
  ];
  // Fake embedder: "sign in" and "login" map to the same concept direction.
  const embed = async (t) => (/sign in|login/i.test(t) ? [1, 0] : [0, 1]);
  const vectors = new Map([['auth', [1, 0]], ['deploy', [0, 1]]]);
  const hits = await hybridSearch(notes, 'how do I sign in', { embed, vectors });
  assert.equal(hits[0].note.id, 'auth');
});

test('without an embedder, hybrid falls back to keyword results', async () => {
  const notes = [note('a', 'cookies'), note('b', 'deploy')];
  const hits = await hybridSearch(notes, 'cookies');
  assert.equal(hits[0].note.id, 'a');
});
