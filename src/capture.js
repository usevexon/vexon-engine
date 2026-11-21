// Capture from agent hooks. Opt-in only: a prompt is saved when it starts with
// "remember:", so nothing else is written to the store.
//
// Supported hook events:
//   Claude Code and Codex: UserPromptSubmit (stdin field `prompt`)
//   Cursor:                beforeSubmitPrompt (stdin field `prompt`)
const MARK = /^\s*remember:\s*/i;
const EVENTS = new Set(['UserPromptSubmit', 'beforeSubmitPrompt']);

// Which agent sent the event. Codex adds `turn_id`; Cursor adds `conversation_id`.
export function sourceOf(payload) {
  if (payload?.hook_event_name === 'beforeSubmitPrompt' || 'conversation_id' in (payload ?? {})) return 'cursor';
  if ('turn_id' in (payload ?? {})) return 'codex';
  return 'claude-code';
}

export function captureFromHook(payload) {
  if (!EVENTS.has(payload?.hook_event_name)) return null;
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!MARK.test(prompt)) return null;
  const text = prompt.replace(MARK, '').trim();
  if (!text) return null;
  const firstLine = text.split('\n')[0];
  const title = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
  return { title, body: text, tags: ['captured', sourceOf(payload)] };
}
