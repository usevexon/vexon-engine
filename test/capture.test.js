import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureFromHook, sourceOf } from '../src/capture.js';

const ev = (prompt, name = 'UserPromptSubmit', extra = {}) => ({ hook_event_name: name, prompt, ...extra });

test('saves a prompt that starts with remember: from Claude Code', () => {
  const c = captureFromHook(ev('remember: staging db is on port 5433\nsecond line'));
  assert.equal(c.body, 'staging db is on port 5433\nsecond line');
  assert.equal(c.title, 'staging db is on port 5433');
  assert.deepEqual(c.tags, ['captured', 'claude-code']);
});

test('Codex and Cursor prompts are tagged by their source', () => {
  assert.deepEqual(captureFromHook(ev('remember: a', 'UserPromptSubmit', { turn_id: 't1' })).tags, ['captured', 'codex']);
  assert.deepEqual(captureFromHook(ev('remember: b', 'beforeSubmitPrompt', { conversation_id: 'c1' })).tags, ['captured', 'cursor']);
});

test('ignores ordinary prompts', () => {
  assert.equal(captureFromHook(ev('fix the login bug')), null);
  assert.equal(captureFromHook(ev('please remember: x')), null);
});

test('ignores events it does not handle and empty remember prompts', () => {
  assert.equal(captureFromHook(ev('remember: x', 'Stop')), null);
  assert.equal(captureFromHook(ev('remember:   ')), null);
  assert.equal(captureFromHook({}), null);
});

test('long first lines are shortened for the title', () => {
  const c = captureFromHook(ev('remember: ' + 'a'.repeat(100)));
  assert.equal(c.title.length, 60);
});

test('sourceOf defaults to claude-code', () => {
  assert.equal(sourceOf({ hook_event_name: 'UserPromptSubmit' }), 'claude-code');
});
