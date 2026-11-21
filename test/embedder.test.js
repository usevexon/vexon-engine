import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEmbedder } from '../src/embedder.js';
import { cosine } from '../src/hybrid.js';

test('local model embeds paraphrases close and unrelated text far', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vexon-emb-'));
  try {
    const embed = await loadEmbedder(dir);
    const a = await embed('the cat sat on the mat');
    const b = await embed('a cat is sitting on a mat');
    const c = await embed('quarterly tax filing deadline');
    assert.equal(a.length, 384);
    assert.ok(cosine(a, b) > 0.8, `paraphrase too low: ${cosine(a, b)}`);
    assert.ok(cosine(a, c) < 0.3, `unrelated too high: ${cosine(a, c)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
