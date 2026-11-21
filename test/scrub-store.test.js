import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, addNote, updateNote } from '../src/store.js';

test('secrets never reach disk, on create or on update', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vexon-s-'));
  try {
    await init(dir);
    const { id, file } = await addNote(dir, { title: 'creds', body: 'key AKIAIOSFODNN7EXAMPLE', tags: [] });
    await updateNote(dir, id, { body: 'password: hunter22xyz' });

    const current = await readFile(file, 'utf8');
    assert.ok(!current.includes('hunter22xyz'));
    assert.match(current, /\[REDACTED:value\]/);

    const [oldVersion] = await readdir(join(dir, 'history', id));
    const old = await readFile(join(dir, 'history', id, oldVersion), 'utf8');
    assert.ok(!old.includes('AKIAIOSFODNN7EXAMPLE'));
    assert.match(old, /\[REDACTED:aws-access-key\]/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
