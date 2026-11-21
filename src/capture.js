// Capture from agent hooks. Opt-in only: a prompt is saved when it starts with
// "remember:", so nothing else is written to the store.
const MARK = /^\s*remember:\s*/i;

export function captureFromHook(payload) {
  if (payload?.hook_event_name !== 'UserPromptSubmit') return null;
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!MARK.test(prompt)) return null;
  const text = prompt.replace(MARK, '').trim();
  if (!text) return null;
  const firstLine = text.split('\n')[0];
  const title = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
  return { title, body: text, tags: ['captured'] };
}
