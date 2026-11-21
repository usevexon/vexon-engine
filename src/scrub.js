// Secret scrubbing. Runs before any write to the store and before any text is
// sent to a model. Patterns are conservative: they match known token shapes
// and "key = value" assignments, not every long string.
const RULES = [
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ['aws-access-key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['github-token', /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ['openai-key', /\bsk-(proj-)?[A-Za-z0-9_-]{32,}\b/g],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g],
  ['stripe-key', /\b(sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ['url-credentials', /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@\/]+:[^\s@\/]+@/gi],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}=*/g],
];

// key = value pairs, e.g. password: hunter22 or API_KEY="abc123xyz"
const ASSIGNMENT = /\b((?:[A-Za-z0-9]+[_-])*(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|token))(\s*[:=]\s*)(["']?)([^\s"',;]{6,})\3/gi;

export function scrub(text) {
  let out = String(text);
  for (const [kind, re] of RULES) {
    out = out.replace(re, kind === 'url-credentials' ? (m, scheme) => `${scheme}[REDACTED:url-credentials]@` : `[REDACTED:${kind}]`);
  }
  out = out.replace(ASSIGNMENT, (m, key, sep, quote) => `${key}${sep}${quote}[REDACTED:value]${quote}`);
  return out;
}
