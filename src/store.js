// Notes are plain Markdown files with a small YAML-style front matter block.
// One file per note, so users can read, edit, diff and delete them with any tool.
import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { scrub } from './scrub.js';

export const NOTES = 'notes';

export async function init(dir) {
  await mkdir(join(dir, NOTES), { recursive: true });
  const config = join(dir, 'config.json');
  try {
    await access(config);
  } catch {
    await writeFile(config, JSON.stringify({ version: 1, tokenBudget: 3000 }, null, 2) + '\n');
  }
  return dir;
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'note';

export function serialize({ title, body = '', tags = [], created }) {
  const front = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `created: ${created}`,
    `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    '---',
    '',
  ].join('\n');
  return front + body.replace(/\s+$/, '') + '\n';
}

export function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) throw new Error('note is missing front matter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    if (key === 'tags') meta.tags = JSON.parse(raw.replace(/^\[(.*)\]$/, '[$1]'));
    else if (key === 'title') meta.title = JSON.parse(raw);
    else meta[key] = raw;
  }
  return { ...meta, tags: meta.tags ?? [], body: m[2].replace(/\s+$/, '') + '\n' };
}

export async function addNote(dir, { title, body, tags }) {
  title = scrub(title);
  body = scrub(body ?? '');
  tags = (tags ?? []).map(scrub);
  const created = new Date().toISOString();
  const stamp = created.replace(/[-:.TZ]/g, '').slice(0, 14);
  const id = `${stamp}-${slug(title)}-${randomBytes(2).toString('hex')}`;
  const file = join(dir, NOTES, `${id}.md`);
  await writeFile(file, serialize({ title, body, tags, created }), { flag: 'wx' });
  return { id, file };
}

export async function listNotes(dir) {
  const names = await readdir(join(dir, NOTES)).catch(() => []);
  const notes = [];
  for (const name of names.filter((n) => n.endsWith('.md')).sort()) {
    const file = join(dir, NOTES, name);
    notes.push({ id: basename(name, '.md'), file, ...parse(await readFile(file, 'utf8')) });
  }
  return notes;
}

// Versioned writes: before a note changes, its previous text is kept under
// history/<id>/, so any change can be read back or undone.
export const HISTORY = 'history';

const stamp = () => new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + randomBytes(2).toString('hex');

export async function updateNote(dir, id, patch) {
  const file = join(dir, NOTES, `${id}.md`);
  if (patch.title !== undefined) patch = { ...patch, title: scrub(patch.title) };
  if (patch.body !== undefined) patch = { ...patch, body: scrub(patch.body) };
  if (patch.tags !== undefined) patch = { ...patch, tags: patch.tags.map(scrub) };
  const current = parse(await readFile(file, 'utf8'));
  const histDir = join(dir, HISTORY, id);
  await mkdir(histDir, { recursive: true });
  await writeFile(join(histDir, `${stamp()}.md`), await readFile(file, 'utf8'), { flag: 'wx' });
  const next = {
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    tags: patch.tags ?? current.tags,
    created: current.created,
  };
  await writeFile(file, serialize(next));
  return { id, file };
}

export async function listVersions(dir, id) {
  const names = await readdir(join(dir, HISTORY, id)).catch(() => []);
  return names.filter((n) => n.endsWith('.md')).sort();
}
