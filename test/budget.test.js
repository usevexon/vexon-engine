import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimToBudget, estimateTokens } from '../src/budget.js';

const hit = (id, body) => ({ note: { id, title: id, body, tags: [] }, score: 1 });

test('keeps ranked notes in order until the budget is used', () => {
  const hits = [hit('a', 'x'.repeat(400)), hit('b', 'y'.repeat(400)), hit('c', 'z'.repeat(400))];
  const { hits: kept, used } = trimToBudget(hits, 260);
  assert.ok(used <= 260);
  assert.deepEqual(kept.map((h) => h.note.id), ['a', 'b', 'c']);
  assert.match(kept[2].text, / …$/);
});

test('a long note is cut so the total stays inside the budget', () => {
  const { hits, used } = trimToBudget([hit('long', 'w'.repeat(10000))], 100);
  assert.equal(hits.length, 1);
  assert.ok(used <= 100);
  assert.match(hits[0].text, / …$/);
});

test('estimateTokens rounds up by four characters', () => {
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});
