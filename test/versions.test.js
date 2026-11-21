import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, addNote, updateNote, listVersions, listNotes } from '../src/store.js';

test('an update keeps the previous text in history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vexon-v-'));
  try {
    await init(dir);
    const { id } = await addNote(dir, { title: 'db port', body: 'staging is 5432', tags: ['ops'] });
    await updateNote(dir, id, { body: 'staging is 5433' });
    const [note] = await listNotes(dir);
    assert.equal(note.body, 'staging is 5433\n');
    assert.deepEqual(note.tags, ['ops']);
    const versions = await listVersions(dir, id);
    assert.equal(versions.length, 1);
    const old = await readFile(join(dir, 'history', id, versions[0]), 'utf8');
    assert.match(old, /staging is 5432/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('each update adds one version', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vexon-v-'));
  try {
    await init(dir);
    const { id } = await addNote(dir, { title: 't', body: 'a', tags: [] });
    await updateNote(dir, id, { body: 'b' });
    await updateNote(dir, id, { body: 'c' });
    assert.equal((await listVersions(dir, id)).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
