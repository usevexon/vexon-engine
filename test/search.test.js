import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search, tokenize } from '../src/search.js';

const note = (id, title, body = '', tags = []) => ({ id, title, body, tags });

test('tokenize lowercases and splits on punctuation', () => {
  assert.deepEqual(tokenize('SameSite=None; cross-site'), ['samesite', 'none', 'cross', 'site']);
});

test('a note that matches more query terms ranks first', () => {
  const notes = [
    note('a', 'deploy notes', 'we deploy on fridays'),
    note('b', 'cookie policy', 'SameSite=None needed for cross-site cookies', ['auth']),
    note('c', 'cookies', 'cookies everywhere'),
  ];
  const hits = search(notes, 'cross-site cookies');
  assert.equal(hits[0].note.id, 'b');
});

test('title and tag matches count', () => {
  const notes = [note('a', 'misc', 'nothing relevant'), note('b', 'billing', '', ['stripe'])];
  assert.equal(search(notes, 'stripe')[0].note.id, 'b');
});

test('no matches and empty queries return nothing', () => {
  const notes = [note('a', 'hello', 'world')];
  assert.deepEqual(search(notes, 'zebra'), []);
  assert.deepEqual(search(notes, '   '), []);
  assert.deepEqual(search([], 'hello'), []);
});

test('limit caps the number of results', () => {
  const notes = [1, 2, 3, 4].map((i) => note(`n${i}`, `token ${i}`));
  assert.equal(search(notes, 'token', { limit: 2 }).length, 2);
});
