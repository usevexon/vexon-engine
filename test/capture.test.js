import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureFromHook } from '../src/capture.js';

const ev = (prompt, name = 'UserPromptSubmit') => ({ hook_event_name: name, prompt });

test('saves a prompt that starts with remember:', () => {
  const c = captureFromHook(ev('remember: staging db is on port 5433\nsecond line'));
  assert.equal(c.body, 'staging db is on port 5433\nsecond line');
  assert.equal(c.title, 'staging db is on port 5433');
});

test('ignores ordinary prompts', () => {
  assert.equal(captureFromHook(ev('fix the login bug')), null);
  assert.equal(captureFromHook(ev('please remember: x')), null);
});

test('ignores other hook events and empty remember prompts', () => {
  assert.equal(captureFromHook(ev('remember: x', 'Stop')), null);
  assert.equal(captureFromHook(ev('remember:   ')), null);
  assert.equal(captureFromHook({}), null);
});

test('long first lines are shortened for the title', () => {
  const c = captureFromHook(ev('remember: ' + 'a'.repeat(100)));
  assert.equal(c.title.length, 60);
});
