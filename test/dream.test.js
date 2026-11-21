import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, addNote, listNotes } from '../src/store.js';
import { findProposals, writeProposals, listProposals } from '../src/dream.js';
import { applyMerge, undoLast, mergeBodies } from '../src/apply.js';

const note = (id, title, body) => ({ id, title, body, tags: [] });

test('dream finds near-duplicates and same-title conflicts', () => {
  const notes = [note('a', 'cookie', 'short'), note('b', 'cookie', 'a longer body here'), note('c', 'deploy', 'x')];
  const vectors = new Map([['a', [1, 0]], ['b', [0.99, 0.1]], ['c', [0, 1]]]);
  const ps = findProposals(notes, vectors);
  assert.deepEqual(ps.find((p) => p.kind === 'merge'), { kind: 'merge', keep: 'b', drop: 'a', score: ps[0].score });
  assert.ok(ps.some((p) => p.kind === 'conflict'));
});

test('merge keeps the new lines once and nothing else', () => {
  assert.equal(mergeBodies('one\ntwo\n', 'two\nthree\n'), 'one\ntwo\n\nthree\n');
  assert.equal(mergeBodies('same\n', 'same\n'), 'same\n');
});

test('apply then undo restores the notes exactly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vexon-d-'));
  try {
    await init(dir);
    const a = await addNote(dir, { title: 'cookie', body: 'SameSite=None', tags: [] });
    const b = await addNote(dir, { title: 'cookie', body: 'SameSite=None\nneeds Secure flag', tags: [] });
    const before = await Promise.all([a.file, b.file].map((f) => readFile(f, 'utf8')));

    const notes = await listNotes(dir);
    const vectors = new Map(notes.map((n) => [n.id, [1, 0]]));
    await writeProposals(dir, findProposals(notes, vectors));
    const proposal = (await listProposals(dir)).find((p) => p.kind === 'merge');
    assert.ok(proposal);

    await applyMerge(dir, proposal, notes);
    assert.equal((await listNotes(dir)).length, 1);
    await undoLast(dir);

    const after = await Promise.all([a.file, b.file].map((f) => readFile(f, 'utf8')));
    assert.deepEqual(after, before);
    await assert.rejects(access(join(dir, 'archive', `${a.id}.md`)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a merge proposal shows the lines it would add', async () => {
  const { addedLines } = await import('../src/apply.js');
  assert.deepEqual(addedLines('one\ntwo', 'two\nthree'), ['three']);
});
