// Trim ranked notes to a token budget. Tokens are estimated at ~4 characters
// each, which is close enough to keep an agent's context bounded.
export const estimateTokens = (text) => Math.ceil(text.length / 4);

const CUT = ' …';

export function trimToBudget(hits, budget) {
  const out = [];
  let used = 0;
  for (const hit of hits) {
    const header = `## ${hit.note.title}\n`;
    const room = budget - used;
    if (estimateTokens(header) >= room) break;
    let text = header + hit.note.body;
    if (estimateTokens(text) > room) {
      // Cut the body until the whole block fits in the remaining room.
      const keep = Math.max(0, room * 4 - header.length - CUT.length);
      text = header + hit.note.body.slice(0, keep).trimEnd() + CUT;
    }
    if (estimateTokens(text) > room) break;
    used += estimateTokens(text);
    out.push({ ...hit, text, tokens: estimateTokens(text) });
  }
  return { hits: out, used };
}
