import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, addNote, listNotes, parse, serialize } from '../src/store.js';

const tmp = () => mkdtemp(join(tmpdir(), 'vexon-'));

test('init creates the notes folder and a config once', async () => {
  const dir = await tmp();
  try {
    await init(dir);
    await init(dir);
    const cfg = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'));
    assert.equal(cfg.tokenBudget, 3000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a note round-trips through Markdown on disk', async () => {
  const dir = await tmp();
  try {
    await init(dir);
    const { file } = await addNote(dir, { title: 'auth: SameSite=None', body: 'Needed for cross-site cookies.', tags: ['auth', 'prod'] });
    const raw = await readFile(file, 'utf8');
    assert.match(raw, /^---\ntitle: "auth: SameSite=None"/);
    const [note] = await listNotes(dir);
    assert.equal(note.title, 'auth: SameSite=None');
    assert.deepEqual(note.tags, ['auth', 'prod']);
    assert.equal(note.body, 'Needed for cross-site cookies.\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('parse rejects a file without front matter', () => {
  assert.throws(() => parse('just text'), /front matter/);
});

test('serialize then parse keeps multi-line bodies', () => {
  const text = serialize({ title: 'x', body: 'one\n\ntwo', tags: [], created: '2026-11-22T00:00:00.000Z' });
  assert.equal(parse(text).body, 'one\n\ntwo\n');
});
